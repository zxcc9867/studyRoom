import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { isValidSlackChannelId, normalizeSlackChannelId } from "../src/slackChannelId.mjs";
import { buildSlackUserMention, isValidSlackUserId, normalizeSlackUserId } from "../src/slackUserId.mjs";

test("normalizes slack channel IDs", () => {
  assert.equal(normalizeSlackChannelId(" c123abc456 "), "C123ABC456");
  assert.equal(normalizeSlackChannelId(null), "");
});

test("web app blocks study start for every pending recovery routine", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const dataSource = readFileSync("apps/web/src/dashboardData.ts", "utf8");

  assert.match(appSource, /type StudyRecoveryRequest/);
  assert.match(appSource, /studyRecoveryRequests/);
  assert.match(dataSource, /\.from\("study_recovery_requests"\)/);
  assert.match(appSource, /pendingRecoveryRequests/);
  assert.match(appSource, /blockingRecoveryRequests/);
  assert.doesNotMatch(appSource, /lateStudyRecoveryRequests/);
  assert.doesNotMatch(appSource, /recovery-soft/);
  assert.match(appSource, /recovery-blocker/);
  assert.doesNotMatch(appSource, /trigger_type !== "missed_attendance"/);
  assert.match(appSource, /recoveryAutoEndInFlightRef/);
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
  assert.match(appSource, /repeat_forever/);
  assert.match(appSource, /todoRepeatForever/);
  assert.match(appSource, /getForeverRepeatEndDate/);
  assert.match(appSource, /\.eq\("repeat_group_id", todo\.repeat_group_id\)/);
  assert.match(appSource, /formatTodoRepeatLabel/);
  assert.match(appSource, /todo-meta-chip/);
  assert.match(appSource, /영구 반복/);
  assert.match(styleSource, /\.todo-meta-row/);
  assert.match(styleSource, /\.todo-repeat-note/);
});

test("todo schedule modal keeps all same-day todos selectable while editing", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");

  assert.match(appSource, /visibleTodoModalItems/);
  assert.match(appSource, /selectedDateTodos/);
  assert.doesNotMatch(appSource, /editingTodo \? \[editingTodo\] : selectedDateTodos/);
  assert.match(appSource, /renderTodoScheduleList\(visibleTodoModalItems,/);
  assert.doesNotMatch(appSource, /renderTodoList\(selectedDateTodos,/);
});

test("todo schedule modal applies time without completing todos", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const renderStart = appSource.indexOf("function renderTodoScheduleList");
  const renderEnd = appSource.indexOf("function renderDailyPlanner", renderStart);
  const modalListSource = appSource.slice(renderStart, renderEnd);

  assert.ok(renderStart > 0, "renderTodoScheduleList should exist");
  assert.ok(modalListSource.includes("applyTodoScheduleFromModal"));
  assert.ok(appSource.includes("todo-link-heading"));
  assert.ok(appSource.includes("\\uD560\\uC77C \\uC5F0\\uACB0"));
  assert.equal(modalListSource.includes("startTodoEditing(todo)"), false);
  assert.equal(modalListSource.includes("deleteTodo(todo)"), false);
  assert.equal(modalListSource.includes("toggleTodo(todo)"), false);
  assert.ok(appSource.includes("renderTodoScheduleList(visibleTodoModalItems,"));
});

test("daily planner detail shows a daily todo list with schedule labels and row edit actions", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const plannerStart = appSource.indexOf("function renderDailyPlanner");
  const plannerEnd = appSource.indexOf("function renderTodaySectionOrderEditor", plannerStart);
  const plannerSource = appSource.slice(plannerStart, plannerEnd);

  assert.ok(plannerSource.includes("planner-detail-list"));
  assert.ok(plannerSource.includes("selectedPlannerTodos.map((todo)"));
  assert.ok(plannerSource.includes("formatTodoScheduleLabel(todo)"));
  assert.ok(plannerSource.includes("startTodoEditing(todo)"));
  assert.ok(plannerSource.includes("deleteTodo(todo)"));
});

