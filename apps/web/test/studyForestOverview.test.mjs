import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

let chromium;
try { ({ chromium } = await import(process.env.FEED_BROWSER_MODULE ? pathToFileURL(process.env.FEED_BROWSER_MODULE).href : "playwright")); } catch {}
const browserTest = (name, run) => test(name, { skip: !chromium && "Chrome runtime required for forest UI verification" }, run);
const css = (await Promise.all(["styles.css", "dashboardRedesign.css", "appTheme.css"].map(file => readFile(new URL(`../src/${file}`, import.meta.url), "utf8")))).join("\n");
const source = `import React from 'react';
import {createRoot} from 'react-dom/client';
import StudyForestSection from './StudyForestSection';
window.forestFixture={attendanceDays:Array.from({length:11},(_,i)=>({local_date:'2026-10-'+String(i+19).padStart(2,'0'),status:'present'})),sessions:Array.from({length:5},(_,i)=>({started_at:'2026-10-'+(i+18)+'T03:00:00Z',ended_at:'2026-10-'+(i+18)+'T03:10:00Z',duration_seconds:600,status:'completed'})),saves:[]};
createRoot(document.getElementById('root')).render(<div className="dashboard-redesign"><main className="workspace"><StudyForestSection userId="forest-test-owner" todayDateKey="2026-10-29" attendanceDays={forestFixture.attendanceDays} sessions={forestFixture.sessions} timeZone="Asia/Tokyo" weeklyHabitTarget={{targetDays:5,restAllowanceDays:2,creditedStartDays:3,remainingTargetDays:2,targetReached:false,progressPercent:60}}/></main></div>);`;
const bundle = await build({ stdin: { contents: source, loader: "tsx", resolveDir: fileURLToPath(new URL("../src", import.meta.url)) }, bundle: true, write: false, outdir: "fixture", format: "esm", platform: "browser", jsx: "automatic", logLevel: "silent", plugins: [{ name: "forest-storage-boundary", setup(b) {
  b.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: "forest-backend", namespace: "fixture" }));
  b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ loader: "js", contents: `export const supabase={from(table){if(table!=='study_forest_preferences')throw Error('Unexpected table');const query={select(){return query},eq(key,value){if(key!=='user_id'||value!=='forest-test-owner')throw Error('Wrong preference owner');return query},maybeSingle:async()=>({data:null,error:location.search.includes('error')?{message:'설정 연결 실패'}:null}),upsert:async(value)=>{forestFixture.saves.push(value);return {error:null}}};return query;}};` }));
} }] });

async function withForest(width, run, { theme = "light", scale = 1, query = "" } = {}) {
  const js = bundle.outputFiles.find(file => file.path.endsWith(".js")).text;
  const forestCss = bundle.outputFiles.find(file => file.path.endsWith(".css"))?.text ?? "";
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", request.url === "/fixture.js" ? "text/javascript" : "text/html; charset=utf-8");
    response.end(request.url === "/fixture.js" ? js : `<!doctype html><html lang="ko" data-study-theme="${theme}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n${forestCss}\nhtml{font-size:${scale * 100}%}</style><div id="root"></div><script type="module" src="/fixture.js"></script></html>`);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.FEED_BROWSER_EXECUTABLE || undefined });
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route(/^https:\/\/cdn\.jsdelivr\.net\//, route => route.fulfill({ contentType: "text/css", body: "" }));
    await page.goto(`http://127.0.0.1:${server.address().port}/${query}`);
    await page.getByRole("heading", { name: "공부의 숲", exact: true }).waitFor();
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}

