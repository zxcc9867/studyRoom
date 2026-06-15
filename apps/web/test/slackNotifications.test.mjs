import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { isValidSlackChannelId, normalizeSlackChannelId } from "../src/slackChannelId.mjs";

test("normalizes slack channel IDs", () => {
  assert.equal(normalizeSlackChannelId(" c123abc456 "), "C123ABC456");
  assert.equal(normalizeSlackChannelId(null), "");
});

test("web app blocks study start for blocking recovery routines while allowing same-day missed recovery study", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");

  assert.match(appSource, /type StudyRecoveryRequest/);
  assert.match(appSource, /studyRecoveryRequests/);
  assert.match(appSource, /\.from\("study_recovery_requests"\)/);
  assert.match(appSource, /pendingRecoveryRequests/);
  assert.match(appSource, /blockingRecoveryRequests/);
  assert.match(appSource, /lateStudyRecoveryRequests/);
  assert.match(appSource, /recovery-blocker/);
  assert.match(appSource, /회복 루틴 필요/);
  assert.match(appSource, /trigger_type !== "missed_attendance"/);
  assert.match(appSource, /목표 시간을 채우면 출석으로 전환/);
  assert.match(appSource, /blockingRecoveryRequests\.length > 0/);
  assert.match(appSource, /Recovery routine required/);
});

test("web app exposes editing controls for scheduled and recurring todos", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const styleSource = readFileSync("apps/web/src/styles.css", "utf8");

  assert.match(appSource, /editingTodoId/);
  assert.match(appSource, /startTodoEditing/);
  assert.match(appSource, /saveTodo/);
  assert.match(appSource, /repeat_group_id/);
  assert.match(appSource, /repeat_weekdays/);
  assert.match(appSource, /repeat_until/);
  assert.match(appSource, /formatTodoRepeatLabel/);
  assert.match(appSource, /todo-meta-chip/);
  assert.match(styleSource, /\.todo-meta-row/);
});

test("validates slack public and private channel IDs", () => {
  assert.equal(isValidSlackChannelId("C123ABC456"), true);
  assert.equal(isValidSlackChannelId("G123ABC456"), true);
  assert.equal(isValidSlackChannelId("D123ABC456"), false);
  assert.equal(isValidSlackChannelId("@study_room_alerts"), false);
  assert.equal(isValidSlackChannelId("abc"), false);
});

test("web app exposes an authenticated slack test alarm action", () => {
  const source = readFileSync("apps/web/src/slackNotifications.mjs", "utf8");
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const functionSource = readFileSync("supabase/functions/slack-test-alarm/index.ts", "utf8");

  assert.match(source, /export async function sendSlackTestAlarm\(session\)/);
  assert.match(source, /\/functions\/v1\/slack-test-alarm/);
  assert.match(source, /authorization: `Bearer \$\{session\.access_token\}`/);
  assert.match(source, /kind:\s*"slack"/);
  assert.match(appSource, /sendSlackTestAlarm\(session\)/);
  assert.match(appSource, /Slack 테스트 알림/);
  assert.match(functionSource, /admin\.auth\.getUser\(jwt\)/);
  assert.match(functionSource, /loadSlackTarget\(admin, authResult\.userId\)/);
  assert.match(functionSource, /\.eq\("user_id", userId\)/);
  assert.match(functionSource, /https:\/\/slack\.com\/api\/chat\.postMessage/);
  assert.match(functionSource, /getSlackBotToken\(\)/);
  assert.match(functionSource, /STUDY_ALERT_SLACK_BOT_TOKEN/);
  assert.match(functionSource, /parseDirectChannelId/);
  assert.match(functionSource, /directChannelId/);
});

test("web app exposes a clear slack channel save action before testing", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");

  assert.match(appSource, /saveSlackChannelSettings/);
  assert.match(appSource, /Slack 채널 저장/);
  assert.match(appSource, /Slack Channel ID를 저장했습니다/);
});

test("web app explains when the current account has no saved slack channel target", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");

  assert.match(appSource, /이 계정에는 Slack Channel ID가 저장되어 있지 않습니다/);
  assert.match(appSource, /설정에서 Slack Channel ID를 저장/);
});

test("kakao notification UI and OAuth linking are removed from the web app", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const authProviderSource = readFileSync("apps/web/src/authProviders.mjs", "utf8");

  assert.doesNotMatch(appSource, /Kakao|kakao|카카오/);
  assert.doesNotMatch(authProviderSource, /Kakao|kakao|talk_message/);
});
