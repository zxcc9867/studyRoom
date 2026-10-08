import assert from "node:assert/strict";
import test from "node:test";
import { readFile, access, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { buildAndroidRelease } from "./android-release.mjs";

// Reuse the mobile tests' Babel boundary: execute the real client validator, not a test copy.
const require = createRequire(new URL("../apps/mobile/package.json", import.meta.url));
const validatorCode = require("@babel/core").transformSync(await readFile(new URL("../apps/mobile/src/appUpdate.ts", import.meta.url), "utf8"), {
  filename: "appUpdate.ts", babelrc: false, configFile: false,
  presets: [[require.resolve("@babel/preset-typescript"), { allExtensions: true }]],
  plugins: [require.resolve("@babel/plugin-transform-modules-commonjs")],
}).code;
const validator = { exports: {}, Date };
runInNewContext(validatorCode, validator);
const { validateAndroidRelease } = validator.exports;

for (const note of ["", "   ", "\t\r\n", "\u00a0\u2003"]) {
  test(`publisher and real JS client reject blank release note ${JSON.stringify(note)}`, async () => {
    const metadata = JSON.parse(await readFile(new URL("../apps/web/public/download/android-release.json", import.meta.url), "utf8"));
    assert.throws(() => buildAndroidRelease({ ...metadata, releaseNotes: [note], apkBytes: Buffer.from([1]) }), /releaseNotes/);
    assert.throws(() => validateAndroidRelease({ ...metadata, releaseNotes: [note] }), /INVALID_RELEASE/);
  });
}

test("publisher and real JS client preserve empty release notes and nonblank boundary entries", async () => {
  const metadata = JSON.parse(await readFile(new URL("../apps/web/public/download/android-release.json", import.meta.url), "utf8"));
  for (const releaseNotes of [[], ["  업데이트 안내  "], Array(8).fill("n".repeat(200))]) {
    const published = buildAndroidRelease({ ...metadata, releaseNotes, apkBytes: Buffer.from([1]) });
    const accepted = validateAndroidRelease(published);
    assert.deepEqual(Array.from(accepted.releaseNotes), releaseNotes);
  }
});

for (const releasedAt of ["2026-10-04T12:00:00.1234567890Z", "2026-10-04T24:00:00Z", "2026-10-04T12:60:00Z", "2026-10-04T12:00:60Z", "2026-10-04T12:00:00+24:00", "2026-10-04T12:00:00+09:60"]) {
  for (const boundary of ["publisher", "JS client"]) test(`${boundary} rejects out-of-contract release time ${releasedAt}`, async () => {
    const metadata = JSON.parse(await readFile(new URL("../apps/web/public/download/android-release.json", import.meta.url), "utf8"));
    assert.throws(() => boundary === "publisher" ? buildAndroidRelease({ ...metadata, releasedAt, apkBytes: Buffer.from([1]) }) : validateAndroidRelease({ ...metadata, releasedAt }));
  });
}

test("publisher and real JS client accept one through nine fractional second digits", async () => {
  const metadata = JSON.parse(await readFile(new URL("../apps/web/public/download/android-release.json", import.meta.url), "utf8"));
  for (const releasedAt of ["2026-10-04T23:59:59.1Z", "2026-10-04T23:59:59.123456789+09:00"]) {
    assert.equal(validateAndroidRelease(buildAndroidRelease({ ...metadata, releasedAt, apkBytes: Buffer.from([1]) })).releasedAt, releasedAt);
  }
});

const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const publicRoot = new URL("../apps/web/public/", import.meta.url);
const firstRoute = path => config.routes.find(route => route.src && new RegExp(`^${route.src}$`).test(path));

test("release JSON route provides uncached JSON before filesystem and SPA handling", () => {
  const route = firstRoute("/download/android-release.json");
  assert.equal(route?.dest, "/download/android-release.json");
  assert.equal(route.headers["Content-Type"], "application/json; charset=utf-8");
  assert.equal(route.headers["Cache-Control"], "no-store");
  assert.ok(config.routes.indexOf(route) < config.routes.findIndex(item => item.handle === "filesystem"));
  assert.notEqual(firstRoute("/download/android-releaseXjson")?.dest, "/download/android-release.json");
});

test("fixed APK address redirects temporarily to a public APK without caching an old release", () => {
  const route = firstRoute("/download/android.apk");
  assert.equal(route?.status, 307);
  const target = new URL(route.headers.Location);
  assert.equal(target.origin, "https://github.com");
  assert.equal(target.pathname, "/zxcc9867/studyRoom/releases/download/android-v0.2.4-build7/study-room-0.2.4-build7.apk");
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

test("public release manifest matches the actual final APK contract and stable redirect", async () => {
  const bytes = await readFile(new URL("download/android-release.json", publicRoot));
  assert.ok(bytes.length <= 16 * 1024);
  const release = validateAndroidRelease(JSON.parse(bytes));
  assert.equal(release.versionName, "0.2.4");
  assert.equal(release.versionCode, 7);
  assert.equal(release.releasedAt, "2026-10-08T06:07:54Z");
  assert.equal(release.sizeBytes, 61994067);
  assert.equal(release.sha256, "a473233cd309f5e69e8ceb071e7a45f628873b977a28f075da92fdddfb42218b");
  assert.equal(release.apkUrl, firstRoute("/download/android.apk").headers.Location);
  assert.ok(release.sizeBytes > 11, "Production metadata must not contain the APK test fixture");
  assert.notEqual(release.sha256, "3934be6f0ca5c6c3efc3576bb846f79a8512db715c6a8103b034cb29e676fd8e");
  assert.deepEqual(Object.keys(JSON.parse(bytes)).sort(), ["apkUrl", "packageName", "releaseNotes", "releasedAt", "schemaVersion", "sha256", "sizeBytes", "versionCode", "versionName"]);
});

test("configured public JSON and APK routes deliver matching responses ahead of the SPA", async () => {
  const server = createServer(async (request, response) => {
    const route = firstRoute(new URL(request.url, "http://127.0.0.1").pathname);
    response.writeHead(route.status || 200, route.headers || {});
    if (!route.dest) return response.end();
    try { response.end(await readFile(new URL(`.${route.dest}`, publicRoot))); }
    catch { response.end("Missing public asset"); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const json = await fetch(`${origin}/download/android-release.json`);
    assert.equal(json.status, 200);
    assert.equal(json.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(json.headers.get("cache-control"), "no-store");
    const release = validateAndroidRelease(await json.json());
    const apk = await fetch(`${origin}/download/android.apk`, { redirect: "manual" });
    assert.equal(apk.status, 307);
    assert.equal(apk.headers.get("cache-control"), "no-store");
    assert.equal(apk.headers.get("location"), release.apkUrl);
    const page = await fetch(`${origin}/download/android`);
    assert.equal(page.status, 200);
    assert.equal(page.headers.get("cache-control"), "no-store");
    assert.match(await page.text(), /0\.2\.4 · 빌드 7/);
    const api = await fetch(`${origin}/api/not-found`);
    assert.equal(api.status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
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
      assert.ok(await page.getByText("0.2.4 · 빌드 7", { exact: false }).isVisible());
      const changes = page.getByRole("region", { name: "이번 업데이트 내용" });
      assert.equal(await changes.count(), 1);
      const release = JSON.parse(await readFile(new URL("download/android-release.json", publicRoot), "utf8"));
      assert.deepEqual(await changes.getByRole("listitem").allTextContents(), release.releaseNotes);
      assert.equal(await changes.getByRole("link").count(), 0);
      assert.ok((await changes.boundingBox()).y < (await page.getByRole("heading", { name: "첫 업데이트는 한 번 수동으로" }).boundingBox()).y);
      assert.ok(await page.getByRole("heading", { name: "첫 업데이트는 한 번 수동으로" }).isVisible());
      assert.ok(await page.getByRole("heading", { name: "다음 버전부터는 앱에서" }).isVisible());
      assert.ok(await page.locator("#app-update-title + ol").getByText("앱 업데이트", { exact: false }).isVisible());
      assert.ok(await page.locator("#app-update-title + ol").getByText("설치 확인", { exact: false }).isVisible());
      assert.equal(await page.locator("script").count(), 0);
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
