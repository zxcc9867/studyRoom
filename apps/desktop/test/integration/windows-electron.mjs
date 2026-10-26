import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { access, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const playwrightPath = process.env.STUDY_ROOM_PLAYWRIGHT_MODULE
  || 'C:/Users/zxcc9/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { _electron } = await import(pathToFileURL(playwrightPath).href);
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = path.join(root, 'output/windows-electron-acceptance', `${Date.now()}-${randomUUID()}`);
const entry = fileURLToPath(new URL('./fixtures/electron-main.cjs', import.meta.url));
const executablePath = process.env.STUDY_ROOM_ELECTRON_EXECUTABLE || path.join(root, 'node_modules/electron/dist/electron.exe');
const userId = 'synthetic-windows-user';
const idle = { userId, ready: true, session: null, cameraActive: false, operationPending: false, activity: 'allowed' };
const html = `<!doctype html><meta charset="utf-8"><title>Isolated Windows acceptance</title>
<button id="camera">Explicit camera consent</button><video autoplay muted playsinline></video>
<script>
window.documentToken = crypto.randomUUID(); window.events = []; window.sequence = 0;
window.currentState = ${JSON.stringify(idle)}; window.respondToProbe = true;
window.metrics = { heartbeats: 0, heartbeatAttempts: 0, heartbeatPending: 0, heartbeatErrors: 0, heartbeatTimeouts: 0,
  heartbeatRejected: 0, heartbeatInvalid: 0, frames: 0, maxHeartbeatGapMs: 0, maxFrameGapMs: 0 };
let lastHeartbeatAck = null, pendingSince = null, lastFrame = performance.now();
window.heartbeatSnapshot = () => ({ ...metrics, heartbeatSuccesses: metrics.heartbeats,
  heartbeatAckAgeMs: lastHeartbeatAck === null ? null : performance.now() - lastHeartbeatAck,
  heartbeatPendingAgeMs: pendingSince === null ? 0 : performance.now() - pendingSince });
window.request = (action, payload = {}, id = 'fixture-' + ++sequence) => studyRoomDesktop.request({ id, action, payload });
studyRoomDesktop.onEvent(event => { events.push(event); if (event.type === 'state-requested' && respondToProbe) {
  void request('studyState', currentState, event.requestId);
} });
setInterval(async () => {
  if (metrics.heartbeatPending) return;
  const id = 'heartbeat-' + ++sequence; let timer;
  metrics.heartbeatAttempts++; metrics.heartbeatPending++; pendingSince = performance.now();
  const operation = Promise.resolve().then(() => request('studyState', currentState, id));
  const settled = () => { metrics.heartbeatPending--; pendingSince = null; };
  operation.then(settled, settled);
  try {
    const response = await Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('HEARTBEAT_TIMEOUT')), 2000);
    })]);
    if (response?.id !== id || response?.ok !== true || response?.value?.accepted !== true) throw new Error('INVALID_HEARTBEAT_ACK');
    const now = performance.now();
    if (lastHeartbeatAck !== null) metrics.maxHeartbeatGapMs = Math.max(metrics.maxHeartbeatGapMs, now-lastHeartbeatAck);
    lastHeartbeatAck = now; metrics.heartbeats++;
  } catch (error) {
    metrics.heartbeatErrors++;
    if (error?.message === 'HEARTBEAT_TIMEOUT') metrics.heartbeatTimeouts++;
    else if (error?.message === 'INVALID_HEARTBEAT_ACK') metrics.heartbeatInvalid++;
    else metrics.heartbeatRejected++;
  } finally { clearTimeout(timer); }
}, 1000);
window.acquire = async constraints => { try { const stream = await navigator.mediaDevices.getUserMedia(constraints);
  stream.getTracks().forEach(track => track.stop()); return 'allowed'; } catch (e) { return e.name; } };
window.startVideo = async () => { window.stream = await navigator.mediaDevices.getUserMedia({video:true,audio:false});
  const video = document.querySelector('video'); video.srcObject = stream; await video.play();
  const frame = () => { const now = performance.now(); metrics.frames++; metrics.maxFrameGapMs = Math.max(metrics.maxFrameGapMs, now-lastFrame);
    lastFrame = now; video.requestVideoFrameCallback(frame); }; video.requestVideoFrameCallback(frame); return true; };
document.querySelector('#camera').onclick = async () => { window.cameraResult = await request('cameraConsent'); };
</script>`;

async function fixture(t, userData = path.join(output, randomUUID()), adversarialSubframe = false, options = {}) {
  await mkdir(userData, { recursive: true });
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(request.url.startsWith('/frame') ? '<!doctype html><title>Subframe</title>'
      : adversarialSubframe ? '<!doctype html><title>Stronger attacker</title>' : html);
  });
  let app; let closed = false; let cleanupPromise;
  const cleanup = () => cleanupPromise ??= (async () => {
    try {
      if (app && !closed) {
        await app.evaluate(({ BrowserWindow }) => {
          globalThis.acceptance?.runtime?.dispose();
          // This is the isolated launched app only, including partially initialized windows.
          for (const window of BrowserWindow.getAllWindows()) window.destroy();
        }).catch(() => {});
        await app.close();
      }
    } finally {
      server.closeAllConnections();
      if (server.listening) await new Promise(resolve => server.close(resolve));
    }
  })();
  t.after(cleanup);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  options.onServerListening?.(server);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const env = { ...process.env, STUDY_ROOM_TEST_USER_DATA: userData, STUDY_ROOM_TEST_ORIGIN: origin,
    STUDY_ROOM_TEST_ADVERSARIAL_SUBFRAME: adversarialSubframe ? '1' : '0' };
  delete env.ELECTRON_RUN_AS_NODE;
  const launch = options.launch ?? (options => _electron.launch(options));
  try {
    await access(options.executablePath ?? executablePath);
    app = await launch({ executablePath: options.executablePath ?? executablePath,
      args: [entry, '--use-fake-device-for-media-stream'], env, timeout: 30000 });
  } catch (error) { await cleanup(); throw error; }
  app.on('close', () => { closed = true; });
  const page = await app.firstWindow();
  await page.waitForFunction(adversarial => adversarial ? typeof window.attackRequest === 'function' : typeof window.request === 'function', adversarialSubframe);
  await app.evaluate(() => Boolean(acceptance.runtime));
  if (!adversarialSubframe) {
    assert.deepEqual(await page.evaluate(() => request('authStatus')), {
      id: await page.evaluate(() => 'fixture-' + sequence), ok: true, value: { userId },
    });
  }
  return { app, page, origin, userData, closed: () => closed };
}
async function state(page, value) {
  assert.equal((await page.evaluate(value => { currentState = value; return request('studyState', value); }, value)).ok, true);
}
async function consent(page) {
  await page.evaluate(() => { window.cameraResult = null; });
  await page.locator('#camera').click();
  await page.waitForFunction(() => cameraResult !== null);
  assert.equal((await page.evaluate(() => cameraResult)).value.allowed, true);
}
async function save(name, value) {
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, name + '.json'), JSON.stringify(value, null, 2));
  console.log(`${name}: ${JSON.stringify(value)}`);
}

