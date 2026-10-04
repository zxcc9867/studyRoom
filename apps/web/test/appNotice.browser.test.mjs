import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

let chromium;
try {
  ({ chromium } = await import(process.env.FEED_BROWSER_MODULE ? pathToFileURL(process.env.FEED_BROWSER_MODULE).href : "playwright"));
} catch {}

const require = createRequire(import.meta.url);
const built = await build({ entryPoints: [fileURLToPath(new URL("../src/AppNotice.tsx", import.meta.url))], bundle: true, write: false, format: "cjs", platform: "node", packages: "external", jsx: "automatic", logLevel: "silent" });
const module = { exports: {} };
new Function("require", "module", "exports", built.outputFiles[0].text)(require, module, module.exports);
const AppNotice = module.exports.default;
const css = (await Promise.all(["styles.css", "dashboardRedesign.css", "appTheme.css"].map(name => readFile(new URL(`../src/${name}`, import.meta.url), "utf8")))).join("\n");
const messages = ["ACTIVE_SESSION_EXISTS", "UNEXPECTED_RPC_FAILURE", "할 일을 저장했습니다.", "카메라 연결을 확인하고 있어요."];
const notices = messages.map(message => renderToStaticMarkup(React.createElement(AppNotice, { message }))).join("");
const before = `<p class="message">ACTIVE_SESSION_EXISTS</p>`;
const content = process.env.APP_NOTICE_SNAPSHOT_PHASE === "before" ? before : notices;
const html = `<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="dashboard-redesign"><section class="workspace">${content}</section></main><main class="login-shell"><section class="login-panel">${content}</section></main></body></html>`;

test("notices render no empty banner and escape untrusted text", () => {
  assert.equal(renderToStaticMarkup(React.createElement(AppNotice, { message: " " })), "");
  const markup = renderToStaticMarkup(React.createElement(AppNotice, { message: '<script>alert("x")</script>' }));
  assert.doesNotMatch(markup, /<script>/);
  assert.match(markup, /&lt;script&gt;/);
});

test("notice roles distinguish an error from a non-urgent session warning", () => {
  assert.match(notices, /role="alert"/);
  assert.match(notices, /role="status"/);
  assert.doesNotMatch(notices, /ACTIVE_SESSION_EXISTS|UNEXPECTED_RPC_FAILURE/);
});

test("shared notices stay readable and contained on mobile and desktop", { skip: !chromium && "Optional browser runtime unavailable" }, async () => {
  const server = createServer((_, response) => { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(html); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.FEED_BROWSER_EXECUTABLE || undefined });
    await mkdir("output/playwright", { recursive: true });
    for (const width of [375, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      const phase = process.env.APP_NOTICE_SNAPSHOT_PHASE === "before" ? "before" : "after";
      await page.screenshot({ path: `output/playwright/app-notice-${phase}-${width}.png`, fullPage: true });
      if (phase === "before") { await page.close(); continue; }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.getByRole("alert").count(), 2);
      assert.equal(await page.getByRole("status").count(), 6);
      const metrics = await page.locator(".app-notice").evaluateAll(elements => elements.map(element => {
        const channels = value => value.match(/[\d.]+/g).map(Number).slice(0, 3);
        const lum = rgb => channels(rgb).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        const style = getComputedStyle(element), background = lum(style.backgroundColor);
        const text = [...element.querySelectorAll("strong,p")].map(node => {
          const s = getComputedStyle(node), foreground = lum(s.color);
          return { contrast: (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05), size: parseFloat(s.fontSize) };
        });
        return { border: style.borderTopWidth, shadow: style.boxShadow, text };
      }));
      for (const metric of metrics) {
        assert.equal(metric.border, "1px");
        assert.equal(metric.shadow, "none");
        for (const text of metric.text) { assert.ok(text.contrast >= 4.5, JSON.stringify(text)); assert.ok(text.size >= 15); }
      }
      await page.close();
    }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});
