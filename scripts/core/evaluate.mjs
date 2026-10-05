// Semántica de los mensajes, sin leer ficheros: la comparten el evaluador de
// referencia (scripts/evaluate.mjs) y el microservicio (server/).

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

/**
 * Los mensajes que tocan para un contexto, ya ordenados. [messages] son los
 * JSON del repo; `dismissed` = ids cerrados en local. Además de los ids
 * devuelve `shown`, los propios mensajes en el orden de `queue`.
 */
export function evaluateMessages(messages, context, { dismissed = [] } = {}) {
  const shown = [];
  for (const m of messages) {
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
    shown,
  };
}