test("end study button opens a completion modal before ending the session", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");

  assert.ok(appSource.includes("endSessionCompletionModalOpen"));
  assert.ok(appSource.includes("openEndSessionCompletionModal"));
  assert.ok(appSource.includes("confirmEndSessionWithCompletions"));
  assert.ok(appSource.includes("getEndSessionCompletionCandidates"));
  assert.ok(appSource.includes("<SessionReflectionModal"));
  assert.ok(appSource.includes("void openEndSessionCompletionModal();"));
});

test("daily planner detail exposes direct completion only outside active sessions", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const plannerStart = appSource.indexOf("function renderDailyPlanner");
  const plannerEnd = appSource.indexOf("function renderTodaySectionOrderEditor", plannerStart);
  const plannerSource = appSource.slice(plannerStart, plannerEnd);

  assert.ok(appSource.includes("async function toggleTodoCompletion(todo: StudyTodo)"));
  assert.ok(appSource.includes("if (activeSession)"));
  assert.ok(appSource.includes("setTodosCompleted([todo.id], !todo.is_completed)"));
  assert.ok(plannerSource.includes("toggleTodoCompletion(selectedPlannerSegment.todo)"));
  assert.ok(plannerSource.includes('selectedPlannerSegment.todo.is_completed ? "\\uBBF8\\uC644\\uB8CC\\uB85C \\uBCC0\\uACBD" : "\\uC644\\uB8CC \\uCCB4\\uD06C"'));
  assert.ok(plannerSource.includes("disabled={todoBusy || Boolean(activeSession)}"));
});

test("untimed planner todos can be completed from their checkbox outside active sessions", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const listStart = appSource.indexOf("function renderTodoList");
  const listEnd = appSource.indexOf("function renderTodoScheduleList", listStart);
  const listSource = appSource.slice(listStart, listEnd);

  assert.ok(listSource.includes("checked={todo.is_completed}"));
  assert.ok(listSource.includes("disabled={todoBusy || Boolean(activeSession)}"));
  assert.ok(listSource.includes("onChange={() => void toggleTodoCompletion(todo)}"));
  assert.equal(listSource.includes("readOnly"), false);
});
test("daily planner follows the selected calendar date and can copy a plan to multiple dates", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");

  assert.ok(appSource.includes("getPlannerDateLabel(selectedTodoDate, todayDateKey)"));
  assert.ok(appSource.includes("const selectedPlannerTodos = useMemo("));
  assert.ok(appSource.includes("buildDailyPlannerSegments(selectedPlannerTodos, selectedTodoDate)"));
  assert.ok(appSource.includes("showPlannerDate(day.dateKey)"));
  assert.ok(appSource.includes("planCopyModalOpen"));
  assert.ok(appSource.includes("copySelectedPlannerDateToTargets"));
  assert.ok(appSource.includes("buildPlanCopyRows({"));
  assert.ok(appSource.includes("normalizePlanCopyTargetDates({"));
});
test("validates slack public and private channel IDs", () => {
  assert.equal(isValidSlackChannelId("C123ABC456"), true);
  assert.equal(isValidSlackChannelId("G123ABC456"), true);
  assert.equal(isValidSlackChannelId("D123ABC456"), false);
  assert.equal(isValidSlackChannelId("@study_room_alerts"), false);
  assert.equal(isValidSlackChannelId("abc"), false);
});

test("normalizes and validates slack user IDs for mentions", () => {
  assert.equal(normalizeSlackUserId(" u123abc456 "), "U123ABC456");
  assert.equal(normalizeSlackUserId("<@u123abc456>"), "U123ABC456");
  assert.equal(normalizeSlackUserId(null), "");
  assert.equal(isValidSlackUserId("U123ABC456"), true);
  assert.equal(isValidSlackUserId("W123ABC456"), true);
  assert.equal(isValidSlackUserId("C123ABC456"), false);
  assert.equal(isValidSlackUserId("@wonjin"), false);
  assert.equal(buildSlackUserMention("U123ABC456"), "<@U123ABC456>");
  assert.equal(buildSlackUserMention(""), "");
});

