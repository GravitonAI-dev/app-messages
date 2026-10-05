// Lo que la app entiende: valores admitidos por el contrato de app-messages.
// Lo usan el validador (scripts/validate.mjs) y el microservicio (server/).

export const SIZES = ['sm', 'md', 'lg'];
export const POSITIONS = ['center', 'top', 'bottom', 'top-right', 'bottom-right'];
export const BACKDROPS = ['blur', 'none'];
export const COLOR_ROLES = ['brandPrimary', 'brandHover', 'accentSoft', 'accentLine', 'textOnAccent', 'surface', 'surfaceMuted', 'surfaceRaised',
  'textPrimary', 'textHeading', 'textSecondary', 'textMuted', 'textTertiary', 'border', 'divider', 'controlBorder', 'controlFill',
  'success', 'successSurface', 'warning', 'warningSurface', 'danger', 'dangerText', 'dangerSurface', 'infoSurface', 'logoText', 'brandSurface', 'brandLight'];
export const PLAN_CODES = ['basic_plan', 'pro_plan', 'lex_pro_plan'];
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
// `{{ nombre }}`. Las rellena la app al pintar: las de sesión con sus datos, las
// `params.*` con los del código de estado que trajo el mensaje y las de color
// `{{c.<rol>}}` con el tema activo. Los filtros (`| date`…) están reservados:
// la app aún no los entiende y el validador los rechaza.

/** Datos de la sesión y de billing, que la app ya tiene. */
export const SESSION_VARIABLES = ['user_name', 'user.name', 'plan_name', ...PLAN_CODES.map((c) => `plan.${c}.name`)];

/** Atajos que la app calcula a partir de `params` (p. ej. la fecha ya formateada). */
export const VARIABLE_ALIASES = {
  days_left: 'params.days_left',
  plan_end_date: 'params.expires_at, como fecha larga',
  usage_percentage: 'params.usage_percentage, redondeado',
};

/**
 * Frases de la cuota (cuándo se renueva, desde cuándo cuenta). Pendientes de
 * la ventana de tokens: hasta entonces la app pone un texto genérico.
 */
export const COMPUTED_VARIABLES = ['usage_reset', 'usage_since'];

/** `params.<clave>`: los datos del código de estado (docs/codigos-de-estado.md). */
export const PARAMS_VARIABLE_RE = /^params\.[a-z][a-z0-9_]*$/;

export const VARIABLE_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*((?:\|[^}]*)?)\}\}/g;

/** Problemas de una variable, o lista vacía si vale. `allowColors`: en HTML sí, en textos no. */
export function checkVariable(name, filters, { allowColors }) {
  const problems = [];
  if (filters && filters.trim()) problems.push(`{{${name}${filters}}}: los filtros aún no los entiende la app`);
  if (name.startsWith('c.')) {
    if (!allowColors) problems.push(`{{${name}}}: los colores solo van en el HTML`);
    else if (!COLOR_ROLES.includes(name.slice(2))) problems.push(`{{${name}}}: rol de color desconocido. Admitidos: ${COLOR_ROLES.join(', ')}`);
    return problems;
  }
  const known = SESSION_VARIABLES.includes(name) || name in VARIABLE_ALIASES || COMPUTED_VARIABLES.includes(name) || PARAMS_VARIABLE_RE.test(name);
  if (!known) problems.push(`variable {{${name}}} desconocida. Admitidas: ${[...SESSION_VARIABLES, ...Object.keys(VARIABLE_ALIASES), ...COMPUTED_VARIABLES, 'params.<clave>'].join(', ')}`);
  return problems;
}
