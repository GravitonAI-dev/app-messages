import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { basename, join } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { envFilesFor } from '../src/load-env';

// De mayor a menor prioridad: proceso > .env.<APP_ENV> > .env > .env.prod.
let dir: string;
const write = (name: string, body = '') => writeFileSync(join(dir, name), body);
const names = (files: string[]) => files.map((f) => basename(f));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'app-messages-env-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

test('servidor: .env y, por debajo, .env.prod', () => {
  write('.env');
  write('.env.prod');
  assert.deepEqual(names(envFilesFor(dir, '')), ['.env', '.env.prod']);
});

test('solo los que existen (la imagen no lleva ninguno)', () => {
  assert.deepEqual(envFilesFor(dir, ''), []);
});

test('el perfil elegido va el primero', () => {
  write('.env');
  write('.env.prod.local');
  assert.deepEqual(names(envFilesFor(dir, 'prod.local')), ['.env.prod.local', '.env']);
});

test('un perfil desconocido corta el arranque', () => {
  assert.throws(() => envFilesFor(dir, 'local'), /APP_ENV="local"/);
});

test('con dotenv: el perfil gana a .env, .env a .env.prod y el proceso a todos', () => {
  write('.env.prod', 'A=prod\nB=prod\nC=prod\nD=prod\n');
  write('.env', 'A=env\nB=env\nC=env\n');
  write('.env.prod.local', 'A=local\nB=local\n');
  const target: Record<string, string> = { A: 'process' };

  dotenvConfig({ path: envFilesFor(dir, 'prod.local'), processEnv: target, quiet: true });

  assert.deepEqual(target, { A: 'process', B: 'local', C: 'env', D: 'prod' });
});