test('heartbeat oracle rejects pending, rejected and malformed native responses rather than counting attempts', { timeout: 60000 }, async t => {
  for (const mode of ['pending', 'reject', 'ok-false', 'wrong-id', 'missing-accepted', 'false-accepted']) {
    await t.test(mode, async t => {
      const { page } = await fixture(t);
      await page.waitForFunction(() => metrics.heartbeats >= 1);
      const before = await page.evaluate(mode => {
        const before = { ...metrics };
        window.request = async (_action, _payload, id) => {
          if (mode === 'pending') return new Promise(() => {});
          if (mode === 'reject') throw new Error('synthetic IPC rejection');
          if (mode === 'ok-false') return { id, ok: false, error: 'AUTH_CHANGED' };
          if (mode === 'wrong-id') return { id: 'unrelated-envelope', ok: true, value: { accepted: true } };
          if (mode === 'missing-accepted') return { id, ok: true, value: {} };
          return { id, ok: true, value: { accepted: false } };
        };
        return before;
      }, mode);
      await page.waitForTimeout(3300);
      const after = await page.evaluate(() => ({ ...metrics }));
      assert.equal(after.heartbeats, before.heartbeats, 'no native accepted ACK means no success increment');
      assert.ok(after.heartbeatAttempts > before.heartbeatAttempts, 'fault must receive a dispatched attempt');
      assert.ok(after.heartbeatErrors > before.heartbeatErrors, 'fault must be counted rather than left unobserved');
      assert.equal(after.heartbeatPending, mode === 'pending' ? 1 : 0);
      if (mode === 'pending') assert.ok(after.heartbeatTimeouts > before.heartbeatTimeouts);
    });
  }
});

