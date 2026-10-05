import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientVars, renderText, type RenderScope } from '../src/core/render';
import { sanitizeMessageHtml } from '../src/core/sanitize';
import { resolveLang } from '../src/core/i18n';

const scope = (values: Record<string, unknown>, lang = 'es'): RenderScope => ({ values, lang, timeZone: 'Europe/Madrid' });

test('escapa en HTML y no en texto plano', () => {
  const s = scope({ 'user.name': 'Ana <b>&' });
  assert.equal(renderText('Hola {{user.name}}', s, { html: true }), 'Hola Ana &lt;b&gt;&amp;');
  assert.equal(renderText('Hola {{user.name}}', s, { html: false }), 'Hola Ana <b>&');
});

test('alias de antes de los espacios de nombre', () => {
  const s = scope({ 'user.name': 'Ana', 'membership.plan_name': 'Trial', 'membership.expires_at': '2026-10-02T10:00:00Z', 'membership.days_left': -1, 'usage.usage_percentage': 87.6 });
  assert.equal(
    renderText('{{user_name}}|{{plan_name}}|{{plan_end_date}}|{{days_left}}|{{usage_percentage}}', s, { html: false }),
    'Ana|Trial|2 de octubre de 2026|-1|88',
  );
});

test('filtros', () => {
  const s = scope({ d: '2026-10-02T23:30:00Z', n: 1234.567, p: 87.5, t: 'hola' });
  const r = (t: string, sc = s) => renderText(t, sc, { html: false });
  assert.equal(r('{{d | date:long}}'), '3 de octubre de 2026'); // Madrid: ya es día 3
  assert.equal(r('{{d|date:short}}'), '03/10/2026');
  assert.equal(r('{{n | number:2}}'), '1234,57');
  assert.equal(r('{{p | percent}}'), '88 %');
  assert.equal(r('{{t | upper}}'), 'HOLA');
  assert.equal(r('{{nada | default:"amigo"}}'), 'amigo');
  assert.equal(r('{{d | date:long}}', scope({ d: '2026-10-02T10:00:00Z' }, 'en')), 'October 2, 2026');
});

test('lo desconocido sale como «—» y los colores se quedan para la app', () => {
  assert.equal(renderText('{{user.name}} {{c.textPrimary}}', scope({}), { html: true }), '— {{c.textPrimary}}');
});

test('la app solo puede mandar app.*', () => {
  assert.deepEqual(clientVars({ 'app.theme': 'dark', 'app.n': 3, 'user.name': 'x', 'membership.days_left': 99, 'app.obj': {} }), {
    'app.theme': 'dark',
    'app.n': '3',
  });
  assert.deepEqual(clientVars('nope'), {});
});

test('la limpieza quita lo peligroso y conserva el diseño', () => {
  const html =
    '<p style="color:{{c.textPrimary}};text-transform:uppercase;position:fixed" onclick="x()">Hola<script>alert(1)</script></p>' +
    '<img src="http://x/a.png"><img src="https://x/b.png" width="30"><a href="javascript:alert(1)">a</a>' +
    '<span style="background:url(https://evil)">b</span><iframe src="https://x"></iframe><table><tr><td>c</td></tr></table>';
  const out = sanitizeMessageHtml(html);
  assert.match(out, /<p style="color:\{\{c\.textPrimary\}\};text-transform:uppercase">Hola<\/p>/);
  assert.doesNotMatch(out, /script|onclick|javascript|iframe|http:\/\/|url\(/);
  assert.match(out, /<img src="https:\/\/x\/b.png" width="30" \/>/);
  assert.equal(out.match(/<img/g)?.length, 1);
  assert.match(out, /<td>c<\/td>/);
});

test('textos por idioma de la portada', () => {
  const home = { blocks: [{ type: 'headline', text: { es: 'Hola', en: 'Hello' } }, { type: 'legal', links: { tc: { label: { es: 'T' }, url: 'https://x' } } }] };
  assert.deepEqual(resolveLang(home, 'en'), { blocks: [{ type: 'headline', text: 'Hello' }, { type: 'legal', links: { tc: { label: 'T', url: 'https://x' } } }] });
  assert.equal(resolveLang({ es: 'Hola' }, 'fr'), 'Hola');
});
