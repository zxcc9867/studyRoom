import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Browser module/executable are supplied explicitly by the local operator.
const { chromium } = await import(process.env.FEED_BROWSER_MODULE ? pathToFileURL(process.env.FEED_BROWSER_MODULE).href : 'playwright');
process.env.README_FIXTURE_PORT ||= '4185';
const { server } = await import('./serve-readme-fixture.mjs');
const root = new URL('../', import.meta.url);
const imageDir = new URL('docs/images/', root);
await mkdir(imageDir, { recursive: true });
let browser;
const observations = [];
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.FEED_BROWSER_EXECUTABLE, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  for (const width of [1440, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, locale: 'ko-KR' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(10000);
    await page.clock.install({ time: new Date('2026-09-21T14:30:00Z') });
    await page.route(/^https:\/\/cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard@/, route => route.fulfill({ contentType: 'text/css', body: '' }));
    // Every non-local request is blocked. All data lives in the mounted fixture.
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/?mode=start#together`);
    const panel = page.locator('#together');
    await panel.getByLabel('팀 이름', { exact: true }).fill('[테스트] 함께 자라는 공부방');
    await panel.getByRole('button', { name: '팀 만들기', exact: true }).click();
    await panel.getByRole('heading', { name: '[테스트] 함께 자라는 공부방', exact: true }).waitFor();
    await panel.getByLabel('목표', { exact: true }).fill('[테스트] 작은 프로젝트 완성하기');
    await panel.getByRole('button', { name: '목표 저장', exact: true }).click();
    await page.evaluate(() => {
      fixture.team.members[0].display_name = '[테스트] 나의 자리';
      fixture.team.members[0].state = 'ready';
      fixture.team.members.push({ user_id: 'synthetic-friend', display_name: '[테스트] 함께 읽는 친구', state: 'resting', title: null, share_title: false, goal: '[테스트] 알고리즘 연습', share_goal: true });
      fixture.team.team.member_count = 2;
      fixture.team.forest = { accepted_seconds: 18000, pending_sessions: 1, trees: 2, progress_seconds: 3600 };
      fixture.signal();
    });
    await page.clock.runFor(300);
    await panel.getByText('[테스트] 함께 읽는 친구', { exact: true }).waitFor();
    assert.ok(await panel.getByText('팀장', { exact: true }).count());
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const roomFile = `team-study-current-${width}.png`;
    await page.screenshot({ path: fileURLToPath(new URL(roomFile, imageDir)), fullPage: true });
    await panel.getByRole('button', { name: '팀 숲', exact: true }).click();
    await panel.getByRole('heading', { name: '함께 키우는 숲', exact: true }).waitFor();
    const forestFile = `team-forest-current-${width}.png`;
    await page.screenshot({ path: fileURLToPath(new URL(forestFile, imageDir)), fullPage: true });
    await page.goto(`http://127.0.0.1:${server.address().port}/?mode=start#today`);
    await page.locator('.topbar-actions button').first().click();
    await page.getByRole('button', { name: '카메라 켜고 시작', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '이번 세션에서 할 일' });
    await dialog.getByRole('checkbox', { name: /집중 독서/ }).check();
    await dialog.getByRole('button', { name: '집중 독서 시간 편집', exact: true }).click();
    const editor = dialog.getByRole('group', { name: '집중 독서 시간 편집', exact: true });
    await editor.getByLabel('시작', { exact: true }).fill('22:30');
    await editor.getByLabel('종료', { exact: true }).fill('00:45');
    await editor.getByLabel('종료', { exact: true }).press('Tab');
    const editFile = `session-todo-time-edit-current-${width}.png`;
    await dialog.screenshot({ path: fileURLToPath(new URL(editFile, imageDir)) });
    await editor.getByRole('button', { name: '시간 저장', exact: true }).click();
    await dialog.getByText('22:30-00:45 집중 독서', { exact: true }).waitFor();
    assert.equal(await dialog.getByRole('checkbox', { name: /집중 독서/ }).isChecked(), true);
    assert.equal(await page.evaluate(() => fixture.sessions.length), 0);
    let recovery;
    if (width === 375 && process.env.README_CAPTURE_RECOVERY === 'true') {
      await dialog.getByRole('button', { name: '집중 독서 시간 편집', exact: true }).click();
      await editor.getByLabel('시작', { exact: true }).fill('22:45');
      await editor.getByLabel('종료', { exact: true }).fill('00:55');
      await page.evaluate(() => { fixture.holdTodoTimeWrite = true; fixture.todoTimeReadFailure = true; });
      await editor.getByRole('button', { name: '시간 저장', exact: true }).click();
      await page.waitForFunction(() => Boolean(fixture.releaseTodoTimeWrite));
      await page.clock.runFor(15001);
      await editor.getByRole('button', { name: '다시 확인', exact: true }).waitFor();
      const before = await page.evaluate(() => fixture.calls.filter(call => call.name === 'study_todos.update').length);
      await editor.getByRole('button', { name: '다시 확인', exact: true }).click();
      await editor.getByRole('button', { name: '다시 확인', exact: true }).waitFor();
      const after = await page.evaluate(() => fixture.calls.filter(call => call.name === 'study_todos.update').length);
      assert.equal(after, before, 'unknown-state recheck must not issue another write');
      assert.equal(await editor.getByLabel('시작', { exact: true }).inputValue(), '22:45');
      assert.equal(await editor.getByLabel('종료', { exact: true }).inputValue(), '00:55');
      assert.equal(await editor.getByRole('button', { name: '취소', exact: true }).isEnabled(), true);
      const recoveryFile = 'session-todo-time-recovery-current-375.png';
      await dialog.screenshot({ path: fileURLToPath(new URL(recoveryFile, imageDir)) });
      recovery = { image: recoveryFile, timeoutMs: 15000, readOnlyRecheck: true, retainedDraft: true, cancelEnabled: true };
    }
    assert.deepEqual(errors, []);
    observations.push({ width, images: [roomFile, forestFile, editFile], horizontalOverflow: false, todoTimeSaved: true, selectedTodoPreserved: true, noSessionStarted: true, pageErrors: errors, ...(recovery ? { recovery } : {}) });
    await context.close();
  }
  await mkdir(new URL('output/readme-current/', root), { recursive: true });
  await writeFile(new URL('output/readme-current/capture.json', root), JSON.stringify({ scope: 'real React app; local synthetic mounted boundary; no live account or remote data', observations }, null, 2));
  console.log(JSON.stringify(observations));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
