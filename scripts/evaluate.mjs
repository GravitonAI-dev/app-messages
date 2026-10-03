// Evaluador de referencia: dado un contexto de cuenta, dice qué mensajes se muestran y en qué orden.
// Es la semántica que la app debe reproducir. Uso: node scripts/evaluate.mjs fixtures/contexts/expired.json
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(readFileSync(resolve(ROOT, f), 'utf8'));

/** Una condición sobre un valor del contexto. Valor directo = igualdad; objeto = operadores. */
export function matches(value, cond) {
  if (cond === null || typeof cond !== 'object' || Array.isArray(cond)) return value === cond;
  for (const [op, expected] of Object.entries(cond)) {
    switch (op) {
      case 'eq': if (value !== expected) return false; break;
      case 'neq': if (value === expected) return false; break;
      case 'gt': if (typeof value !== 'number' || !(value > expected)) return false; break;
      case 'gte': if (typeof value !== 'number' || !(value >= expected)) return false; break;
      case 'lt': if (typeof value !== 'number' || !(value < expected)) return false; break;
      case 'lte': if (typeof value !== 'number' || !(value <= expected)) return false; break;
      case 'in': if (!Array.isArray(expected) || !expected.includes(value)) return false; break;
      case 'exists': if ((value !== undefined && value !== null) !== expected) return false; break;
      default: return false; // operador desconocido: el mensaje no se muestra
    }
  }
  return true;
}

/** Todas las claves de `when` deben cumplirse. Un campo ausente en el contexto vale undefined. */
export function whenMatches(when, context) {
  return Object.entries(when).every(([field, cond]) => matches(context[field], cond));
}

/** Mensajes visibles para un contexto, ya ordenados. `dismissed` = ids cerrados en local. */
export function evaluate(context, { dismissed = [] } = {}) {
  const index = read('index.json');
  const shown = [];
  for (const file of Object.values(index.messages)) {
    const m = read(file);
    if (m.enabled === false) continue;
    if (!whenMatches(m.when, context)) continue;
    if (!m.persistent && dismissed.includes(m.id)) continue;
    shown.push(m);
  }
  shown.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  // Regla fija de la app: expired → blur bloqueante siempre, aunque plan_expired no esté en el repo.
  const forcedBlock = context['usage.payment_status'] === 'expired';
  const blocking = shown.find((m) => m.backdrop === 'blur' && !m.dismissible);
  return {
    forced_block: forcedBlock,
    visible_now: blocking ? [blocking.id] : shown.filter((m) => m.backdrop !== 'blur').map((m) => m.id).concat(shown.filter((m) => m.backdrop === 'blur').slice(0, 1).map((m) => m.id)),
    queue: shown.map((m) => m.id),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error('uso: node scripts/evaluate.mjs <contexto.json>'); process.exit(2); }
  const ctx = read(file);
  console.log(JSON.stringify(evaluate(ctx.context, { dismissed: ctx.dismissed ?? [] }), null, 2));
}
