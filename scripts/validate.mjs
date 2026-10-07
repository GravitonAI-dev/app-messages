// Validador del repo de mensajes. Sin dependencias: node >= 20.
// Comprueba índice, catálogo de códigos, ficheros de mensaje, HTML admitido, acciones y variables.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SIZES, POSITIONS, BACKDROPS, PLAN_CODES, ACTIONS, VARIANTS,
  TONES, CORNER, TAGS, ATTRS, STYLE_PROPS, HOME_CONTAINERS, HOME_ACTIONS, HOME_ICONS,
  VARIABLE_RE, checkVariable,
} from './core/contract.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

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

// ---- Catálogo de códigos (codes.json) ---------------------------------------
// Para cada código de estado (telemetría, Gateway), qué mensaje se enseña y si
// bloquea. Ver docs/codigos-de-estado.md.
const CODE_KEY = /^(?:[A-Z][A-Z0-9_]*)(?:\.(?:[A-Z][A-Z0-9_]*|[a-z][a-z0-9_]*))*(?:\.\*)?$/;
const CODE_FIELDS = ['priority', 'block', 'recheck', 'message'];
if (!index.codes) fail('index.json', 'falta "codes" (la ruta de codes.json)');
else if (!existsSync(resolve(ROOT, index.codes))) fail('index.json', `"codes" apunta a ${index.codes}, que no existe`);
else validateCatalog(index.codes, readJson(index.codes));

function validateCatalog(where, catalog) {
  if (!catalog) return;
  if (catalog.schema_version !== 1) fail(where, 'schema_version debe ser 1');
  if (!catalog.codes || typeof catalog.codes !== 'object' || Array.isArray(catalog.codes)) { fail(where, 'falta "codes"'); return; }
  for (const [code, entry] of Object.entries(catalog.codes)) {
    if (!CODE_KEY.test(code)) fail(where, `código "${code}" inválido (SITUACIÓN.MOTIVO en mayúsculas; el último tramo puede ser * o un constraint del Gateway)`);
    validateCodeEntry(`${where} codes["${code}"]`, entry);
  }
  if (catalog.fallback !== null && catalog.fallback !== undefined) validateCodeEntry(`${where} fallback`, catalog.fallback);
}

function validateCodeEntry(where, entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { fail(where, 'debe ser un objeto'); return; }
  for (const k of Object.keys(entry)) if (!CODE_FIELDS.includes(k)) fail(where, `campo desconocido "${k}". Admitidos: ${CODE_FIELDS.join(', ')}`);
  if (typeof entry.block !== 'boolean') fail(where, 'block debe ser true o false');
  if (!(Number.isInteger(entry.priority) && entry.priority >= 0 && entry.priority <= 1000)) fail(where, 'priority debe ser un entero 0-1000');
  if ('recheck' in entry && typeof entry.recheck !== 'boolean') fail(where, 'recheck debe ser true o false');
  const ids = typeof entry.message === 'string' ? [entry.message]
    : entry.message && typeof entry.message === 'object' && !Array.isArray(entry.message) ? Object.values(entry.message) : null;
  if (!ids || ids.length === 0) { fail(where, 'message debe ser un id de mensaje o un objeto { plan_code: id, "*": id }'); return; }
  if (typeof entry.message === 'object') for (const plan of Object.keys(entry.message)) {
    if (plan !== '*' && !/^[a-z][a-z0-9_]*$/.test(plan)) fail(where, `message: plan "${plan}" inválido`);
  }
  for (const id of ids) if (!(id in index.messages)) fail(where, `message "${id}" no existe en index.json`);
}

