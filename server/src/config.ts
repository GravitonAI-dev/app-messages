import { resolve } from 'path';

const env = (name: string, fallback = '') => process.env[name]?.trim() || fallback;

export const config = {
  PORT: parseInt(env('PORT', '3000'), 10),
  LOG_LEVEL: env('LOG_LEVEL', 'info'),
  /** Raíz del contenido (la del repo: index.json, messages/, home/, assets/, preview/). */
  CONTENT_DIR: resolve(env('CONTENT_DIR', '..')),
  /** URL pública del servicio, sin barra final: con ella se calcula {{asset_url}}. */
  PUBLIC_BASE_URL: env('PUBLIC_BASE_URL', 'http://localhost:3000').replace(/\/+$/, ''),
  FIREBASE_PROJECT_ID: env('FIREBASE_PROJECT_ID', 'confgpt-b376c'),
  /** Base de las Cloud Functions de billing (userInfo, getPlans). */
  BILLING_URL: env('BILLING_URL', 'https://us-central1-confgpt-b376c.cloudfunctions.net').replace(/\/+$/, ''),
  /** validation-telemetry: /api/user-usage/{uid}. */
  TELEMETRY_URL: env('TELEMETRY_URL', 'https://validation-telemetry.confidentialai.es').replace(/\/+$/, ''),
  UPSTREAM_TIMEOUT_MS: parseInt(env('UPSTREAM_TIMEOUT_MS', '5000'), 10),
  /** Vacío = /internal/reload desactivado. */
  RELOAD_TOKEN: env('RELOAD_TOKEN'),
};
