// Evaluador de referencia: dados unos códigos de estado, dice qué mensajes se
// muestran, en qué orden y si la app se bloquea. Es la semántica que la app
// debe reproducir. Uso: node scripts/evaluate.mjs fixtures/codes/trial_expired.json
// La lógica vive en core/evaluate.mjs; aquí sólo se leen los ficheros del repo.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCodes } from './core/evaluate.mjs';

export { lookupCode, messageIdFor, resolveCodes } from './core/evaluate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(readFileSync(resolve(ROOT, f), 'utf8'));

/** El catálogo y los mensajes del repo. */
export function loadRepo() {
  const index = read('index.json');
  const messages = Object.fromEntries(Object.entries(index.messages).map(([id, file]) => [id, read(file)]));
  return { catalog: read(index.codes ?? 'codes.json'), messages };
}

/** Lo que se ve para [codes]; `dismissed` = ids cerrados en local. */
export function evaluate(codes, { dismissed = [] } = {}) {
  const { catalog, messages } = loadRepo();
  const { block, visible_now, queue } = resolveCodes(catalog, messages, codes, { dismissed });
  return { block, visible_now, queue };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error('uso: node scripts/evaluate.mjs <fixture.json>'); process.exit(2); }
  const fx = read(file);
  console.log(JSON.stringify(evaluate(fx.codes, { dismissed: fx.dismissed ?? [] }), null, 2));
}