function validateMessage(code, file) {
  const m = readJson(file);
  if (!m) return;
  const where = file;

  if (m.schema_version !== 1) fail(where, 'schema_version debe ser 1');
  if (m.id !== code) fail(where, `id "${m.id}" no coincide con el código del índice "${code}"`);
  if ('enabled' in m && typeof m.enabled !== 'boolean') fail(where, 'enabled debe ser true o false');

  // Qué mensaje sale y cuándo lo dice codes.json, no el mensaje.
  if ('when' in m) fail(where, '"when" ya no existe: cuándo sale un mensaje lo decide codes.json');

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
  if ('title' in m && !localized(m.title)) fail(where, 'title debe ser un texto no vacío o uno por idioma {"es": …, "en": …} con "es" (o no ponerlo: AppDialog sin cabecera)');
  if (corner && m.backdrop === 'blur') fail(where, 'un mensaje de esquina (AppBanner) no lleva blur');
  if (corner && !TONES.includes(m.tone)) fail(where, `los mensajes de esquina son un AppBanner y necesitan "tone" (${TONES.join(', ')})`);
  if ('tone' in m && !TONES.includes(m.tone)) fail(where, `tone "${m.tone}" inválido`);
  if ('actions' in m) {
    if (!Array.isArray(m.actions) || m.actions.length > 3) fail(where, 'actions debe ser una lista de 1 a 3 botones');
    else m.actions.forEach((a, i) => {
      if (!a || !localized(a.label)) fail(where, `actions[${i}]: falta label (un texto o uno por idioma con "es")`);
      if (!ACTIONS.includes(a.action)) fail(where, `actions[${i}]: acción "${a.action}" desconocida. Admitidas: ${ACTIONS.join(', ')}`);
      if (a.action === 'url' && !/^https:\/\//.test(a.url ?? '')) fail(where, `actions[${i}]: la acción url necesita "url" https://`);
      if (a.action !== 'url' && 'url' in a) fail(where, `actions[${i}]: "url" solo va con la acción url`);
      if (('plan' in a || 'interval' in a) && a.action !== 'checkout') fail(where, `actions[${i}]: "plan"/"interval" solo van con la acción checkout`);
      if ('plan' in a && !PLAN_CODES.includes(a.plan)) fail(where, `actions[${i}]: plan "${a.plan}" desconocido (plan_01, plan_02, plan_03)`);
      if ('interval' in a && !['month', 'year'].includes(a.interval)) fail(where, `actions[${i}]: interval "${a.interval}" inválido (month, year)`);
      if ('variant' in a && !VARIANTS.includes(a.variant)) fail(where, `actions[${i}]: variant "${a.variant}" inválido (${VARIANTS.join(', ')})`);
    });
    if (corner && m.actions.length > 1) fail(where, 'un AppBanner lleva como mucho un botón');
  }
  if ('footer_link' in m) {
    const l = m.footer_link;
    if (!l || !localized(l.label) || !ACTIONS.includes(l.action)) fail(where, 'footer_link necesita label (un texto o uno por idioma con "es") y una acción válida');
    else if (l.action === 'url' && !/^https:\/\//.test(l.url ?? '')) fail(where, 'footer_link con acción url necesita "url" https://');
    if (corner) fail(where, 'footer_link solo existe en los AppDialog (mensajes centrados)');
  }
  if (m.backdrop === 'blur' && m.dismissible === false && !(Array.isArray(m.actions) && m.actions.length)) fail(where, 'un bloqueante sin X necesita al menos un botón en actions');
  if (m.backdrop === 'blur' && m.dismissible === false && Array.isArray(m.actions) && m.actions.some((a) => a && a.action === 'dismiss')) fail(where, 'un bloqueante sin X no puede llevar un botón dismiss: solo se quita cuando deja de cumplirse su when');

  // variables de texto en title y en las etiquetas de botones/enlace
  const checkTextVars = (txt, what) => {
    for (const [lang, t] of byLang(txt)) checkVariables(where, `${what}${lang === '' ? '' : '.' + lang}`, String(t), { allowColors: false });
  };
  if (m.title) checkTextVars(m.title, 'title');
  (m.actions ?? []).forEach((a, i) => a && a.label && checkTextVars(a.label, `actions[${i}].label`));
  if (m.footer_link && m.footer_link.label) checkTextVars(m.footer_link.label, 'footer_link.label');

  // El cuerpo: un fichero (o HTML en línea), o uno por idioma con "es".
  if (m.html_file !== undefined) {
    if (!localized(m.html_file)) { fail(where, 'html_file debe ser un fichero o uno por idioma {"es": …, "en": …} con "es"'); return; }
    for (const [lang, file] of byLang(m.html_file)) {
      const htmlPath = resolve(ROOT, 'messages', file);
      if (!existsSync(htmlPath)) fail(where, `html_file${lang ? '.' + lang : ''} "${file}" no existe en messages/`);
      else validateHtml(`messages/${file}`, readFileSync(htmlPath, 'utf8'));
    }
  } else if (localized(m.html)) {
    for (const [lang, html] of byLang(m.html)) validateHtml(`messages/${m.id}.json#html${lang ? '.' + lang : ''}`, html);
  } else fail(where, 'falta html_file (o html en línea)');
}

// Un texto de un mensaje: una cadena, o un objeto por idioma con "es" (como la
// portada). Si falta el idioma de la app, se usa "es".
function localized(value) {
  if (typeof value === 'string') return value.trim() !== '';
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return typeof value.es === 'string' && Object.entries(value).every(([k, v]) => /^[a-z]{2}$/.test(k) && typeof v === 'string' && v.trim() !== '');
}

/** [[idioma, texto]]; '' como idioma para una cadena sin idiomas. */
function byLang(value) {
  return typeof value === 'string' ? [['', value]] : Object.entries(value ?? {});
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

  checkVariables(where, 'HTML', body, { allowColors: true });
}

// Cada {{…}} del texto tiene que ser una variable conocida con filtros válidos;
// unas llaves que no encajan con la sintaxis también son un error.
function checkVariables(where, what, text, options) {
  for (const v of text.matchAll(VARIABLE_RE)) for (const p of checkVariable(v[1], v[2], options)) fail(where, `${what}: ${p}`);
  const rest = text.replace(VARIABLE_RE, '');
  for (const bad of rest.matchAll(/\{\{[^}]*\}\}/g)) fail(where, `${what}: variable mal escrita ${bad[0]}`);
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

// ---- Portada: los dos contenedores fijos (home/*.json) -----------------------
// Están siempre en la pantalla de inicio (salvo `enabled: false`); lo que
// cambia es su contenido: una lista ordenada de bloques, cada uno con su
// `type` y su `enabled`. Son datos, no HTML: los pinta la app con sus
// componentes. Cada texto es un objeto por idioma con "es" obligatorio.
const BLOCKS = {
  brand: () => {},
  label: validateTextBlock,
  headline: validateTextBlock,
  text: (where, b) => { if ('title' in b) validateText(`${where}.title`, b.title); validateTextBlock(where, b); },
  actions: validateActionsBlock,
  features: validateFeaturesBlock,
  legal: validateLegalBlock,
  news: validateNewsBlock,
  banner: validateBannerBlock,
};
if ('home' in index) {
  if (!index.home || typeof index.home !== 'object') fail('index.json', '"home" debe ser un objeto');
  else for (const [key, file] of Object.entries(index.home)) {
    if (!HOME_CONTAINERS.includes(key)) { fail('index.json', `home: contenedor desconocido "${key}". Admitidos: ${HOME_CONTAINERS.join(', ')}`); continue; }
    if (!existsSync(resolve(ROOT, file))) { fail('index.json', `home.${key} apunta a ${file}, que no existe`); continue; }
    const doc = readJson(file);
    if (!doc) continue;
    if (doc.schema_version !== 1) fail(file, 'schema_version debe ser 1');
    if ('enabled' in doc && typeof doc.enabled !== 'boolean') fail(file, 'enabled debe ser true o false');
    if (!Array.isArray(doc.blocks) || doc.blocks.length === 0) { fail(file, '"blocks" debe ser una lista con al menos un bloque'); continue; }
    doc.blocks.forEach((b, i) => {
      const where = `${file} blocks[${i}]`;
      if (!b || typeof b !== 'object') { fail(where, 'debe ser un objeto'); return; }
      if (!(b.type in BLOCKS)) { fail(where, `type "${b.type}" desconocido. Admitidos: ${Object.keys(BLOCKS).join(', ')}`); return; }
      if ('enabled' in b && typeof b.enabled !== 'boolean') fail(where, 'enabled debe ser true o false');
      BLOCKS[b.type](where, b);
    });
  }
}

function validateText(where, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) { fail(where, 'debe ser un objeto por idioma, p. ej. {"es": "…", "en": "…"}'); return; }
  if (typeof value.es !== 'string' || !value.es.trim()) fail(where, 'falta el texto en "es"');
  for (const [lang, text] of Object.entries(value)) {
    if (!/^[a-z]{2}$/.test(lang)) fail(where, `idioma "${lang}" inválido (dos letras minúsculas)`);
    if (typeof text !== 'string' || !text.trim()) fail(where, `texto vacío en "${lang}"`);
  }
}

function validateTextBlock(where, b) { validateText(`${where}.text`, b.text); }

function validateActionsBlock(where, b) {
  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 4) { fail(where, '"items" debe tener entre 1 y 4 botones'); return; }
  b.items.forEach((a, i) => {
    const w = `${where}.items[${i}]`;
    validateText(`${w}.label`, a.label);
    if (!HOME_ACTIONS.includes(a.action)) fail(w, `action "${a.action}" desconocida. Admitidas: ${HOME_ACTIONS.join(', ')}`);
    if (a.action === 'url' && !(typeof a.url === 'string' && /^https:\/\//.test(a.url))) fail(w, 'action url necesita "url" https://');
    if (a.action !== 'url' && 'url' in a) fail(w, 'sólo action url lleva "url"');
    if ('variant' in a && !['primary', 'secondary'].includes(a.variant)) fail(w, `variant "${a.variant}" inválido (primary, secondary)`);
    if ('icon' in a && !HOME_ICONS.includes(a.icon)) fail(w, `icon "${a.icon}" desconocido. Admitidos: ${HOME_ICONS.join(', ')}`);
  });
}

function validateFeaturesBlock(where, b) {
  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 8) { fail(where, '"items" debe tener entre 1 y 8 argumentos'); return; }
  b.items.forEach((it, i) => {
    const w = `${where}.items[${i}]`;
    if (typeof it.number !== 'string' || !it.number.trim()) fail(w, 'falta "number"');
    validateText(`${w}.title`, it.title);
    validateText(`${w}.subtitle`, it.subtitle);
  });
}

// Un texto con huecos {nombre} y un enlace https por hueco; cada hueco del
// texto tiene que tener su enlace y viceversa.
function validateLegalBlock(where, b) {
  validateText(`${where}.text`, b.text);
  const links = b.links && typeof b.links === 'object' ? b.links : {};
  if (!b.links || typeof b.links !== 'object') fail(where, 'falta "links"');
  for (const [name, link] of Object.entries(links)) {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) fail(where, `links: nombre "${name}" inválido (minúsculas, números y _)`);
    if (!link || typeof link !== 'object') { fail(where, `links.${name} debe ser un objeto con "label" y "url"`); continue; }
    validateText(`${where}.links.${name}.label`, link.label);
    if (typeof link.url !== 'string' || !/^https:\/\//.test(link.url)) fail(where, `links.${name}.url debe ser https://`);
  }
  if (b.text && typeof b.text === 'object') {
    for (const [lang, text] of Object.entries(b.text)) {
      if (typeof text !== 'string') continue;
      const used = [...text.matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1]);
      for (const u of used) if (!(u in links)) fail(where, `text.${lang} usa {${u}} y no hay links.${u}`);
      for (const l of Object.keys(links)) if (!used.includes(l)) fail(where, `text.${lang} no usa {${l}} y links.${l} existe`);
    }
  }
}

