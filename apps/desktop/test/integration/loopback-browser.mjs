import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { createLoopbackCallback } from '../../src/desktopLoopback.mjs';

const modulePath = process.env.STUDY_ROOM_PLAYWRIGHT_MODULE
  || 'C:/Users/zxcc9/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(modulePath).href);

async function fixture(t, callback) {
  const receiver = createLoopbackCallback({ onCallback: callback });
  t.after(() => receiver.close());
  const redirect = await receiver.ready;
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<!doctype html><title>Synthetic login launcher</title><a id="login" target="_blank" href="${redirect}?code=synthetic-browser-code">Synthetic login</a>`);
  });
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.STUDY_ROOM_CHROME_EXECUTABLE
    || process.env.FEED_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ignoreDefaultArgs: ['--disable-popup-blocking'] });
  t.after(() => browser.close());
  const context = await browser.newContext();
  const parent = await context.newPage();
  parent.setDefaultTimeout(5000);
  await parent.goto(`http://127.0.0.1:${server.address().port}`);
  return { parent, context, redirect, receiver };
}

async function openFreshExternalTab(context, parent, url) {
  // Match an OS-opened URL in a fresh tab, not newPage()+goto()'s extra about:blank history.
  const ready = context.waitForEvent('page');
  const browserSession = await context.browser().newBrowserCDPSession();
  const parentSession = await context.newCDPSession(parent);
  const { targetInfo } = await parentSession.send('Target.getTargetInfo');
  await browserSession.send('Target.createTarget', { url, browserContextId: targetInfo.browserContextId });
  const entry = await ready;
  entry.setDefaultTimeout(5000);
  await entry.waitForLoadState('load');
  return entry;
}

async function openOwnedPopup(context, entry) {
  const popupReady = context.waitForEvent('page', { timeout: 5000 });
  const click = entry.getByRole('button', { name: 'Google로 계속', exact: true }).click().catch(error => {
    if (!entry.isClosed() || !/Target page, context or browser has been closed/.test(error.message)) throw error;
  });
  // The click may report target-closed because closing the entry is the intended effect.
  // A real popup must also be observed; a closed tab alone is never accepted as success.
  const [popup] = await Promise.all([popupReady, click]);
  popup.setDefaultTimeout(5000);
  return popup;
}

test('Chrome closes a script-closable successful login tab while leaving the original tab alone', { timeout: 20000 }, async t => {
  let completed = false;
  const { parent, context } = await fixture(t, async () => { completed = true; });
  const popupReady = parent.waitForEvent('popup');
  await parent.locator('#login').click();
  const popup = await popupReady;
  if (!popup.isClosed()) await popup.waitForEvent('close', { timeout: 3000 });
  assert.equal(completed, true);
  assert.equal(parent.isClosed(), false);
  assert.deepEqual(context.pages(), [parent]);
  assert.equal(await parent.title(), 'Synthetic login launcher');
});

test('Chrome policy-blocked auto-close leaves the success explanation visible without weakening CSP', { timeout: 20000 }, async t => {
  const { parent, redirect } = await fixture(t, async () => {});
  // A browser-created tab with multiple history entries is intentionally not script-closable.
  const denied = parent.waitForEvent('console', { predicate: message => /Scripts may close|not opened by script/i.test(message.text()), timeout: 3000 });
  await parent.goto(`${redirect}?code=synthetic-browser-code`);
  await denied;
  assert.equal(parent.isClosed(), false);
  assert.match(await parent.locator('h1').innerText(), /로그인이 완료/);
  assert.match(await parent.locator('main').innerText(), /이 탭은 닫아도 됩니다/);
});

test('Chrome-created isolated auth window stays closable across COOP and multiple provider pages', { timeout: 20000 }, async t => {
  const { parent, context, redirect, receiver } = await fixture(t, async () => {});
  assert.equal(typeof receiver.authorizationEntry, 'function', 'native auth must open its owned browser entry');
  const entryUrl = receiver.authorizationEntry('https://synthetic-provider.invalid/provider');
  await context.route('https://synthetic-provider.invalid/**', route => {
    return route.fulfill({ contentType: 'text/html', headers: { 'Cross-Origin-Opener-Policy': 'same-origin' }, body: new URL(route.request().url()).pathname === '/provider'
      ? '<!doctype html><title>Synthetic provider</title><a href="/consent">Choose account</a>'
      : `<!doctype html><title>Synthetic consent</title><a href="${redirect}?code=synthetic-browser-code">Complete</a>` });
  });
  const entry = await openFreshExternalTab(context, parent, entryUrl);
  assert.equal(await entry.evaluate(() => history.length), 1, 'a fresh external URL tab has no prior user history');
  const popup = await openOwnedPopup(context, entry);
  await popup.getByRole('link', { name: 'Choose account', exact: true }).click();
  assert.equal(await popup.evaluate(() => window.opener), null, 'provider is isolated from the entry tab');
  assert.ok(await popup.evaluate(() => history.length >= 2), 'the test includes actual provider navigation history');
  await popup.getByRole('link', { name: 'Complete', exact: true }).click();
  if (!popup.isClosed()) await popup.waitForEvent('close', { timeout: 5000 });
  assert.equal(entry.isClosed(), true);
  assert.equal(parent.isClosed(), false);
  assert.deepEqual(context.pages(), [parent], 'only the pre-existing tab remains');
});

