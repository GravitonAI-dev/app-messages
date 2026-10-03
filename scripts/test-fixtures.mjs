// Comprueba que cada contexto de fixtures/contexts produce el resultado esperado.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate } from './evaluate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(ROOT, 'fixtures/contexts');
let failures = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const fx = JSON.parse(readFileSync(resolve(dir, f), 'utf8'));
  const got = evaluate(fx.context, { dismissed: fx.dismissed ?? [] });
  const ok = JSON.stringify(got) === JSON.stringify(fx.expected);
  console.log(`${ok ? '✓' : '✗'} ${f}: ${fx.description}`);
  if (!ok) { failures++; console.log('   esperado:', JSON.stringify(fx.expected)); console.log('   obtenido:', JSON.stringify(got)); }
}
process.exit(failures ? 1 : 0);
