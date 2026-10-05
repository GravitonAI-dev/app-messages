// Lo que la app entiende: valores admitidos por el contrato de app-messages.
// Lo usan el validador (scripts/validate.mjs) y el microservicio (server/).

export const SIZES = ['sm', 'md', 'lg'];
export const POSITIONS = ['center', 'top', 'bottom', 'top-right', 'bottom-right'];
export const BACKDROPS = ['blur', 'none'];
export const OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'exists'];
export const CONTEXT_FIELDS = [
  'usage.payment_status', 'usage.usage_percentage', 'usage.has_constraints', 'usage.used', 'usage.limit',
  'membership.payment_status', 'membership.plan_code', 'membership.plan_name', 'membership.created_at',
  'membership.max_days', 'membership.expires_at', 'membership.days_left', 'membership.hours_since_start',
  'app.version', 'app.platform',
];
export const COLOR_ROLES = ['brandPrimary', 'brandHover', 'accentSoft', 'accentLine', 'textOnAccent', 'surface', 'surfaceMuted', 'surfaceRaised',
  'textPrimary', 'textHeading', 'textSecondary', 'textMuted', 'textTertiary', 'border', 'divider', 'controlBorder', 'controlFill',
  'success', 'successSurface', 'warning', 'warningSurface', 'danger', 'dangerText', 'dangerSurface', 'infoSurface', 'logoText', 'brandSurface', 'brandLight'];
export const PLAN_CODES = ['basic_plan', 'pro_plan', 'lex_pro_plan'];
export const VARIABLES = ['user_name', 'plan_name', 'plan_end_date', 'days_left', 'usage_percentage', ...PLAN_CODES.map((c) => `plan.${c}.name`), ...COLOR_ROLES.map((r) => 'c.' + r)];
export const TEXT_VARIABLES = VARIABLES.filter((v) => !v.startsWith('c.'));
export const ACTIONS = ['checkout', 'url', 'recheck', 'dismiss', 'signout'];
export const VARIANTS = ['primary', 'secondary', 'ghost', 'danger'];
export const TONES = ['info', 'success', 'warning', 'danger'];
export const CORNER = ['top-right', 'bottom-right'];
export const TAGS = ['div', 'p', 'h1', 'h2', 'h3', 'span', 'strong', 'em', 'a', 'img', 'table', 'tr', 'td', 'ul', 'li', 'br', 'hr'];
export const ATTRS = ['style', 'href', 'src', 'alt', 'width', 'height'];
export const STYLE_PROPS = [
  'color', 'background', 'background-color', 'font-size', 'font-weight', 'font-family', 'line-height', 'text-align',
  'text-decoration', 'border', 'border-top', 'border-bottom', 'border-left', 'border-right', 'border-radius',
  'margin', 'padding', 'width', 'max-width', 'height', 'display', 'opacity', 'letter-spacing', 'text-transform', 'vertical-align',
];

// Portada
export const HOME_CONTAINERS = ['portada_centro', 'portada_derecha'];
export const HOME_ACTIONS = ['new_chat', 'upload_document', 'transcribe_audio', 'create_client', 'checkout', 'url'];
export const HOME_ICONS = ['add', 'upload', 'audio', 'lock', 'info', 'shield', 'sparkle', 'documents', 'chat', 'check', 'alert', 'book', 'mail', 'openExternal', 'newChat', 'library', 'clients', 'skills', 'templates'];

// ---- Variables -----------------------------------------------------------------
// `{{ nombre }}` o `{{ nombre | filtro | filtro:arg }}`. Las de color `{{c.<rol>}}`
// las resuelve la app con el tema activo; el resto, quien pinta (el servicio o,
// sin conexión, la app).

/** Variables de antes de los espacios de nombre, con su equivalente. */
export const VARIABLE_ALIASES = {
  user_name: 'user.name',
  plan_name: 'membership.plan_name',
  plan_end_date: 'membership.expires_at | date:long',
  days_left: 'membership.days_left',
  usage_percentage: 'usage.usage_percentage | number',
};

export const DATA_VARIABLES = [
  ...CONTEXT_FIELDS, 'user.name', 'user.email', 'asset_url', ...PLAN_CODES.map((c) => `plan.${c}.name`),
];

/** `app.<clave>`: los datos que manda la app en `vars`. */
export const APP_VARIABLE_RE = /^app\.[a-z][a-z0-9_]*$/;

export const FILTERS = {
  date: ['long', 'short'],
  number: null, // number:<decimales>, 0 por defecto
  percent: null,
  upper: [],
  lower: [],
  default: null, // default:"texto"
};

export const VARIABLE_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*((?:\|\s*[a-z]+(?:\s*:\s*(?:"[^"]*"|[^|}\s]+))?\s*)*)\}\}/g;

/** Los filtros de la cola `| a | b:"x"` de una variable. */
export function parseFilters(tail) {
  const out = [];
  for (const m of (tail ?? '').matchAll(/\|\s*([a-z]+)(?:\s*:\s*("[^"]*"|[^|}\s]+))?/g)) {
    const arg = m[2] === undefined ? undefined : m[2].startsWith('"') ? m[2].slice(1, -1) : m[2];
    out.push({ name: m[1], arg });
  }
  return out;
}

/** Problemas de una variable (nombre y filtros), o lista vacía si vale. `allowColors`: en HTML sí, en textos no. */
export function checkVariable(name, filters, { allowColors }) {
  const problems = [];
  if (name.startsWith('c.')) {
    if (!allowColors) problems.push(`{{${name}}}: los colores solo van en el HTML`);
    else if (!COLOR_ROLES.includes(name.slice(2))) problems.push(`{{${name}}}: rol de color desconocido. Admitidos: ${COLOR_ROLES.join(', ')}`);
    if (filters.length) problems.push(`{{${name}}}: los colores no llevan filtros`);
    return problems;
  }
  if (!(name in VARIABLE_ALIASES) && !DATA_VARIABLES.includes(name) && !APP_VARIABLE_RE.test(name)) {
    problems.push(`variable {{${name}}} desconocida. Admitidas: ${[...Object.keys(VARIABLE_ALIASES), ...DATA_VARIABLES, 'app.<clave>'].join(', ')}`);
  }
  for (const f of filters) {
    if (!(f.name in FILTERS)) { problems.push(`{{${name}}}: filtro "${f.name}" desconocido. Admitidos: ${Object.keys(FILTERS).join(', ')}`); continue; }
    const allowed = FILTERS[f.name];
    if (Array.isArray(allowed) && f.arg !== undefined && !allowed.includes(f.arg)) problems.push(`{{${name}}}: ${f.name}:${f.arg} inválido (${allowed.join(', ') || 'sin argumento'})`);
    if (f.name === 'number' && f.arg !== undefined && !/^[0-4]$/.test(f.arg)) problems.push(`{{${name}}}: number:<decimales> va de 0 a 4`);
  }
  return problems;
}