for (const result of ['failure', 'cancel']) {
  test(`owned auth window retains the ${result} explanation while existing Chrome tabs survive`, { timeout: 20000 }, async t => {
    let exchanges = 0;
    const { parent, context, redirect, receiver } = await fixture(t, async () => { exchanges += 1; throw Error('synthetic-failure'); });
    await context.route('https://synthetic-provider.invalid/**', route => route.fulfill({ contentType: 'text/html', body:
      `<!doctype html><a href="${redirect}?${result === 'cancel' ? 'error=access_denied' : 'code=synthetic-failure'}">Complete</a>` }));
    const entry = await openFreshExternalTab(context, parent, receiver.authorizationEntry('https://synthetic-provider.invalid/provider'));
    const popup = await openOwnedPopup(context, entry);
    await popup.getByRole('link', { name: 'Complete' }).click();
    await popup.getByRole('heading', { name: '로그인을 완료하지 못했어요.' }).waitFor();
    assert.equal(popup.isClosed(), false); assert.equal(parent.isClosed(), false); assert.equal(entry.isClosed(), true);
    assert.equal(exchanges, result === 'cancel' ? 0 : 1);
  });
}

test('a blocked auth popup leaves the entry tab open with a retry and never starts authentication', { timeout: 20000 }, async t => {
  let exchanges = 0;
  const { parent, context, receiver } = await fixture(t, async () => { exchanges += 1; });
  // Boundary injection models an enterprise/browser denial without changing user settings.
  await context.addInitScript(() => { window.open = () => null; });
  const entry = await openFreshExternalTab(context, parent, receiver.authorizationEntry('https://synthetic-provider.invalid/provider'));
  await entry.getByRole('button', { name: 'Google로 계속' }).click();
  await entry.getByRole('alert').waitFor();
  assert.equal(await entry.getByRole('button', { name: 'Google로 계속' }).isEnabled(), true);
  assert.equal(entry.isClosed(), false); assert.equal(parent.isClosed(), false); assert.equal(exchanges, 0);
  assert.equal(context.pages().length, 2);
});

for (const result of ['failure', 'cancel']) {
  test(`Chrome keeps the ${result} login tab open and never claims success`, { timeout: 20000 }, async t => {
    let calls = 0;
    const { parent, redirect } = await fixture(t, async () => { calls += 1; throw Error('synthetic-auth-failure'); });
    if (result === 'cancel') await parent.locator('#login').evaluate((link, url) => { link.href = `${url}?error=access_denied`; }, redirect);
    const popupReady = parent.waitForEvent('popup');
    await parent.locator('#login').click();
    const popup = await popupReady;
    await popup.waitForLoadState('load');
    assert.equal(popup.isClosed(), false);
    assert.match(await popup.locator('h1').innerText(), /완료하지 못/);
    assert.equal(calls, result === 'failure' ? 1 : 0);
    assert.equal(parent.isClosed(), false);
  });
}

for (const width of [375, 1440]) for (const state of ['success', 'failure', 'connection', 'entry']) {
  test(`native ${state} uses the shared readable status layout at ${width}px`, { timeout: 20000 }, async t => {
    const { parent, redirect, receiver } = await fixture(t, async () => { if (state === 'failure') throw Error('synthetic-only'); });
    await parent.setViewportSize({ width, height: 900 });
    if (state === 'connection') await parent.goto(new URL('../../error.html', import.meta.url).href);
    else if (state === 'entry') await parent.goto(receiver.authorizationEntry('https://synthetic-provider.invalid/provider'));
    else await parent.goto(`${redirect}?code=synthetic-ui-test`);
    const panel = parent.locator('main.status-panel');
    await panel.waitFor();
    const metrics = await panel.evaluate(element => {
      const heading = getComputedStyle(element.querySelector('h1'));
      return { background: getComputedStyle(element).backgroundColor, size: parseFloat(heading.fontSize), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.equal(metrics.background, 'rgb(255, 255, 255)');
    assert.ok(metrics.size >= 24 && metrics.size <= 30);
    assert.equal(metrics.overflow, false);
    assert.equal(await parent.locator('h1').count(), 1);
    if (state === 'connection') {
      const retry = parent.getByRole('link', { name: '다시 연결', exact: true });
      await parent.keyboard.press('Tab');
      assert.equal(await retry.evaluate(el => el === document.activeElement), true);
      assert.ok((await retry.boundingBox()).height >= 44);
      assert.equal(await retry.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
    }
    await mkdir('output/hig-completeness', { recursive: true });
    await parent.screenshot({ path: `output/hig-completeness/${state}-${width}.png`, fullPage: true });
    await parent.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    assert.equal(await parent.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '200% text must reflow');
    await parent.setViewportSize({ width, height: 320 });
    assert.ok(await panel.evaluate(el => el.getBoundingClientRect().top >= 0), 'short windows keep the heading reachable');
  });
}