for (const width of [375, 1440]) browserTest(`forest overview reveals growth first and preserves customization and study records at ${width}px`, () => withForest(width, async page => {
  const before = await page.evaluate(() => structuredClone({ attendanceDays: forestFixture.attendanceDays, sessions: forestFixture.sessions }));
  const growth = page.getByRole("progressbar", { name: "이번 나무 성장" });
  await growth.waitFor();
  assert.equal(await growth.getAttribute("aria-valuenow"), "4");
  assert.equal(await growth.getAttribute("aria-valuemax"), "7");
  const fill = await growth.evaluate(element => ({ track: element.getBoundingClientRect().width, fill: element.firstElementChild.getBoundingClientRect().width, height: element.firstElementChild.getBoundingClientRect().height }));
  assert.ok(fill.fill / fill.track > .55 && fill.fill / fill.track < .59 && fill.height > 0, "the visible progress fill represents four of seven days");
  const next = page.locator(".forest-next-level-card");
  assert.match(await next.innerText(), /다음 변화까지 1일/);
  assert.ok((await next.boundingBox()).y < (await page.locator(".forest-weekly-reward-card").boundingBox()).y, "next tree milestone comes before the secondary weekly reward");
  assert.equal(await page.getByRole("progressbar", { name: "반딧불 화환을 위한 최근 7일 시작" }).getAttribute("aria-valuenow"), "3");
  await mkdir("output/playwright", { recursive: true });
  await page.screenshot({ path: `output/playwright/forest-overview-${width}-initial.png`, fullPage: true });
  const customizer = page.locator("details").filter({ has: page.locator("summary", { hasText: "숲 꾸미기" }) });
  assert.equal(await customizer.getAttribute("open"), null);
  assert.equal(await customizer.getByRole("button").first().isVisible(), false);
  await page.evaluate(() => { window.forestMovementKeys = []; document.addEventListener("keydown", event => { if (event.key === "ArrowDown") forestMovementKeys.push(event.defaultPrevented); }); });
  await page.getByRole("region", { name: "공부의 숲 탐험", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await customizer.locator("summary").focus();
  await page.keyboard.press("ArrowDown");
  assert.deepEqual(await page.evaluate(() => forestMovementKeys), [true, false], "movement stays on the scene focus while disclosure controls retain normal arrow keys");
  await page.keyboard.press("Enter");
  const locked = customizer.getByRole("button", { name: /완성 나무 1그루 후 공개/ }).first();
  assert.equal(await locked.isDisabled(), true);
  await customizer.getByRole("button", { name: "수확의 숲", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "저장했어요" }).waitFor();
  await customizer.locator("summary").click();
  await customizer.locator("summary").click();
  assert.equal(await customizer.getByRole("button", { name: "수확의 숲", exact: true }).getAttribute("aria-pressed"), "true");
  const history = page.locator("details").filter({ has: page.locator("summary", { hasText: "성장 단계와 모은 보상" }) });
  assert.equal(await history.getAttribute("open"), null);
  await history.locator("summary").click();
  assert.equal(await history.getByRole("list", { name: "나무 성장 단계" }).isVisible(), true);
  assert.match(await history.innerText(), /완성 나무 1그루/);
  assert.match(await history.innerText(), /화환 1개/);
  const help = page.locator("details").filter({ has: page.locator("summary", { hasText: "숲 이용 방법" }) });
  assert.equal(await help.getAttribute("open"), null);
  await help.locator("summary").click();
  assert.match(await help.innerText(), /방향키|WASD/);
  assert.match(await help.innerText(), /10분/);
  assert.deepEqual(await page.evaluate(() => ({ attendanceDays: forestFixture.attendanceDays, sessions: forestFixture.sessions })), before);
  assert.equal(await page.evaluate(() => forestFixture.saves[0].island_theme), "harvest");
}));

for (const width of [375, 1440]) for (const theme of ["light", "dark"]) browserTest(`forest overview fits ${width}px ${theme} with enlarged text and accessible disclosure controls`, () => withForest(width, async page => {
  const summaries = page.locator(".forest-overview-details > summary");
  assert.equal(await summaries.count(), 3);
  await mkdir("output/playwright", { recursive: true });
  await page.screenshot({ path: `output/playwright/forest-overview-${width}-${theme}-initial-2x.png` });
  for (const summary of await summaries.all()) {
    const box = await summary.boundingBox();
    assert.ok(box.height >= 44 && box.width >= 44);
    await summary.focus();
    assert.equal(await summary.evaluate(element => getComputedStyle(element).outlineStyle), "solid");
    await page.keyboard.press("Enter");
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  for (const element of await page.locator(".forest-status-card, .forest-overview-details").all()) {
    assert.equal(await element.evaluate(node => node.scrollWidth <= node.clientWidth), true);
  }
  const lowContrast = await page.locator(".forest-overview-label, .forest-growth-count strong, .forest-next-level-card > strong, .forest-overview-details > summary > span, .forest-overview-details > summary > small").evaluateAll(elements => {
    const rgb = value => value.match(/[\d.]+/g).map(Number);
    const luminance = values => values.slice(0, 3).map(value => { value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    return elements.filter(element => {
      let background = [255, 255, 255];
      const ancestors = []; for (let node = element; node; node = node.parentElement) ancestors.unshift(node);
      for (const node of ancestors) { const color = rgb(getComputedStyle(node).backgroundColor), alpha = color[3] ?? 1; background = color.slice(0, 3).map((value, index) => value * alpha + background[index] * (1 - alpha)); }
      const foreground = luminance(rgb(getComputedStyle(element).color)), surface = luminance(background);
      return (Math.max(foreground, surface) + .05) / (Math.min(foreground, surface) + .05) < 4.5;
    }).map(element => element.textContent);
  });
  assert.deepEqual(lowContrast, [], "overview labels and disclosure text meet 4.5:1 contrast");
  await mkdir("output/playwright", { recursive: true });
  await page.screenshot({ path: `output/playwright/forest-overview-${width}-${theme}-2x.png`, fullPage: true });
}, { theme, scale: 2 }));

browserTest("forest preference failures remain visible while customization is collapsed", () => withForest(375, async page => {
  await page.getByRole("status").filter({ hasText: "불러오지 못했어요" }).waitFor();
  assert.equal(await page.getByRole("status").isVisible(), true);
  assert.equal(await page.locator(".forest-customizer-details").getAttribute("open"), null);
}, { query: "?error" }));
