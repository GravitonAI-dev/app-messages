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
const VARIABLES = ['user_name', 'plan_name', 'plan_end_date', 'days_left', 'usage_percentage'];
const ACTIONS = ['checkout', 'url', 'recheck', 'dismiss', 'signout'];
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
      }
      if (attr === 'href') validateHref(where, value);
      if (attr === 'src' && !/^https:\/\//.test(value)) fail(where, `src debe ser https:// (${value})`);
    }
  }

  const varRe = /\{\{\s*([a-z_]+)\s*\}\}/g;
  let v;
  while ((v = varRe.exec(body))) if (!VARIABLES.includes(v[1])) fail(where, `variable {{${v[1]}}} desconocida. Admitidas: ${VARIABLES.join(', ')}`);
}

function validateHref(where, href) {
  if (href.startsWith('confai://')) {
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
