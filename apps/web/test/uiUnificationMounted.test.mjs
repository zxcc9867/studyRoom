import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

let chromium;
try { ({ chromium } = await import(process.env.FEED_BROWSER_MODULE ? pathToFileURL(process.env.FEED_BROWSER_MODULE).href : 'playwright')); } catch {}
const browserTest = (name, run) => test(name, { skip: !chromium && 'Chrome runtime required for mounted UI verification' }, run);
const css = (await Promise.all(['styles.css', 'actualStudy.css', 'studyReports.css', 'dashboardRedesign.css', 'appTheme.css']
  .map(file => readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')))).join('\n');
const source = `import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import ReflectionInbox from './ReflectionInboxCard';
import StudyReport from './StudyReportSection';
const rows=[{id:'test-one',local_date:'2026-10-28',duration_seconds:60},{id:'test-two',local_date:'2026-10-26',duration_seconds:3600},{id:'test-three',local_date:'2026-10-26',duration_seconds:7200}];
window.testRecords=rows;window.testCalls=[];
const failure=new URL(location.href).searchParams.has('error');
function response(data){const q={};for(const method of ['select','eq','gte','lte','order','range','maybeSingle','abortSignal'])q[method]=()=>q;q.then=(resolve,reject)=>Promise.resolve({data,error:failure?{message:'TEST ONLY unavailable'}:null}).then(resolve,reject);return q;}
const client={from(table){window.testCalls.push(table);return response(table==='profiles'?{time_zone:'Asia/Tokyo'}:[]);},rpc(name){window.testCalls.push(name);return response(name==='get_actual_study_report'?{plans:[],on_time_ratio:null,adjustment_count:0,unstarted_count:0,started_count:0}:{completed_seconds:0,completed_session_count:0,anomaly_session_count:0,cross_date_session_count:0});}};
function Fixture(){const [opened,setOpened]=useState('');return <div className="dashboard-redesign"><main className="workspace"><section className="history-panel my-page-panel"><h2>내 페이지 · 테스트 데이터</h2><ReflectionInbox items={new URL(location.href).searchParams.has('empty')?[]:rows} onOpen={setOpened}/><output aria-label="열린 회고">{opened}</output><StudyReport client={client} userId="synthetic-ui-owner" nowMs={Date.parse('2026-10-28T06:00:00Z')} sessions={[]} todos={[]} attendanceDays={[]} reflections={[]}/></section></main></div>;}createRoot(document.getElementById('root')).render(<Fixture/>);`;
const bundle = await build({ stdin: { contents: source, loader: 'tsx', resolveDir: fileURLToPath(new URL('../src', import.meta.url)) },
  bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic', loader: { '.css': 'empty' }, logLevel: 'silent' });

async function withView(width, run, query = '') {
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', request.url === '/fixture.js' ? 'text/javascript' : 'text/html; charset=utf-8');
    response.end(request.url === '/fixture.js' ? bundle.outputFiles[0].text
      : `<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script type="module" src="/fixture.js"></script></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.FEED_BROWSER_EXECUTABLE || undefined });
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.goto(`http://127.0.0.1:${server.address().port}/${query}`);
    await page.getByRole('heading', { name: '내 페이지 · 테스트 데이터' }).waitFor();
    await run(page);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}

async function sharedStyle(locator) {
  return locator.evaluate(el => {
    const s = getComputedStyle(el), root = getComputedStyle(document.documentElement);
    return { borderStyle: s.borderTopStyle, shadow: s.boxShadow, color: s.color, background: s.backgroundColor,
      outline: s.outlineColor, fontSize: parseFloat(s.fontSize), primary: root.getPropertyValue('--study-primary').trim() };
  });
}

async function contrastRatio(locator) {
  return locator.evaluate(element => {
    const rgb = value => value.match(/[\d.]+/g).map(Number);
    const luminance = values => values.slice(0, 3).map(value => {
      value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    let background = [255, 255, 255];
    const ancestors = []; for (let node = element; node; node = node.parentElement) ancestors.unshift(node);
    for (const node of ancestors) {
      const color = rgb(getComputedStyle(node).backgroundColor), alpha = color[3] ?? 1;
      background = color.slice(0, 3).map((value, index) => value * alpha + background[index] * (1 - alpha));
    }
    const foreground = luminance(rgb(getComputedStyle(element).color)), surface = luminance(background);
    return (Math.max(foreground, surface) + .05) / (Math.min(foreground, surface) + .05);
  });
}

for (const width of [375, 1440]) for (const scale of [1, 2]) browserTest(`shared UI: reflection and report stay readable and flat at ${width}px / ${scale}x text`, () => withView(width, async page => {
  if (scale === 2) await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await page.locator('.study-report-ready').waitFor();
  const row = page.locator('.reflection-inbox-item').first();
  assert.equal((await sharedStyle(row)).borderStyle, 'solid', 'reflection rows use the shared solid separator, not the old yellow postage border');
  const action = row.getByRole('button');
  assert.equal((await sharedStyle(action)).shadow, 'none');
  await action.hover();
  assert.equal((await sharedStyle(action)).shadow, 'none', 'hover must not restore the old raised button');
  assert.equal(await page.locator('.reflection-inbox-stamp').count(), 0);
  assert.equal(await page.locator('.reflection-inbox .eyebrow, .study-report .eyebrow').count(), 0);
  await page.getByRole('heading', { name: '남겨둔 회고' }).waitFor();
  assert.equal(await page.locator('.reflection-inbox-count').innerText(), '3개');
  assert.ok((await sharedStyle(row.locator('strong'))).fontSize >= 16 * scale, 'shared text follows the user font size');
  const before = await page.evaluate(() => structuredClone(testRecords));
  await action.focus();
  const outline = await action.evaluate(el => { const s=getComputedStyle(el); return {width:parseFloat(s.outlineWidth),style:s.outlineStyle}; });
  assert.equal(outline.style, 'solid'); assert.ok(outline.width >= 3);
  await page.keyboard.press('Enter');
  assert.equal(await page.getByLabel('열린 회고').innerText(), 'test-one');
  assert.deepEqual(await page.evaluate(() => testRecords), before);
  await page.getByRole('button', { name: '월간', exact: true }).click();
  // Native month inputs have browser-specific roles; the stable accessible label is the contract.
  const period = page.getByLabel('리포트 월', { exact: true });
  await period.focus();
  assert.equal((await sharedStyle(period)).outline, 'rgb(47, 107, 82)', 'report focus uses the shared green, not legacy terracotta');
  assert.equal((await sharedStyle(period)).background, 'rgb(255, 255, 255)');
  for (const text of await page.locator('.reflection-inbox-intro, .reflection-inbox-count, .reflection-inbox-copy strong, .reflection-inbox-copy > span, .reflection-inbox button, .reflection-inbox-note, .study-report-navigation label, .study-report button, .study-report-empty, .study-report-footnote').all()) {
    assert.ok(await contrastRatio(text) >= 4.5, `text contrast is insufficient: ${await text.innerText()}`);
  }
  for (const control of await page.locator('.reflection-inbox button, .study-report button, .study-report input').all()) {
    const box = await control.boundingBox(); assert.ok(box.height >= 44 && box.width >= 44);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await page.locator('.reflection-inbox').evaluate(el => el.scrollWidth <= el.clientWidth), true);
  await mkdir('output/playwright', { recursive: true });
  await page.screenshot({ path: `output/playwright/ui-unified-${width}-${scale}x.png`, fullPage: true });
}));

browserTest('shared UI: empty reflection inbox stays absent and failed reports remain retryable', () => withView(375, async page => {
  assert.equal(await page.locator('.reflection-inbox').count(), 0);
  const error = page.locator('.study-report-error'); await error.waitFor();
  await error.getByRole('button', { name: '다시 불러오기' }).click();
  await error.waitFor();
  assert.equal(await page.locator('.weekly-review-metric').count(), 0, 'errors must not look like a valid zero-study report');
  assert.deepEqual(await page.evaluate(() => testRecords.map(row=>row.id)), ['test-one','test-two','test-three']);
}, '?empty&error'));
