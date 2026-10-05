import { resolve } from 'path';

const env = (name: string, fallback = '') => process.env[name]?.trim() || fallback;

export const config = {
  PORT: parseInt(env('PORT', '3000'), 10),
  LOG_LEVEL: env('LOG_LEVEL', 'info'),
  /** Raíz del contenido (la del repo: index.json, messages/, home/, assets/, preview/). */
  CONTENT_DIR: resolve(env('CONTENT_DIR', '..')),
  /** Vacío = /internal/reload desactivado. */
  RELOAD_TOKEN: env('RELOAD_TOKEN'),
};
