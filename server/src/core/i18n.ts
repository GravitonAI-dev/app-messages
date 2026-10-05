/** Un texto por idioma, como los de home/*.json: `{ "es": "…", "en": "…" }`. */
export function isLocalized(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length > 0 &&
    typeof (value as Record<string, unknown>).es === 'string' &&
    entries.every(([k, v]) => /^[a-z]{2}$/.test(k) && typeof v === 'string')
  );
}

/** [value] con cada texto por idioma cambiado por el de [lang] (o `es` si falta). */
export function resolveLang<T>(value: T, lang: string): T {
  if (isLocalized(value)) return (value[lang] ?? value.es) as T;
  if (Array.isArray(value)) return value.map((v) => resolveLang(v, lang)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveLang(v, lang)])) as T;
  }
  return value;
}

/** Normaliza el idioma pedido a dos letras; `es` si no se entiende. */
export function normalizeLang(lang: unknown): string {
  const code = typeof lang === 'string' ? lang.trim().slice(0, 2).toLowerCase() : '';
  return /^[a-z]{2}$/.test(code) ? code : 'es';
}
