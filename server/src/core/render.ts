// Sustitución de variables `{{ nombre | filtro:arg }}` (gramática en
// scripts/core/contract.mjs). Las de color `{{c.<rol>}}` se dejan tal cual:
// dependen del tema de la app y las resuelve ella.
import { APP_VARIABLE_RE, VARIABLE_ALIASES, VARIABLE_RE, parseFilters, type Filter } from '@app-messages/contract';

export const MISSING = '—';

export interface RenderScope {
  /** Valores por nombre: user.*, membership.*, usage.*, plan.<code>.name, app.*, asset_url. */
  values: Record<string, unknown>;
  lang: string;
  /** Zona horaria IANA del usuario para las fechas. */
  timeZone: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const present = (v: unknown) => v !== undefined && v !== null && v !== '';

function formatDate(value: unknown, style: string, { lang, timeZone }: RenderScope): unknown {
  const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return undefined;
  const options: Intl.DateTimeFormatOptions =
    style === 'short' ? { day: '2-digit', month: '2-digit', year: 'numeric' } : { day: 'numeric', month: 'long', year: 'numeric' };
  try {
    return new Intl.DateTimeFormat(lang, { ...options, timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat(lang, { ...options, timeZone: 'UTC' }).format(date);
  }
}

function formatNumber(value: unknown, decimals: number, lang: string): unknown {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(n)) return undefined;
  return new Intl.NumberFormat(lang, { maximumFractionDigits: decimals, minimumFractionDigits: 0 }).format(n);
}

function applyFilter(value: unknown, f: Filter, scope: RenderScope): unknown {
  switch (f.name) {
    case 'default':
      return present(value) ? value : f.arg;
    case 'date':
      return present(value) ? formatDate(value, f.arg ?? 'long', scope) : value;
    case 'number':
      return present(value) ? formatNumber(value, Number(f.arg ?? 0), scope.lang) : value;
    case 'percent': {
      const n = present(value) ? formatNumber(value, Number(f.arg ?? 0), scope.lang) : undefined;
      return n === undefined ? undefined : scope.lang === 'es' ? `${n}\u00a0%` : `${n}%`;
    }
    case 'upper':
      return present(value) ? String(value).toLocaleUpperCase(scope.lang) : value;
    case 'lower':
      return present(value) ? String(value).toLocaleLowerCase(scope.lang) : value;
    default:
      return value; // filtro desconocido: lo para el validador; aquí no rompe nada
  }
}

/** El valor final de una variable, ya filtrado, o null si no se conoce. */
export function resolveVariable(name: string, filters: Filter[], scope: RenderScope): string | null {
  const alias = VARIABLE_ALIASES[name];
  if (alias) {
    const [target, tail] = alias.split(/\s*(?=\|)/, 2);
    return resolveVariable(target.trim(), [...parseFilters(tail), ...filters], scope);
  }
  let value: unknown = scope.values[name];
  for (const f of filters) value = applyFilter(value, f, scope);
  return present(value) ? String(value) : null;
}

/**
 * [text] con las variables sustituidas. `html: true` escapa los valores (un
 * nombre de usuario no puede meter etiquetas); en textos planos (título,
 * etiquetas de botones) van tal cual. Lo que no se conoce sale como «—».
 */
export function renderText(text: string, scope: RenderScope, { html }: { html: boolean }): string {
  return text.replace(VARIABLE_RE, (whole, name: string, tail: string) => {
    if (name.startsWith('c.')) return whole;
    const value = resolveVariable(name, parseFilters(tail), scope) ?? MISSING;
    return html ? escapeHtml(value) : value;
  });
}

/**
 * Solo `app.*` de lo que manda la app, y solo textos o números cortos: la app
 * no puede pisar los datos de la cuenta ni colar objetos.
 */
export function clientVars(vars: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!vars || typeof vars !== 'object' || Array.isArray(vars)) return out;
  for (const [key, value] of Object.entries(vars)) {
    if (!APP_VARIABLE_RE.test(key)) continue;
    if (typeof value === 'string' && value.length <= 500) out[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = String(value);
    else if (typeof value === 'boolean') out[key] = String(value);
  }
  return out;
}
