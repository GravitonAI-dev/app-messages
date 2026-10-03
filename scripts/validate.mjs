// Validador del repo de mensajes. Sin dependencias: node >= 20.
// Comprueba índice, ficheros de mensaje, condiciones, HTML admitido, acciones y variables.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

// ---- Lo que la app entiende --------------------------------------------------
const SIZES = ['sm', 'md', 'lg'];
const POSITIONS = ['center', 'top', 'bottom', 'top-right', 'bottom-right'];
const BACKDROPS = ['blur', 'none'];
const OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'exists'];
const CONTEXT_FIELDS = [
  'usage.payment_status', 'usage.usage_percentage', 'usage.has_constraints', 'usage.used', 'usage.limit',
  'membership.payment_status', 'membership.plan_code', 'membership.plan_name', 'membership.created_at',
  'membership.max_days', 'membership.expires_at', 'membership.days_left', 'membership.hours_since_start',
  'app.version', 'app.platform',
];
const COLOR_ROLES = ['brandPrimary', 'brandHover', 'accentSoft', 'accentLine', 'textOnAccent', 'surface', 'surfaceMuted', 'surfaceRaised',
  'textPrimary', 'textHeading', 'textSecondary', 'textMuted', 'textTertiary', 'border', 'divider', 'controlBorder', 'controlFill',
  'success', 'successSurface', 'warning', 'warningSurface', 'danger', 'dangerText', 'dangerSurface', 'infoSurface', 'logoText', 'brandSurface', 'brandLight'];
const PLAN_CODES = ['basic_plan', 'pro_plan', 'lex_pro_plan'];
const VARIABLES = ['user_name', 'plan_name', 'plan_end_date', 'days_left', 'usage_percentage', ...PLAN_CODES.map((c) => `plan.${c}.name`), ...COLOR_ROLES.map((r) => 'c.' + r)];
const TEXT_VARIABLES = VARIABLES.filter((v) => !v.startsWith('c.'));
const ACTIONS = ['checkout', 'url', 'recheck', 'dismiss', 'signout'];
const VARIANTS = ['primary', 'secondary', 'ghost', 'danger'];
const TONES = ['info', 'success', 'warning', 'danger'];
const CORNER = ['top-right', 'bottom-right'];
const TAGS = ['div', 'p', 'h1', 'h2', 'h3', 'span', 'strong', 'em', 'a', 'img', 'table', 'tr', 'td', 'ul', 'li', 'br', 'hr'];
const ATTRS = ['style', 'href', 'src', 'alt', 'width', 'height'];
const STYLE_PROPS = [
  'color', 'background', 'background-color', 'font-size', 'font-weight', 'font-family', 'line-height', 'text-align',
  'text-decoration', 'border', 'border-top', 'border-bottom', 'border-left', 'border-right', 'border-radius',
  'margin', 'padding', 'width', 'max-width', 'height', 'display', 'opacity', 'letter-spacing', 'text-transform', 'vertical-align',
];

const readJson = (file) => {
  try { return JSON.parse(readFileSync(resolve(ROOT, file), 'utf8')); }
  catch (e) { fail(file, `JSON inválido: ${e.message}`); return null; }
};

// ---- Índice ------------------------------------------------------------------
const index = readJson('index.json');
if (!index) finish();
if (index.schema_version !== 1) fail('index.json', 'schema_version debe ser 1');
if (!index.messages || typeof index.messages !== 'object') { fail('index.json', 'falta "messages"'); finish(); }

for (const [code, file] of Object.entries(index.messages)) {
  if (!/^[a-z][a-z0-9_]*$/.test(code)) fail('index.json', `código "${code}" inválido (minúsculas, números y _)`);
  if (!existsSync(resolve(ROOT, file))) { fail('index.json', `"${code}" apunta a ${file}, que no existe`); continue; }
  validateMessage(code, file);
}

