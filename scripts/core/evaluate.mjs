// Semántica del catálogo de códigos (codes.json), sin leer ficheros: la
// comparten el evaluador de referencia (scripts/evaluate.mjs), el validador y
// la app, que la reproduce en Dart. Ver docs/codigos-de-estado.md.
//
// Telemetría y el Gateway dicen QUÉ ha pasado (códigos); el catálogo dice qué
// mensaje se enseña y si bloquea. Aquí sólo se busca en una tabla: nada de
// condiciones ni de fechas.

/** La entrada del catálogo para [code]: la exacta, después el comodín más largo (`A.B.*`, `A.*`), después `fallback`. */
export function lookupCode(catalog, code) {
  const codes = catalog?.codes ?? {};
  if (code in codes) return codes[code];
  const parts = code.split('.');
  for (let i = parts.length - 1; i > 0; i--) {
    const wildcard = `${parts.slice(0, i).join('.')}.*`;
    if (wildcard in codes) return codes[wildcard];
  }
  return catalog?.fallback ?? null;
}

/** El id de mensaje de [entry] para [params]: un id fijo, o la variante de `params.plan_code` (o `*`). */
export function messageIdFor(entry, params = {}) {
  const m = entry?.message;
  if (typeof m === 'string') return m;
  if (m && typeof m === 'object') return m[params.plan_code] ?? m['*'] ?? null;
  return null;
}

/**
 * Lo que se ve para unos códigos. [messages] son los JSON de los mensajes por
 * id; [codes], `{ code, params }`; `dismissed`, ids cerrados en local.
 *
 * - `block`: alguna entrada bloquea (aunque su mensaje no exista: la app pone
 *   entonces su muro por defecto).
 * - `queue`: los mensajes que tocan, de mayor a menor prioridad (a igual, por
 *   id), sin repetir y sin los no persistentes ya cerrados.
 * - `visible_now`: con uno que bloquea, sólo él; si no, los que no tapan la
 *   app y el primero de los que la tapan.
 * - `resolved`: por mensaje de la cola, el código que lo trae y sus `params`
 *   (las variables del mensaje salen de ahí).
 */
export function resolveCodes(catalog, messages, codes, { dismissed = [] } = {}) {
  const byMessage = new Map();
  let block = false;
  let recheck = false;

  for (const { code, params = {} } of codes ?? []) {
    const entry = lookupCode(catalog, code);
    if (!entry) continue;
    if (entry.block === true) block = true;
    if (entry.recheck === true) recheck = true;
    const id = messageIdFor(entry, params);
    const message = id ? messages[id] : null;
    if (!message || message.enabled === false) continue;
    if (!message.persistent && dismissed.includes(id)) continue;
    const priority = Number.isInteger(entry.priority) ? entry.priority : 0;
    const current = byMessage.get(id);
    if (!current || priority > current.priority) {
      byMessage.set(id, { id, code, params, priority, block: entry.block === true, message });
    }
  }

  const resolved = [...byMessage.values()].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const blocking = resolved.find((r) => r.block);
  const visible = blocking
    ? [blocking]
    : [...resolved.filter((r) => r.message.backdrop !== 'blur'), ...resolved.filter((r) => r.message.backdrop === 'blur').slice(0, 1)];

  return {
    block,
    recheck,
    visible_now: visible.map((r) => r.id),
    queue: resolved.map((r) => r.id),
    resolved: resolved.map(({ message, ...r }) => r),
  };
}
