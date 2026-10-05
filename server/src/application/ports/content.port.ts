export interface RawFile {
  body: Buffer;
  etag: string;
  contentType: string;
}

export interface HomeContainer {
  schema_version: number;
  enabled?: boolean;
  blocks: Array<Record<string, unknown>>;
}

/** El contenido del repo (index.json, codes.json, messages/, home/, assets/, preview/), en memoria. */
export abstract class ContentPort {
  /** Hash corto de todo el contenido: cambia con cualquier fichero. */
  abstract get version(): string;
  abstract file(path: string): RawFile | null;
  abstract home(): Record<string, HomeContainer>;
  /** Vuelve a leer el contenido. Si algo no se entiende, lanza y se queda con el anterior. */
  abstract reload(): Promise<void>;
}
