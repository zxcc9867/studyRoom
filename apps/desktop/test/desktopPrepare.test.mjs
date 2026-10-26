import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';

const module = await import('../scripts/prepare.mjs').catch(() => ({}));
const key = role => `e30.${Buffer.from(JSON.stringify({ role, iss: 'supabase' })).toString('base64url')}.signature`;
const env = { VITE_SUPABASE_URL: 'https://project.supabase.co', VITE_SUPABASE_ANON_KEY: key('anon') };

test('public config admits only HTTPS URL and public anon or publishable key', () => {
  assert.equal(typeof module.publicConfig, 'function', 'desktop preparation feature must exist');
  assert.deepEqual(module.publicConfig({ ...env, SECRET: 'not-copied' }), {
    origin: 'https://study-room-attendance.vercel.app', supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY,
  });
  assert.ok(module.publicConfig({ ...env, VITE_SUPABASE_ANON_KEY: 'sb_publishable_abcdefghijklmnop' }));
  for (const input of [key('service_role'), 'sb_secret_abcdefghijklmnop', 'random-secret', '', key('authenticated')]) {
    assert.throws(() => module.publicConfig({ ...env, VITE_SUPABASE_ANON_KEY: input }), /INVALID_PUBLIC_CONFIG/);
  }
  for (const url of ['http://project.supabase.co', 'https://u:secret@project.supabase.co', 'https://project.supabase.co/path', 'https://project.supabase.co#secret']) {
    assert.throws(() => module.publicConfig({ ...env, VITE_SUPABASE_URL: url }), /INVALID_PUBLIC_CONFIG/);
  }
});

test('prepare copies existing PNG byte-for-byte and writes only public config from explicit env file', async () => {
  assert.equal(typeof module.prepareDesktop, 'function', 'desktop preparation feature must exist');
  const root = await mkdtemp(path.join(tmpdir(), 'study-desktop-prepare-'));
  try {
    const envFile = path.join(root, 'private.env');
    await writeFile(envFile, `VITE_SUPABASE_URL=${env.VITE_SUPABASE_URL}\nVITE_SUPABASE_ANON_KEY=${env.VITE_SUPABASE_ANON_KEY}\nPRIVATE_SERVER_KEY=must-never-copy\n`);
    const icon = fileURLToPath(new URL('../../mobile/assets/study-room-icon.png', import.meta.url));
    await module.prepareDesktop({ output: path.join(root, 'resources'), envFile, env: {}, icon });
    const config = JSON.parse(await readFile(path.join(root, 'resources/public-config.json'), 'utf8'));
    assert.deepEqual(Object.keys(config), ['origin', 'supabaseUrl', 'supabaseAnonKey']);
    assert.equal(JSON.stringify(config).includes('must-never-copy'), false);
    const digest = value => createHash('sha256').update(value).digest('hex');
    assert.equal(digest(await readFile(path.join(root, 'resources/study-room-icon.png'))), digest(await readFile(icon)));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('preload exposes only the narrow bridge to trusted top-level documents', async () => {
  const vm = await import('node:vm');
  const source = await readFile(new URL('../preload.cjs', import.meta.url), 'utf8').catch(() => null);
  assert.ok(source, 'desktop preload feature must exist');
  const exposed = [];
  const callbacks = new Map();
  function execute(top, origin, argv = []) {
    const context = { process: { isMainFrame: top, argv }, location: { origin },
      require: name => { assert.equal(name, 'electron'); return {
        contextBridge: { exposeInMainWorld: (name, value) => { exposed.push({ name, value }); } },
        ipcRenderer: { invoke: async (channel, request) => ({ channel, request }),
          on: (channel, fn) => callbacks.set(channel, fn), removeListener: (channel, fn) => { if (callbacks.get(channel) === fn) callbacks.delete(channel); } },
      }; } };
    vm.runInNewContext(source, context);
  }
  execute(false, 'https://study-room-attendance.vercel.app');
  execute(true, 'https://evil.test');
  assert.equal(exposed.length, 0);
  execute(true, 'https://study-room-attendance.vercel.app');
  assert.equal(exposed.length, 1);
  assert.equal(exposed[0].name, 'studyRoomDesktop');
  assert.deepEqual(Object.keys(exposed[0].value), ['protocolVersion', 'request', 'onEvent']);
  assert.equal(exposed[0].value.protocolVersion, 1);
  let value;
  const unsubscribe = exposed[0].value.onEvent(event => { value = event; });
  callbacks.get('study-room-desktop:event')({ sender: 'must not escape' }, { type: 'auth-changed' });
  assert.deepEqual(value, { type: 'auth-changed' });
  unsubscribe(); assert.equal(callbacks.size, 0);
});

test('disk adapter bounds key-derived paths and atomically replaces ciphertext only', async () => {
  const main = await import('../main.cjs').catch(() => ({}));
  assert.equal(typeof main.createStorageIO, 'function', 'desktop main storage feature must exist');
  const root = await mkdtemp(path.join(tmpdir(), 'study-desktop-storage-'));
  try {
    const io = main.createStorageIO(root);
    await io.write('../../private/token', Buffer.from([1, 2, 3]));
    assert.deepEqual(await io.read('../../private/token'), Buffer.from([1, 2, 3]));
    await io.write('../../private/token', Buffer.from([4, 5]));
    assert.deepEqual(await io.read('../../private/token'), Buffer.from([4, 5]));
    await assert.rejects(io.write('key', 'plaintext'), /STORAGE_UNAVAILABLE/);
    await io.remove('../../private/token');
    assert.equal(await io.read('../../private/token'), null);
    const { readdir } = await import('node:fs/promises');
    assert.deepEqual(await readdir(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('native auth callbacks arriving before runtime readiness are consumed once', async () => {
  const main = await import('../main.cjs');
  assert.equal(typeof main.captureEarlyCallbacks, 'function', 'early protocol capture feature must exist');
  const app = new EventEmitter();
  const pending = main.captureEarlyCallbacks(app);
  let prevented = false;
  app.emit('open-url', { preventDefault() { prevented = true; } }, 'studyroom-desktop://auth/callback?code=one');
  app.emit('second-instance', {}, ['StudyRoom.exe', 'studyroom-desktop://auth/callback?code=two']);
  assert.equal(prevented, true);
  assert.deepEqual(pending.consume(), ['studyroom-desktop://auth/callback?code=one', 'studyroom-desktop://auth/callback?code=two']);
  assert.deepEqual(pending.consume(), []);
  assert.equal(app.listenerCount('open-url'), 0);
  assert.equal(app.listenerCount('second-instance'), 0);
});
