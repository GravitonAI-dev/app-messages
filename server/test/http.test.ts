import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { AccountPort } from '../src/application/ports/account.port';
import { ContentPort } from '../src/application/ports/content.port';
import { TokenVerifierPort } from '../src/application/ports/token-verifier.port';
import { FsContentStore } from '../src/infrastructure/adapters/fs-content-store.adapter';
import { FakeAccount, FakeVerifier, REPO, fixtures, upstreamFor } from './helpers';

let app: INestApplication;
let base: string;
const account = new FakeAccount();

before(async () => {
  const expired = fixtures().find((f) => f.file === 'expired.json')!;
  const { info, usage } = upstreamFor(expired.context);
  account.info = info;
  account.usageResp = usage;

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ContentPort)
    .useValue(await FsContentStore.load(REPO))
    .overrideProvider(AccountPort)
    .useValue(account)
    .overrideProvider(TokenVerifierPort)
    .useValue(new FakeVerifier())
    .compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  base = await app.getUrl();
  base = base.replace('[::1]', 'localhost');
});

after(() => app.close());

const post = (body: unknown, token?: string) =>
  fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body),
  });

test('/raw sirve el repo tal cual con ETag y 304', async () => {
  const res = await fetch(`${base}/raw/index.json`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type')!, /application\/json; charset=utf-8/);
  const etag = res.headers.get('etag')!;
  assert.ok((await res.json()).messages.trial_expired);
  assert.equal((await fetch(`${base}/raw/index.json`, { headers: { 'if-none-match': etag } })).status, 304);
  assert.equal((await fetch(`${base}/raw/package.json`)).status, 404);
  assert.equal((await fetch(`${base}/raw/messages/trial_expired.html`)).headers.get('content-type'), 'text/html; charset=utf-8');
});

test('/v1/messages sin token o con uno malo: 401', async () => {
  assert.equal((await post({})).status, 401);
  assert.equal((await post({}, 'bad')).status, 401);
});

test('/v1/messages evalúa, pone variables y reenvía el token', async () => {
  const res = await post({ lang: 'es', app: { version: '1.4.2', platform: 'macos' }, vars: { 'user.name': 'pirata' } }, 'good-token');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(account.lastToken, 'good-token');
  assert.deepEqual(body.visible_now, ['trial_expired']);
  assert.deepEqual(body.sources, { billing: 'ok', telemetry: 'ok' });
  const m = body.messages[0];
  assert.equal(m.id, 'trial_expired');
  assert.deepEqual(m.when, { 'usage.payment_status': 'expired', 'membership.plan_code': 'free_plan' });
  assert.equal(m.actions[0].label, 'Activar Confidential');
  assert.match(m.html, /Plan Confidential/);
  assert.match(m.html, /\{\{c\.brandPrimary\}\}/);
  assert.doesNotMatch(m.html, /raw\.githubusercontent\.com/);
  assert.match(m.html, /\/raw\/assets\/logo\.png/);
});

test('/v1/messages con billing caído responde igual, sin sus campos', async () => {
  const saved = account.info;
  account.info = new Error('caído');
  try {
    const body = await (await post({}, 'good-token')).json();
    assert.equal(body.sources.billing, 'error');
    assert.equal(body.forced_block, true); // telemetría sigue diciendo expired
  } finally {
    account.info = saved;
  }
});

test('/v1/home resuelve el idioma', async () => {
  const body = await (await fetch(`${base}/v1/home?lang=en`)).json();
  const headline = body.home.portada_centro.blocks.find((b: any) => b.type === 'headline');
  assert.equal(typeof headline.text, 'string');
});
