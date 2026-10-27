import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

let chromium;
try { ({ chromium } = await import(process.env.FEED_BROWSER_MODULE ? pathToFileURL(process.env.FEED_BROWSER_MODULE).href : 'playwright')); } catch {}
const css = (await Promise.all(['styles.css', 'dashboardRedesign.css', 'appTheme.css'].map(file => readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')))).join('\n');

test('HIG audit: reduced motion and visible form focus work before and after login', { skip: !chromium && 'Chrome runtime required' }, async () => {
  const server = createServer((_, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><main class="login-shell"><section class="login-panel"><h1>독서실에 로그인</h1><label>이메일<input type="email"></label><button class="primary">코드 받기</button></section></main><main class="dashboard-redesign"><section class="workspace"><label>목표<input></label><label>회고<textarea></textarea></label><label>시간대<select><option>서울</option></select></label></section></main></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.FEED_BROWSER_EXECUTABLE || undefined });
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const transition = await page.locator('.login-shell button').evaluate(el => getComputedStyle(el).transitionDuration);
      assert.ok(transition.split(',').every(value => parseFloat(value) === 0), `login transition must respect reduced motion: ${transition}`);
      for (const control of await page.locator('input,textarea,select').all()) {
        await control.focus();
        const outline = await control.evaluate(el => { const s = getComputedStyle(el); return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) }; });
        assert.equal(outline.style, 'solid'); assert.ok(outline.width >= 3);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});
