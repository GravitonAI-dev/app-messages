// Evaluador de referencia: dado un contexto de cuenta, dice qué mensajes se muestran y en qué orden.
// Es la semántica que la app debe reproducir. Uso: node scripts/evaluate.mjs fixtures/contexts/expired.json
// La lógica vive en core/evaluate.mjs; aquí sólo se leen los ficheros del repo.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateMessages } from './core/evaluate.mjs';

export { matches, whenMatches } from './core/evaluate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(readFileSync(resolve(ROOT, f), 'utf8'));

/** Mensajes visibles para un contexto, ya ordenados. `dismissed` = ids cerrados en local. */
export function evaluate(context, { dismissed = [] } = {}) {
  const messages = Object.values(read('index.json').messages).map(read);
  const { shown, ...result } = evaluateMessages(messages, context, { dismissed });
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error('uso: node scripts/evaluate.mjs <contexto.json>'); process.exit(2); }
  const ctx = read(file);
  console.log(JSON.stringify(evaluate(ctx.context, { dismissed: ctx.dismissed ?? [] }), null, 2));
}