test('failed Electron launch closes its loopback server through pre-registered cleanup', { timeout: 10000 }, async () => {
  const hooks = []; let server;
  try {
    await assert.rejects(fixture({ after: callback => hooks.push(callback) }, path.join(output, 'failed-launch-' + randomUUID()), false, {
      launch: async () => { throw new Error('synthetic launch failure'); }, onServerListening: value => { server = value; },
    }), /synthetic launch failure/);
    for (const cleanup of hooks) await cleanup();
    assert.equal(server.listening, false, 'failed launch must not leave a listening handle');
    assert.equal(server.address(), null);
  } finally {
    for (const cleanup of hooks) await cleanup();
    if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
});

test('missing Electron executable fails quickly and closes only its fixture server', { timeout: 10000 }, async () => {
  const hooks = []; let server; const started = Date.now();
  try {
    await assert.rejects(fixture({ after: callback => hooks.push(callback) }, path.join(output, 'missing-exe-' + randomUUID()), false, {
      executablePath: path.join(output, 'definitely-missing-electron.exe'), onServerListening: value => { server = value; },
    }), { code: 'ENOENT' });
    for (const cleanup of hooks) await cleanup();
    assert.equal(server.listening, false); assert.equal(server.address(), null);
    assert.ok(Date.now() - started < 5000);
  } finally {
    for (const cleanup of hooks) await cleanup();
    if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
});

test('partial Electron initialization failure closes the owned app and fixture server', { timeout: 30000 }, async () => {
  const hooks = []; let server; let closed = false;
  try {
    await assert.rejects(fixture({ after: callback => hooks.push(callback) }, path.join(output, 'partial-init-' + randomUUID()), false, {
      onServerListening: value => { server = value; },
      launch: async options => {
        const app = await _electron.launch(options); app.on('close', () => { closed = true; });
        app.firstWindow = async () => { throw new Error('synthetic first-window failure'); };
        return app;
      },
    }), /synthetic first-window failure/);
    for (const cleanup of hooks) await cleanup();
    assert.equal(closed, true); assert.equal(server.listening, false); assert.equal(server.address(), null);
  } finally {
    for (const cleanup of hooks) await cleanup();
    if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
});

test('real Electron enforces trusted document IPC, video-only consent, navigation and fresh quit ownership', { timeout: 90000 }, async t => {
  const { app, page, origin, closed } = await fixture(t);
  assert.deepEqual(await page.evaluate(() => ({ process: typeof process, require: typeof require,
    bridge: Object.keys(studyRoomDesktop).sort() })), {
    process: 'undefined', require: 'undefined', bridge: ['onEvent', 'protocolVersion', 'request'],
  });
  const preferences = await app.evaluate(() => acceptance.runtime.window.webContents.getLastWebPreferences());
  for (const key of ['sandbox', 'contextIsolation', 'webSecurity']) assert.equal(preferences[key], true, key);
  for (const key of ['nodeIntegration', 'nodeIntegrationInSubFrames', 'webviewTag']) assert.equal(preferences[key], false, key);
  assert.equal(await app.evaluate(() => acceptance.runtime.window.webContents.getBackgroundThrottling()), false);
  assert.equal(await app.evaluate(() => Boolean(acceptance.observations.tray && acceptance.observations.menu)), true);
  assert.equal(await page.evaluate(() => acquire({ video: true, audio: false })), 'NotAllowedError');
  assert.equal(await app.evaluate(() => acceptance.observations.dialogs.length), 0, 'automatic request must not open native consent');
  await consent(page);
  const consentedVideo = await page.evaluate(() => acquire({ video: true, audio: false }));
  if (consentedVideo !== 'allowed') await save('consented-video-failure', {
    consentedVideo, observations: await app.evaluate(() => ({ permissions: acceptance.observations.permissions,
      dialogs: acceptance.observations.dialogs, url: acceptance.runtime.window.webContents.getURL() })),
  });
  assert.equal(consentedVideo, 'allowed');
  assert.equal(await page.evaluate(() => acquire({ audio: true, video: false })), 'NotAllowedError');
  assert.equal(await page.evaluate(() => acquire({ audio: true, video: true })), 'NotAllowedError');
  assert.equal(await page.evaluate(async () => { try { await navigator.mediaDevices.getDisplayMedia({ video: true }); return 'allowed'; }
    catch (error) { return error.name; } }), 'NotAllowedError');
  await page.evaluate(() => { location.hash = 'same-document'; });
  assert.equal(await page.evaluate(() => acquire({ video: true, audio: false })), 'allowed', 'hash keeps consent');
  const topToken = await page.evaluate(() => documentToken);
  await page.evaluate(() => { const frame = document.createElement('iframe'); frame.src = '/frame'; frame.allow = 'camera; microphone'; document.body.append(frame); });
  await page.waitForFunction(() => document.querySelector('iframe').contentDocument?.title === 'Subframe');
  const frame = page.frames().find(frame => frame.url() === origin + '/frame');
  assert.deepEqual(await frame.evaluate(() => ({ bridge: typeof studyRoomDesktop, process: typeof process, require: typeof require })),
    { bridge: 'undefined', process: 'undefined', require: 'undefined' });
  assert.equal(await frame.evaluate(async () => { try { const stream = await navigator.mediaDevices.getUserMedia({video:true}); stream.getTracks().forEach(t => t.stop()); return 'allowed'; }
    catch (e) { return e.name; } }), 'NotAllowedError');
  const url = page.url();
  await page.evaluate(() => window.open('https://example.com/acceptance', '_blank'));
  await page.waitForTimeout(200);
  assert.equal(page.url(), url);
  assert.deepEqual(await app.evaluate(() => acceptance.observations.external), ['https://example.com/acceptance']);
  assert.equal(await page.evaluate(() => documentToken), topToken);
  const foreign = await app.evaluate(async (_electron, url) => acceptance.foreignWindow(url), origin + '/frame');
  assert.equal(foreign.ok, false); assert.equal(foreign.error, 'UNTRUSTED_DOCUMENT');
  await page.reload(); await page.waitForFunction(() => typeof request === 'function');
  assert.notEqual(await page.evaluate(() => documentToken), topToken);
  assert.equal(await page.evaluate(() => acquire({ video: true, audio: false })), 'NotAllowedError', 'real navigation resets consent');

  await state(page, idle);
  await page.evaluate(() => { respondToProbe = false; });
  void app.evaluate(() => acceptance.runtime.requestQuit());
  await page.waitForFunction(() => events.some(e => e.type === 'state-requested'));
  await state(page, idle); // unrelated fresh idle cannot satisfy the matching request ID
  await page.waitForTimeout(5300);
  assert.equal(closed(), false);
  assert.equal(await app.evaluate(() => acceptance.observations.dialogs.some(value => value.title === '종료 상태 확인 필요')), true);
  await page.evaluate(() => { respondToProbe = true; events.length = 0; });
  const studying = { ...idle, session: { id: 'synthetic-local-session', paused: false }, activity: 'studying' };
  await state(page, studying); await page.waitForTimeout(100);
  await app.evaluate(() => acceptance.runtime.requestQuit());
  await page.waitForFunction(() => events.some(e => e.type === 'quit-requested'));
  const localQuit = await page.evaluate(() => events.find(e => e.type === 'quit-requested'));
  assert.deepEqual(localQuit, { type: 'quit-requested', requestId: 'quit-1', userId, sessionId: 'synthetic-local-session', localEngagement: true });
  assert.equal((await page.evaluate(id => request('cancelQuit', { requestId: id }), localQuit.requestId)).ok, true);
  const paused = { ...studying, session: { id: 'synthetic-local-session', paused: true }, activity: 'allowed' };
  await state(page, paused); await page.evaluate(() => { events.length = 0; });
  await app.evaluate(() => acceptance.runtime.requestQuit());
  await page.waitForFunction(() => events.some(e => e.type === 'quit-requested'));
  const pausedQuit = await page.evaluate(() => events.find(e => e.type === 'quit-requested'));
  assert.equal(pausedQuit.localEngagement, true); assert.equal(closed(), false);
  assert.equal((await page.evaluate(id => request('cancelQuit', { requestId: id }), pausedQuit.requestId)).ok, true);
  const observer = { ...idle, session: { id: 'synthetic-remote-session', paused: false }, operationPending: true };
  await state(page, observer); await page.waitForTimeout(100); await page.evaluate(() => { events.length = 0; });
  await app.evaluate(() => acceptance.runtime.requestQuit());
  await page.waitForFunction(() => events.some(e => e.type === 'quit-requested'));
  const observerQuit = await page.evaluate(() => events.find(e => e.type === 'quit-requested'));
  assert.equal(observerQuit.localEngagement, false); assert.equal(observerQuit.sessionId, 'synthetic-remote-session');
  assert.equal((await page.evaluate(id => request('cancelQuit', { requestId: id }), observerQuit.requestId)).ok, true);
  await state(page, { ...observer, operationPending: false });
  const closing = app.waitForEvent('close');
  void app.evaluate(() => acceptance.runtime.requestQuit()).catch(() => {});
  await closing;
  await save('security-and-quit', { passed: true, localQuit, pausedQuit, observerQuit, noServerTransport: true });
});

test('test-only unsandboxed stronger subframe attacker is rejected by real runtime senderFrame guard', { timeout: 40000 }, async t => {
  // Controller-approved separate stronger-attacker launch: unsandboxed hostile preload
  // with subframe execution. Ordinary production-config tests still require sandbox:true.
  const { app, page, origin } = await fixture(t, path.join(output, 'adversarial-' + randomUUID()), true);
  assert.equal(await app.evaluate(() => acceptance.runtime.window.webContents.getLastWebPreferences().nodeIntegrationInSubFrames), true);
  const preferences = await app.evaluate(() => acceptance.runtime.window.webContents.getLastWebPreferences());
  assert.equal(preferences.sandbox, false, 'test-only stronger attacker, not production sandbox acceptance');
  for (const key of ['contextIsolation', 'webSecurity']) assert.equal(preferences[key], true);
  assert.equal(preferences.nodeIntegration, false);
  assert.deepEqual(await page.evaluate(() => ({ process: typeof process, require: typeof require })), { process: 'undefined', require: 'undefined' });
  assert.equal(await page.evaluate(() => typeof attackRequest), 'function');
  await page.evaluate(() => { const frame = document.createElement('iframe'); frame.src = '/frame'; document.body.append(frame); });
  try {
    await page.waitForFunction(() => document.querySelector('iframe').contentDocument?.title === 'Subframe'
      && typeof document.querySelector('iframe').contentWindow.attackRequest === 'function', null, { timeout: 5000 });
  } catch (error) {
    await save('adversarial-preload-failure', {
      frames: await Promise.all(page.frames().map(async frame => ({ url: frame.url(), attack: await frame.evaluate(() => typeof attackRequest) }))),
      native: await app.evaluate(() => ({ preferences: acceptance.runtime.window.webContents.getLastWebPreferences(),
        scripts: acceptance.runtime.window.webContents.session.getPreloadScripts(), errors: acceptance.observations.preloadErrors })),
    });
    throw error;
  }
  const frame = page.frames().find(frame => frame.url() === origin + '/frame');
  assert.deepEqual(await frame.evaluate(() => ({ process: typeof process, require: typeof require })), { process: 'undefined', require: 'undefined' });
  const response = await frame.evaluate(() => attackRequest());
  assert.equal(response.ok, false); assert.equal(response.error, 'UNTRUSTED_DOCUMENT');
  assert.equal(await app.evaluate(() => acceptance.observations.ipc.some(value => !value.top && value.owning)), true);
  await save('adversarial-subframe', { response, actualOwningSubframeIpc: true,
    boundary: 'Separate isolated UNSANDBOXED stronger-attacker launch with hostile BrowserWindow preload, nodeIntegrationInSubFrames:true, contextIsolation/webSecurity:true and nodeIntegration:false; not production configuration or sandbox acceptance.' });
});

test('real Electron X hides one document and fake video plus heartbeat continue for six minutes', { timeout: 420000 }, async t => {
  const { app, page } = await fixture(t);
  await consent(page); await page.evaluate(() => startVideo());
  await state(page, { ...idle, session: { id: 'synthetic-hidden-session', paused: false }, activity: 'studying', cameraActive: true });
  await page.waitForFunction(() => metrics.frames >= 10);
  const identity = await app.evaluate(() => ({ pid: process.pid, rendererPid: acceptance.runtime.window.webContents.getOSProcessId(),
    webContentsId: acceptance.runtime.window.webContents.id }));
  const token = await page.evaluate(() => documentToken);
  await page.waitForFunction(() => metrics.heartbeats > 0 && metrics.heartbeatPending === 0);
  const start = await page.evaluate(() => { metrics.maxHeartbeatGapMs = 0; metrics.maxFrameGapMs = 0; return heartbeatSnapshot(); });
  await app.evaluate(() => acceptance.runtime.window.close());
  assert.equal(await app.evaluate(() => acceptance.runtime.window.isVisible()), false);
  const startedAt = Date.now(); const samples = [];
  for (let index = 0; index < 12; index++) {
    await new Promise(resolve => setTimeout(resolve, 30000));
    const metrics = await page.evaluate(() => ({ ...heartbeatSnapshot(), token: documentToken,
      visibilityState: document.visibilityState, documentHidden: document.hidden, track: stream.getVideoTracks()[0].readyState }));
    const processMetrics = await app.evaluate(() => ({ cpu: process.getCPUUsage(), pid: process.pid,
      webContentsId: acceptance.runtime.window.webContents.id,
      visible: acceptance.runtime.window.isVisible(), rendererPid: acceptance.runtime.window.webContents.getOSProcessId() }));
    processMetrics.memory = await app.evaluate(() => process.getProcessMemoryInfo());
    samples.push({ elapsedMs: Date.now() - startedAt, metrics, processMetrics });
    assert.equal(metrics.token, token); assert.equal(metrics.track, 'live'); assert.equal(processMetrics.visible, false);
    assert.equal(metrics.visibilityState, 'visible'); assert.equal(metrics.documentHidden, false);
    assert.equal(processMetrics.pid, identity.pid); assert.equal(processMetrics.webContentsId, identity.webContentsId);
    assert.equal(processMetrics.rendererPid, identity.rendererPid);
    assert.ok(metrics.frames > (samples.at(-2)?.metrics.frames ?? start.frames));
    assert.ok(metrics.heartbeats > (samples.at(-2)?.metrics.heartbeats ?? start.heartbeats));
    assert.equal(metrics.heartbeatErrors, 0); assert.equal(metrics.heartbeatTimeouts, 0);
    assert.equal(metrics.heartbeatAttempts, metrics.heartbeatSuccesses + metrics.heartbeatPending);
    assert.ok(metrics.heartbeatPending <= 1); assert.ok(metrics.heartbeatPendingAgeMs < 2000);
    assert.ok(Number.isFinite(metrics.heartbeatAckAgeMs) && metrics.heartbeatAckAgeMs < 2000);
    assert.ok(metrics.maxHeartbeatGapMs < 2000, 'successful correlated native ACKs must stay fresh');
    console.log(`hidden-progress ${index + 1}/12 ${JSON.stringify(samples.at(-1))}`);
  }
  assert.ok(Date.now() - startedAt >= 360000);
  await page.waitForFunction(() => metrics.heartbeatPending === 0);
  const finish = await page.evaluate(() => heartbeatSnapshot());
  assert.equal(finish.heartbeatErrors, 0); assert.equal(finish.heartbeatTimeouts, 0); assert.equal(finish.heartbeatPending, 0);
  assert.equal(finish.heartbeatAttempts, finish.heartbeats);
  assert.ok(finish.heartbeatAckAgeMs < 2000);
  assert.ok(finish.maxHeartbeatGapMs < 2000, 'ACKs must remain within native freshness window');
  assert.ok(finish.maxFrameGapMs < 10000, 'fake video must not stall while hidden');
  await app.evaluate(({ app }) => app.emit('second-instance', {}, []));
  assert.equal(await app.evaluate(() => acceptance.runtime.window.isVisible()), true);
  assert.equal(await page.evaluate(() => documentToken), token);
  assert.deepEqual(await app.evaluate(() => ({ pid: process.pid, rendererPid: acceptance.runtime.window.webContents.getOSProcessId(),
    webContentsId: acceptance.runtime.window.webContents.id })), identity);
  await app.evaluate(() => acceptance.runtime.window.close());
  await app.evaluate(() => acceptance.observations.menu.items.find(item => item.label === '독서실 열기').click());
  assert.equal(await app.evaluate(() => acceptance.runtime.window.isVisible()), true);
  assert.equal(await page.evaluate(() => documentToken), token);
  assert.deepEqual(await app.evaluate(() => ({ pid: process.pid, rendererPid: acceptance.runtime.window.webContents.getOSProcessId(),
    webContentsId: acceptance.runtime.window.webContents.id })), identity);
  assert.equal(await page.evaluate(() => stream.getVideoTracks()[0].readyState), 'live');
  const trayFrames = await page.evaluate(() => metrics.frames);
  await page.waitForFunction(value => metrics.frames > value, trayFrames);
  await save('six-minute-hidden', { identity, start, finish, elapsedMs: Date.now() - startedAt, samples,
    limitation: 'Synthetic fake camera and local IPC heartbeat; not physical pose/server/cross-device/performance acceptance.' });
});

test('Windows safeStorage encrypts synthetic credential and real lifecycle metadata across process restart', { timeout: 60000 }, async t => {
  const userData = path.join(output, 'restart-' + randomUUID());
  const first = await fixture(t, userData);
  const synthetic = 'SYNTHETIC-ONLY-NOT-A-REAL-CREDENTIAL-20261025';
  assert.equal(await first.app.evaluate(() => acceptance.storage.secure), true);
  await first.app.evaluate(async (_electron, value) => acceptance.storage.setItem('acceptance-synthetic-credential', value), synthetic);
  await state(first.page, { ...idle, session: { id: 'synthetic-persisted-session', paused: false }, activity: 'studying' });
  await first.page.waitForTimeout(200);
  assert.equal(await first.app.evaluate(() => acceptance.lifecycle.view().localEngagement), true);
  const files = await readdir(path.join(userData, 'encrypted-auth'));
  assert.ok(files.length >= 2);
  for (const file of files) {
    const bytes = await readFile(path.join(userData, 'encrypted-auth', file));
    assert.equal(bytes.includes(Buffer.from(synthetic)), false);
    assert.equal(bytes.includes(Buffer.from('synthetic-persisted-session')), false);
  }
  await first.app.evaluate(() => { acceptance.runtime.dispose(); acceptance.runtime.window.destroy(); }); await first.app.close();
  const second = await fixture(t, userData);
  assert.equal(await second.app.evaluate(() => acceptance.storage.getItem('acceptance-synthetic-credential')), synthetic);
  await state(second.page, { ...idle, session: { id: 'synthetic-persisted-session', paused: true } });
  assert.equal(await second.app.evaluate(() => acceptance.lifecycle.view().localEngagement), true);
  await second.app.evaluate(() => acceptance.runtime.requestQuit());
  await second.page.waitForFunction(() => events.some(event => event.type === 'quit-requested'));
  const quit = await second.page.evaluate(() => events.find(event => event.type === 'quit-requested'));
  assert.equal(quit.localEngagement, true);
  assert.equal(quit.sessionId, 'synthetic-persisted-session');
  await save('encrypted-restart', { secureStorage: true, ciphertextFiles: files.length, restartRoundtrip: true, restoredQuit: quit });
});
