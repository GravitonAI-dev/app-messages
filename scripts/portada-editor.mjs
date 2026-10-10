// Editor de la portada: sirve preview/portada.html y guarda/publica home/*.json.
// Uso: node scripts/portada-editor.mjs → http://localhost:8788/preview/portada.html
// Guardar escribe el JSON y pasa el validador; Publicar hace commit y push a main
// (la app lee la portada de GitHub, no de este clon).
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { extname, join, normalize, resolve } from 'node:path';

const run = promisify(execFile);
const ROOT = resolve(new URL('..', import.meta.url).pathname);
const PORT = Number(process.env.PORT || 8788);
const CONTAINERS = { portada_centro: 'home/portada_centro.json', portada_derecha: 'home/portada_derecha.json' };
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const body = async (req) => { let s = ''; for await (const c of req) s += c; return s; };
const sh = async (cmd, args) => {
  try { const { stdout, stderr } = await run(cmd, args, { cwd: ROOT }); return { ok: true, out: (stdout + stderr).trim() }; }
  catch (e) { return { ok: false, out: ((e.stdout || '') + (e.stderr || '') || e.message).trim() }; }
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const save = url.pathname.match(/^\/api\/home\/(\w+)$/);
  if (save && req.method === 'POST') {
    const file = CONTAINERS[save[1]];
    if (!file) return send(res, 404, { ok: false, out: 'contenedor desconocido' });
    let doc;
    try { doc = JSON.parse(await body(req)); } catch { return send(res, 400, { ok: false, out: 'JSON no válido' }); }
    const previous = await readFile(join(ROOT, file), 'utf8');
    await writeFile(join(ROOT, file), JSON.stringify(doc, null, 2) + '\n');
    const check = await sh('node', ['scripts/validate.mjs']);
    if (!check.ok) await writeFile(join(ROOT, file), previous);
    return send(res, check.ok ? 200 : 422, check);
  }
  // Con qué reconoce la página que la sirve el editor y no el servicio
  // desplegado: si esto no responde, se queda en sólo lectura.
  if (url.pathname === '/api/editor') {
    return send(res, 200, { editor: true });
  }
  if (url.pathname === '/api/publish' && req.method === 'POST') {
    const check = await sh('node', ['scripts/validate.mjs']);
    if (!check.ok) return send(res, 422, check);
    const diff = await sh('git', ['status', '--porcelain', '--', 'home/']);
    if (!diff.out) return send(res, 200, { ok: true, out: 'Nada que publicar: GitHub ya tiene esta portada.' });
    const { message } = JSON.parse((await body(req)) || '{}');
    for (const step of [
      ['git', ['pull', '--rebase', '--autostash', '-q', 'origin', 'main']],
      ['git', ['add', '--', 'home/']],
      ['git', ['commit', '-q', '-m', message || 'Portada: cambios desde el editor', '--', 'home/']],
      ['git', ['push', '-q', 'origin', 'HEAD:main']],
    ]) {
      const r = await sh(...step);
      if (!r.ok) return send(res, 500, { ok: false, out: `${step[1][0]}: ${r.out}` });
    }
    const head = await sh('git', ['log', '--oneline', '-1']);
    return send(res, 200, { ok: true, out: `Publicado en GitHub: ${head.out}` });
  }
  if (req.method !== 'GET') return send(res, 405, { ok: false });
  const path = normalize(join(ROOT, decodeURIComponent(url.pathname === '/' ? '/preview/portada.html' : url.pathname)));
  if (!path.startsWith(ROOT)) return send(res, 403, 'no');
  try { send(res, 200, await readFile(path), TYPES[extname(path)] || 'application/octet-stream'); }
  catch { send(res, 404, 'no existe', 'text/plain'); }
}).listen(PORT, '127.0.0.1', () => console.log(`Editor de portada: http://localhost:${PORT}/preview/portada.html`));