function validateNewsBlock(where, b) {
  validateText(`${where}.title`, b.title);
  for (const k of ['label', 'intro']) if (k in b) validateText(`${where}.${k}`, b[k]);
  if (!Array.isArray(b.sections) || b.sections.length === 0) { fail(where, '"sections" debe tener al menos una sección'); return; }
  b.sections.forEach((s, i) => {
    const w = `${where}.sections[${i}]`;
    validateText(`${w}.title`, s.title);
    if (!Array.isArray(s.items) || s.items.length === 0) { fail(w, '"items" debe tener al menos un cambio'); return; }
    s.items.forEach((t, j) => validateText(`${w}.items[${j}]`, t));
  });
}

function validateBannerBlock(where, b) {
  validateText(`${where}.text`, b.text);
  if ('icon' in b && !HOME_ICONS.includes(b.icon)) fail(where, `icon "${b.icon}" desconocido. Admitidos: ${HOME_ICONS.join(', ')}`);
  if ('tone' in b && !TONES.includes(b.tone)) fail(where, `tone "${b.tone}" inválido (${TONES.join(', ')})`);
}

finish();

function finish() {
  if (errors.length) {
    console.error(`✗ ${errors.length} error(es):\n` + errors.map((e) => '  - ' + e).join('\n'));
    process.exit(1);
  }
  const n = Object.keys(index?.messages ?? {}).length;
  const h = Object.keys(index?.home ?? {}).length;
  console.log(`✓ ${n} mensaje(s) válidos` + (h ? ` · ${h} contenedor(es) de portada` : ''));
  process.exit(0);
}
