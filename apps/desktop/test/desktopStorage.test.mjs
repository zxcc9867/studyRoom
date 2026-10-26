import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const module = await import('../src/desktopStorage.mjs').catch(() => ({}));
function storage(options) {
  assert.equal(typeof module.createEncryptedStorage, 'function', 'encrypted storage feature must exist');
  return module.createEncryptedStorage(options);
}
function disk() {
  const files = new Map();
  const key = randomBytes(32);
  const safeStorage = {
    isEncryptionAvailable: () => true,
    encryptString(value) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), body]);
    },
    decryptString(value) {
      const decipher = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
      decipher.setAuthTag(value.subarray(12, 28));
      return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString('utf8');
    },
  };
  return { files, safeStorage, read: async key => files.get(key) ?? null,
    write: async (key, value) => files.set(key, value), remove: async key => files.delete(key) };
}

test('all stored disk bytes are ciphertext and survive a new adapter', async () => {
  const deps = disk();
  const first = storage(deps);
  await first.setItem('session', 'private-session');
  assert.equal(first.secure, true);
  assert.equal([...deps.files.values()].some(value => value.includes(Buffer.from('private-session'))), false);
  assert.equal(await storage(deps).getItem('session'), 'private-session');
  await first.removeItem('session');
  assert.equal(await storage(deps).getItem('session'), null);
});

test('unavailable encryption neither reads nor writes plaintext and keeps memory only', async () => {
  const deps = disk();
  deps.files.set('session', Buffer.from('legacy-plaintext'));
  deps.safeStorage.isEncryptionAvailable = () => false;
  deps.read = async () => assert.fail('insecure disk read');
  deps.write = async () => assert.fail('plaintext disk write');
  const item = storage(deps);
  assert.equal(item.secure, false);
  assert.equal(await item.getItem('session'), null);
  await item.setItem('session', 'memory-session');
  assert.equal(await item.getItem('session'), 'memory-session');
  assert.equal(await storage(deps).getItem('session'), null);
});

test('corrupt ciphertext and disk failures fail closed with fixed storage errors', async () => {
  const deps = disk();
  deps.files.set('broken', Buffer.from('not encrypted'));
  const item = storage(deps);
  assert.equal(await item.getItem('broken'), null);
  deps.write = async () => { throw new Error('sensitive filesystem detail'); };
  const failed = storage(deps);
  await assert.rejects(failed.setItem('session', 'private'), { message: 'STORAGE_UNAVAILABLE' });
  assert.equal(failed.secure, false);
  assert.equal(await failed.getItem('session'), 'private');
});

test('pending encrypted writes serialize with remove and do not resurrect logout data', async () => {
  const deps = disk();
  let finish;
  const gate = new Promise(resolve => { finish = resolve; });
  const write = deps.write;
  deps.write = async (...args) => { await gate; return write(...args); };
  const item = storage(deps);
  const setting = item.setItem('session', 'private');
  const removing = item.removeItem('session');
  finish();
  await Promise.all([setting, removing]);
  assert.equal(await storage(deps).getItem('session'), null);
});

test('a disk read that finishes after removal cannot re-cache logged-out session data', async () => {
  const deps = disk();
  await storage(deps).setItem('session', 'private');
  let finish;
  let reading;
  const started = new Promise(resolve => { reading = resolve; });
  const gate = new Promise(resolve => { finish = resolve; });
  const read = deps.read;
  deps.read = async key => { const value = await read(key); reading(); await gate; return value; };
  const item = storage(deps);
  const pending = item.getItem('session');
  await started;
  await item.removeItem('session');
  finish();
  assert.equal(await pending, null);
  assert.equal(await item.getItem('session'), null);
});