test("session lease Slack warning can mention the saved Slack user ID", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const slackSource = readFileSync("apps/web/src/slackNotifications.mjs", "utf8");
  const attendanceSource = readFileSync("supabase/functions/attendance-cron/index.ts", "utf8");
  const migrationSource = readFileSync("supabase/migrations/20260705125944_slack_user_mentions.sql", "utf8");

  assert.match(migrationSource, /add column if not exists slack_user_id text/i);
  assert.match(migrationSource, /slack_user_id text/i);
  assert.match(migrationSource, /nt\.slack_user_id/i);
  assert.match(migrationSource, /drop function if exists public\.get_due_session_lease_warnings/i);
  assert.match(slackSource, /select\("destination,enabled,updated_at,slack_user_id"\)/);
  assert.match(slackSource, /slack_user_id: nextSlackUserId \|\| null/);
  assert.match(appSource, /Slack User ID/);
  assert.match(appSource, /setSlackUserId/);
  assert.match(attendanceSource, /slack_user_id: string \| null/);
  assert.match(attendanceSource, /buildSlackUserMention\(warning\.slack_user_id\)/);
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
  assert.match(functionSource, /admin\.auth\.getUser\(jwt\)/);
  assert.match(functionSource, /loadSlackTarget\(admin, authResult\.userId\)/);
  assert.match(functionSource, /\.eq\("user_id", userId\)/);
  assert.match(functionSource, /https:\/\/slack\.com\/api\/chat\.postMessage/);
  assert.match(functionSource, /getSlackBotToken\(\)/);
  assert.match(functionSource, /STUDY_ALERT_SLACK_BOT_TOKEN/);
  assert.match(functionSource, /parseDirectChannelId/);
  assert.match(functionSource, /directChannelId/);
  assert.match(functionSource, /parseRecoveryRequestId/);
  assert.match(functionSource, /loadRecoveryRequest/);
  assert.match(functionSource, /sendRecoveryRoutineTestMessage/);
  assert.match(functionSource, /open_recovery_routine/);
  assert.match(functionSource, /\.from\("study_recovery_requests"\)/);
});

test("web app exposes a clear slack channel save action before testing", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");

  assert.match(appSource, /saveSlackChannelSettings/);
  assert.match(appSource, /setSlackStatus/);
  assert.match(appSource, /setSlackChannelId/);
});

test("web app explains when the current account has no saved slack channel target", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");

  assert.match(appSource, /slackStatus/);
  assert.match(appSource, /connected/);
  assert.match(appSource, /channelId/);
});

test("settings page shows notification diagnostics from recent delivery rows", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const dataSource = readFileSync("apps/web/src/dashboardData.ts", "utf8");
  const styleSource = readFileSync("apps/web/src/styles.css", "utf8");

  assert.match(appSource, /NotificationDeliveryRow/);
  assert.match(appSource, /notificationDeliveries/);
  assert.match(dataSource, /\.from\("notification_deliveries"\)/);
  assert.match(appSource, /buildNotificationDiagnostics/);
  assert.match(appSource, /notification-diagnostics-card/);
  assert.match(appSource, /legacy-notification-note/);
  assert.match(styleSource, /\.notification-diagnostics-card/);
  assert.match(styleSource, /\.diagnostic-state-ready/);
});

test("kakao notification UI and OAuth linking are removed from the web app", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const authProviderSource = readFileSync("apps/web/src/authProviders.mjs", "utf8");

  assert.doesNotMatch(appSource, /Kakao|kakao/);
  assert.doesNotMatch(authProviderSource, /Kakao|kakao|talk_message/);
});
