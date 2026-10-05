// La semántica del servicio es la del evaluador de referencia: cada contexto
// de fixtures/contexts, servido como respuestas de billing y telemetría, da
// el mismo resultado esperado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GetMessagesUseCase } from '../src/application/use-cases/get-messages.use-case';
import { FsContentStore } from '../src/infrastructure/adapters/fs-content-store.adapter';
import { buildContext } from '../src/core/account-context';
import { FakeAccount, REPO, fixtures, upstreamFor } from './helpers';

for (const fx of fixtures()) {
  test(`fixture ${fx.file}`, async () => {
    const { usage, info, now } = upstreamFor(fx.context);
    const app = { version: fx.context['app.version'], platform: fx.context['app.platform'] };

    // El contexto que construye el servicio es el del fixture (hours_since_start
    // sólo cuando el fixture no fija también days_left: no siempre casan).
    const ctx = buildContext({ usage, info, app }, now);
    const expected = { ...fx.context };
    if (expected['membership.days_left'] != null) {
      delete expected['membership.hours_since_start'];
      delete ctx['membership.hours_since_start'];
    }
    for (const k of ['membership.created_at', 'membership.expires_at']) {
      if (expected[k]) expected[k] = new Date(expected[k]).toISOString();
    }
    assert.deepEqual(ctx, expected);

    const content = await FsContentStore.load(REPO);
    const useCase = new GetMessagesUseCase(content, new FakeAccount(info, usage));
    const out = await useCase.execute({
      user: { uid: 'uid-1' },
      idToken: 't',
      lang: 'es',
      timeZone: 'Europe/Madrid',
      app,
      dismissed: fx.dismissed ?? [],
      vars: {},
      now,
    });
    assert.deepEqual({ forced_block: out.forced_block, visible_now: out.visible_now, queue: out.queue }, fx.expected);
    assert.deepEqual(out.messages.map((m) => m.id), fx.expected.queue);
  });
}
