import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ContentPort } from '../src/application/ports/content.port';
import { FsContentStore } from '../src/infrastructure/adapters/fs-content-store.adapter';
import { REPO } from './helpers';

let app: INestApplication;
let base: string;

before(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ContentPort)
    .useValue(await FsContentStore.load(REPO))
    .compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  base = (await app.getUrl()).replace('[::1]', 'localhost');
});

after(() => app.close());

test('/raw sirve el repo tal cual con ETag y 304', async () => {
  const res = await fetch(`${base}/raw/index.json`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type')!, /application\/json; charset=utf-8/);
  const etag = res.headers.get('etag')!;
  const index = await res.json();
  assert.equal(index.codes, 'codes.json');
  assert.ok(index.messages.trial_expired);
  assert.equal((await fetch(`${base}/raw/index.json`, { headers: { 'if-none-match': etag } })).status, 304);
  assert.equal((await fetch(`${base}/raw/package.json`)).status, 404);
  assert.equal((await fetch(`${base}/raw/messages/trial_expired.html`)).headers.get('content-type'), 'text/html; charset=utf-8');
});

test('/raw/codes.json publica el catálogo de códigos', async () => {
  const res = await fetch(`${base}/raw/codes.json`);
  assert.equal(res.status, 200);
  const catalog = await res.json();
  assert.equal(catalog.codes['PLAN_EXPIRED.DAYS_LIMIT_REACHED'].block, true);
});

test('/v1/messages ya no existe: la app busca los códigos en codes.json', async () => {
  assert.equal((await fetch(`${base}/v1/messages`, { method: 'POST' })).status, 404);
});

test('/v1/home resuelve el idioma', async () => {
  const body = await (await fetch(`${base}/v1/home?lang=en`)).json();
  const headline = body.home.portada_centro.blocks.find((b: any) => b.type === 'headline');
  assert.equal(typeof headline.text, 'string');
});

test('una recarga con un codes.json roto falla y se sigue sirviendo el contenido anterior', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'app-messages-'));
  try {
    for (const f of ['index.json', 'codes.json', 'messages', 'home']) cpSync(join(REPO, f), join(dir, f), { recursive: true });
    const store = await FsContentStore.load(dir);
    const version = store.version;
    writeFileSync(join(dir, 'codes.json'), '{ roto');
    await assert.rejects(store.reload());
    assert.equal(store.version, version);
    assert.ok(store.file('codes.json'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
