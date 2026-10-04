import assert from "node:assert/strict";
import test from "node:test";
import { readFile, access, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const publicRoot = new URL("../apps/web/public/", import.meta.url);
const firstRoute = path => config.routes.find(route => route.src && new RegExp(`^${route.src}$`).test(path));

test("fixed APK address redirects temporarily to a public APK without caching an old release", () => {
  const route = firstRoute("/download/android.apk");
  assert.equal(route?.status, 307);
  const target = new URL(route.headers.Location);
  assert.equal(target.origin, "https://expo.dev");
  assert.match(target.pathname, /^\/artifacts\/eas\/[\w-]+\.apk$/);
  assert.equal(target.search, "");
  assert.equal(route.headers["Cache-Control"], "no-store");
  assert.ok(config.routes.indexOf(route) < config.routes.findIndex(item => item.handle === "filesystem"));
  assert.notEqual(firstRoute("/download/androidXapk")?.status, 307);
});

test("fixed install page resolves before the SPA fallback with or without a trailing slash", async () => {
  for (const path of ["/download/android", "/download/android/"]) {
    const route = firstRoute(path);
    assert.equal(route?.dest, "/download/android.html");
    assert.equal(route.headers["Cache-Control"], "no-store");
    await access(new URL(`.${route.dest}`, publicRoot));
  }
});

test("download routes leave unrelated API and app routes unchanged", () => {
  assert.equal(firstRoute("/api/not-found").status, 404);
  assert.equal(firstRoute("/tech-feed").dest, "/index.html");
});

let chromium;
try { ({ chromium } = await import(process.env.FEED_BROWSER_MODULE ? pathToFileURL(process.env.FEED_BROWSER_MODULE).href : "playwright")); } catch {}

test("install page offers one stable download link, readable instructions and keyboard access on mobile and desktop", { skip: !chromium && "Optional browser runtime unavailable" }, async () => {
  const route = firstRoute("/download/android");
  assert.equal(route?.dest, "/download/android.html");
  const html = await readFile(new URL(`.${route.dest}`, publicRoot), "utf8");
  const css = await readFile(new URL("download/android.css", publicRoot), "utf8");
  const server = createServer((request, response) => {
    const style = request.url.endsWith(".css");
    response.setHeader("Content-Type", style ? "text/css" : "text/html; charset=utf-8");
    response.end(style ? css : html);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.FEED_BROWSER_EXECUTABLE || undefined });
    await mkdir("output/playwright", { recursive: true });
    for (const width of [375, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`http://127.0.0.1:${server.address().port}/download/android`);
      assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
      const download = page.getByRole("link", { name: "최신 Android APK 다운로드" });
      assert.equal(await download.count(), 1);
      assert.equal(await download.getAttribute("href"), "/download/android.apk");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.ok(await page.getByText("기존 앱을 삭제하지 마세요.", { exact: false }).isVisible());
      assert.ok(await page.getByText("자동 설치나 자동 업데이트는 아니에요.", { exact: false }).isVisible());
      const size = await download.boundingBox();
      assert.ok(size.height >= 44 && size.width >= 44);
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      assert.equal(await download.evaluate(element => element === document.activeElement), true);
      assert.notEqual(await download.evaluate(element => getComputedStyle(element).outlineStyle), "none");
      const contrast = await page.locator("h1,h2,p,strong,li,a").evaluateAll(elements => elements.map(element => {
        const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
        let surface = element;
        while (surface.parentElement && getComputedStyle(surface).backgroundColor === "rgba(0, 0, 0, 0)") surface = surface.parentElement;
        const foreground = luminance(getComputedStyle(element).color);
        const background = luminance(getComputedStyle(surface).backgroundColor);
        return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      }));
      assert.ok(contrast.every(value => value >= 4.5), JSON.stringify(contrast));
      await page.screenshot({ path: `output/playwright/android-download-${width}.png`, fullPage: true });
      await page.close();
    }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});
