import { createHash } from 'crypto';
import { readFile, readdir, stat } from 'fs/promises';
import { extname, join, relative, sep } from 'path';
import { ContentPort, type HomeContainer, type RawFile } from '../../application/ports/content.port';
import { createLogger } from '../logging/logger';

const log = createLogger('FsContentStore');

/** Lo que se publica en /raw: el catálogo de códigos, los mensajes, sus imágenes y la vista previa. */
const PUBLISHED = ['index.json', 'codes.json', 'messages', 'home', 'assets', 'preview', 'templates'];

const TYPES: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

interface Snapshot {
  version: string;
  files: Map<string, RawFile>;
  home: Record<string, HomeContainer>;
}

/** Se crea con [FsContentStore.load], que ya deja el contenido leído. */
export class FsContentStore extends ContentPort {
  private snapshot: Snapshot;

  private constructor(private readonly root: string) {
    super();
  }

  static async load(root: string) {
    const store = new FsContentStore(root);
    await store.reload();
    return store;
  }

  get version() {
    return this.snapshot.version;
  }

  file(path: string) {
    return this.snapshot.files.get(path) ?? null;
  }

  home() {
    return this.snapshot.home;
  }

  async reload() {
    const files = new Map<string, RawFile>();
    for (const entry of PUBLISHED) await this.collect(join(this.root, entry), files);

    const json = <T>(path: string): T => {
      const f = files.get(path);
      if (!f) throw new Error(`falta ${path}`);
      return JSON.parse(f.body.toString('utf8')) as T;
    };
    const text = (path: string) => {
      const f = files.get(path);
      if (!f) throw new Error(`falta ${path}`);
      return f.body.toString('utf8');
    };

    // Se lee todo lo que la app va a pedir: un JSON roto o un fichero que
    // falta hace fallar la recarga y se sigue sirviendo el contenido anterior.
    const index = json<{ codes?: string; messages?: Record<string, string>; home?: Record<string, string> }>('index.json');
    json(index.codes ?? 'codes.json');
    const messages = Object.values(index.messages ?? {}).map((path) => {
      // html_file: un fichero o uno por idioma ({ "es": "x.html", "en": "x.en.html" }).
      const m = json<{ html_file?: string | Record<string, string> }>(path);
      const files = typeof m.html_file === 'string' ? [m.html_file] : Object.values(m.html_file ?? {});
      for (const f of files) text(`messages/${f}`);
      return m;
    });
    const home = Object.fromEntries(Object.entries(index.home ?? {}).map(([key, path]) => [key, json<HomeContainer>(path)]));

    const version = createHash('sha256')
      .update([...files.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([p, f]) => `${p}:${f.etag}`).join('\n'))
      .digest('hex')
      .slice(0, 12);

    this.snapshot = { version, files, home };
    log.info({ version, files: files.size, messages: messages.length }, 'contenido cargado');
  }

  private async collect(path: string, into: Map<string, RawFile>) {
    const info = await stat(path).catch(() => null);
    if (!info) return;
    if (info.isDirectory()) {
      for (const name of await readdir(path)) if (!name.startsWith('.')) await this.collect(join(path, name), into);
      return;
    }
    const type = TYPES[extname(path).toLowerCase()];
    if (!type) return;
    const body = await readFile(path);
    const key = relative(this.root, path).split(sep).join('/');
    into.set(key, { body, contentType: type, etag: `"${createHash('sha256').update(body).digest('hex').slice(0, 16)}"` });
  }
}