function validateMessage(code, file) {
  const m = readJson(file);
  if (!m) return;
  const where = file;

  if (m.schema_version !== 1) fail(where, 'schema_version debe ser 1');
  if (m.id !== code) fail(where, `id "${m.id}" no coincide con el código del índice "${code}"`);
  if ('enabled' in m && typeof m.enabled !== 'boolean') fail(where, 'enabled debe ser true o false');

  if (!m.when || typeof m.when !== 'object' || Object.keys(m.when).length === 0) fail(where, 'falta "when" con al menos una condición');
  else for (const [field, cond] of Object.entries(m.when)) {
    if (!CONTEXT_FIELDS.includes(field)) fail(where, `when: campo desconocido "${field}". Admitidos: ${CONTEXT_FIELDS.join(', ')}`);
    if (cond !== null && typeof cond === 'object' && !Array.isArray(cond)) {
      for (const op of Object.keys(cond)) if (!OPERATORS.includes(op)) fail(where, `when.${field}: operador desconocido "${op}"`);
      if (Object.keys(cond).length === 0) fail(where, `when.${field}: condición vacía`);
    }
  }

  if (!(SIZES.includes(m.size) || (Number.isInteger(m.size) && m.size >= 240 && m.size <= 1200))) fail(where, `size "${m.size}" inválido (sm, md, lg o 240-1200 px)`);
  if (!POSITIONS.includes(m.position)) fail(where, `position "${m.position}" inválido`);
  if (!BACKDROPS.includes(m.backdrop)) fail(where, `backdrop "${m.backdrop}" inválido`);
  if (typeof m.dismissible !== 'boolean') fail(where, 'dismissible debe ser true o false');
  if (typeof m.persistent !== 'boolean') fail(where, 'persistent debe ser true o false');
  if ('auto_close' in m && !(Number.isInteger(m.auto_close) && m.auto_close >= 0)) fail(where, 'auto_close debe ser un entero >= 0');
  if (!(Number.isInteger(m.priority) && m.priority >= 0 && m.priority <= 1000)) fail(where, 'priority debe ser un entero 0-1000');
  if (m.backdrop === 'blur' && m.dismissible === false && m.persistent === false) fail(where, 'un mensaje con blur y sin X tiene que ser persistent: true (si no, nunca podría cerrarse)');
  if (m.auto_close > 0 && m.dismissible === false) fail(where, 'auto_close solo tiene sentido con dismissible: true');

  const corner = CORNER.includes(m.position);
  if ('title' in m && (typeof m.title !== 'string' || !m.title.trim())) fail(where, 'title debe ser un texto no vacío (o no ponerlo: AppDialog sin cabecera)');
  if (corner && m.backdrop === 'blur') fail(where, 'un mensaje de esquina (AppBanner) no lleva blur');
  if (corner && !TONES.includes(m.tone)) fail(where, `los mensajes de esquina son un AppBanner y necesitan "tone" (${TONES.join(', ')})`);
  if ('tone' in m && !TONES.includes(m.tone)) fail(where, `tone "${m.tone}" inválido`);
  if ('actions' in m) {
    if (!Array.isArray(m.actions) || m.actions.length > 3) fail(where, 'actions debe ser una lista de 1 a 3 botones');
    else m.actions.forEach((a, i) => {
      if (!a || typeof a.label !== 'string' || !a.label.trim()) fail(where, `actions[${i}]: falta label`);
      if (!ACTIONS.includes(a.action)) fail(where, `actions[${i}]: acción "${a.action}" desconocida. Admitidas: ${ACTIONS.join(', ')}`);
      if (a.action === 'url' && !/^https:\/\//.test(a.url ?? '')) fail(where, `actions[${i}]: la acción url necesita "url" https://`);
      if (a.action !== 'url' && 'url' in a) fail(where, `actions[${i}]: "url" solo va con la acción url`);
      if (('plan' in a || 'interval' in a) && a.action !== 'checkout') fail(where, `actions[${i}]: "plan"/"interval" solo van con la acción checkout`);
      if ('plan' in a && !['basic_plan', 'pro_plan', 'lex_pro_plan'].includes(a.plan)) fail(where, `actions[${i}]: plan "${a.plan}" desconocido (basic_plan, pro_plan, lex_pro_plan)`);
      if ('interval' in a && !['month', 'year'].includes(a.interval)) fail(where, `actions[${i}]: interval "${a.interval}" inválido (month, year)`);
      if ('variant' in a && !VARIANTS.includes(a.variant)) fail(where, `actions[${i}]: variant "${a.variant}" inválido (${VARIANTS.join(', ')})`);
    });
    if (corner && m.actions.length > 1) fail(where, 'un AppBanner lleva como mucho un botón');
  }
  if ('footer_link' in m) {
    const l = m.footer_link;
    if (!l || typeof l.label !== 'string' || !ACTIONS.includes(l.action)) fail(where, 'footer_link necesita label y una acción válida');
    else if (l.action === 'url' && !/^https:\/\//.test(l.url ?? '')) fail(where, 'footer_link con acción url necesita "url" https://');
    if (corner) fail(where, 'footer_link solo existe en los AppDialog (mensajes centrados)');
  }
  if (m.backdrop === 'blur' && m.dismissible === false && !(Array.isArray(m.actions) && m.actions.length)) fail(where, 'un bloqueante sin X necesita al menos un botón en actions');
  if (m.backdrop === 'blur' && m.dismissible === false && Array.isArray(m.actions) && m.actions.some((a) => a && a.action === 'dismiss')) fail(where, 'un bloqueante sin X no puede llevar un botón dismiss: solo se quita cuando deja de cumplirse su when');

  // variables de texto en title y en las etiquetas de botones/enlace
  const checkTextVars = (txt, what) => { for (const v of String(txt).matchAll(/\{\{\s*([a-zA-Z_.]+)\s*\}\}/g)) if (!TEXT_VARIABLES.includes(v[1])) fail(where, `${what}: variable {{${v[1]}}} desconocida. Admitidas: ${TEXT_VARIABLES.join(', ')}`); };
  if (m.title) checkTextVars(m.title, 'title');
  (m.actions ?? []).forEach((a, i) => a && a.label && checkTextVars(a.label, `actions[${i}].label`));
  if (m.footer_link && m.footer_link.label) checkTextVars(m.footer_link.label, 'footer_link.label');

  let html = null;
  if (m.html_file) {
    const htmlPath = resolve(ROOT, 'messages', m.html_file);
    if (!existsSync(htmlPath)) fail(where, `html_file "${m.html_file}" no existe en messages/`);
    else html = readFileSync(htmlPath, 'utf8');
  } else if (typeof m.html === 'string') html = m.html;
  else fail(where, 'falta html_file (o html en línea)');

  if (html !== null) validateHtml(`messages/${m.html_file ?? m.id + '.json#html'}`, html);
}

function validateHtml(where, html) {
  if (!html.trim()) { fail(where, 'HTML vacío'); return; }
  const body = html.replace(/<!--[\s\S]*?-->/g, '');

  if (/<script/i.test(body)) fail(where, '<script> no está permitido');
  if (/<style/i.test(body)) fail(where, '<style> no está permitido: usa estilos en línea');
  if (/\son[a-z]+\s*=/i.test(body)) fail(where, 'atributos on*= (JavaScript) no están permitidos');

  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
  let t;
  while ((t = tagRe.exec(body))) {
    const tag = t[1].toLowerCase();
    if (!TAGS.includes(tag)) fail(where, `etiqueta <${tag}> no admitida. Admitidas: ${TAGS.join(', ')}`);
    const attrRe = /([a-zA-Z-]+)\s*=\s*("[^"]*"|'[^']*')/g;
    let a;
    while ((a = attrRe.exec(t[2]))) {
      const attr = a[1].toLowerCase();
      const value = a[2].slice(1, -1);
      if (!ATTRS.includes(attr)) fail(where, `atributo ${attr}= en <${tag}> no admitido. Admitidos: ${ATTRS.join(', ')}`);
      if (attr === 'style') for (const decl of value.split(';')) {
        const prop = decl.split(':')[0].trim().toLowerCase();
        if (prop && !STYLE_PROPS.includes(prop)) fail(where, `propiedad CSS "${prop}" no admitida en <${tag}>`);
        if (/^(color|background|background-color|border|border-top|border-bottom|border-left|border-right)$/.test(prop) && /#[0-9a-f]{3,8}\b|rgba?\(/i.test(decl))
          fail(where, `color fijo en "${decl.trim()}" de <${tag}>: usa una variable {{c.<rol>}} para que siga el tema claro/oscuro`);
      }
      if (attr === 'href') validateHref(where, value);
      if (attr === 'src' && !/^https:\/\//.test(value)) fail(where, `src debe ser https:// (${value})`);
    }
  }

  const varRe = /\{\{\s*([a-zA-Z_.]+)\s*\}\}/g;
  let v;
  while ((v = varRe.exec(body))) if (!VARIABLES.includes(v[1])) fail(where, `variable {{${v[1]}}} desconocida. Admitidas: ${VARIABLES.join(', ')}`);
}

function validateHref(where, href) {
  if (href.startsWith('confai://')) {
    fail(where, `enlace ${href} dentro del HTML: los botones y enlaces de acción van en "actions" / "footer_link" del JSON (AppButton / AppLink)`);
    return;
  }
  if (false) {
    const rest = href.slice('confai://'.length);
    const action = rest.split('?')[0];
    if (!ACTIONS.includes(action)) { fail(where, `acción confai://${action} desconocida. Admitidas: ${ACTIONS.join(', ')}`); return; }
    if (action === 'url') {
      const u = new URLSearchParams(rest.split('?')[1] ?? '').get('u');
      if (!u || !/^https:\/\//.test(u)) fail(where, `confai://url necesita ?u=<url https codificada> (${href})`);
    } else if (rest.includes('?')) fail(where, `confai://${action} no lleva parámetros (${href})`);
    return;
  }
  if (!/^https:\/\//.test(href)) fail(where, `href debe ser confai:// o https:// (${href})`);
}

finish();

function finish() {
  if (errors.length) {
    console.error(`✗ ${errors.length} error(es):\n` + errors.map((e) => '  - ' + e).join('\n'));
    process.exit(1);
  }
  const n = Object.keys(index?.messages ?? {}).length;
  console.log(`✓ ${n} mensaje(s) válidos`);
  process.exit(0);
}
