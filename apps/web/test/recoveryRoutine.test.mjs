import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("web app exposes an in-app recovery routine modal and authenticated submit rpc", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const migrationSource = readFileSync("supabase/migrations/20260618121536_in_app_recovery_submission.sql", "utf8");
  const revokeMigrationSource = readFileSync("supabase/migrations/20260618123154_revoke_anon_recovery_submission.sql", "utf8");

  assert.match(appSource, /recoveryModalRequest/);
  assert.match(appSource, /autoOpenRecoveryRequests/);
  assert.match(appSource, /blockingRecoveryRequests/);
  assert.match(appSource, /compareRecoveryRequests/);
  assert.match(appSource, /formatRecoveryRequestSummary/);
  assert.match(appSource, /recoveryModalQueuePosition/);
  assert.match(appSource, /recovery-modal-summary/);
  assert.match(appSource, /openRecoveryRoutineModal/);
  assert.match(appSource, /submitRecoveryRoutine/);
  assert.match(appSource, /submit_study_recovery_request/);
  assert.match(appSource, /p_request_id/);
  assert.match(appSource, /p_reason/);
  assert.match(appSource, /p_makeup_todo_title/);
  assert.match(appSource, /p_pledge_todo_title/);
  assert.match(appSource, /recovery-modal/);
  assert.match(appSource, /recoveryReason/);
  assert.match(appSource, /makeupTodoTitle/);
  assert.match(appSource, /pledgeTodoTitle/);
  assert.match(migrationSource, /create or replace function public\.submit_study_recovery_request/);
  assert.match(migrationSource, /auth\.uid\(\)/);
  assert.match(migrationSource, /study_recovery_requests/);
  assert.match(migrationSource, /study_todos/);
  assert.match(migrationSource, /grant execute on function public\.submit_study_recovery_request/);
  assert.match(revokeMigrationSource, /revoke all on function public\.submit_study_recovery_request[\s\S]+from anon/);
});

test("web app treats same-day missed recovery requests as blocking", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const autoOpenStart = appSource.indexOf("const autoOpenRecoveryRequests");
  const autoOpenEnd = appSource.indexOf("const todayCompletedSeconds");
  assert.notEqual(autoOpenStart, -1);
  assert.notEqual(autoOpenEnd, -1);

  const autoOpenSnippet = appSource.slice(autoOpenStart, autoOpenEnd);
  assert.match(autoOpenSnippet, /autoOpenRecoveryRequests/);
  assert.match(autoOpenSnippet, /blockingRecoveryRequests/);
  assert.match(autoOpenSnippet, /pendingRecoveryRequests/);
  assert.match(autoOpenSnippet, /openRecoveryRoutineModal/);
  assert.doesNotMatch(appSource, /lateStudyRecoveryRequests/);
  assert.doesNotMatch(appSource, /trigger_type !== "missed_attendance"/);
});

test("recovery pledge is stored on the request but not created as a todo", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const slackSource = readFileSync("supabase/functions/slack-recovery-interactions/index.ts", "utf8");
  const migrationPath = "supabase/migrations/20260625115531_recovery_pledge_note_only.sql";
  const migrationSource = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

  assert.match(appSource, /p_pledge_todo_title:\s*pledgeTodoTitle/);
  assert.match(migrationSource, /create or replace function public\.submit_study_recovery_request/);
  assert.match(migrationSource, /pledge_todo_title = v_pledge_title/);
  assert.match(migrationSource, /pledge_todo_id = null/);
  assert.doesNotMatch(migrationSource, /v_pledge_todo_id/);
  assert.doesNotMatch(migrationSource, /insert into public\.study_todos[\s\S]*values \([^;]*v_pledge_title/);

  const slackTodoCreations = slackSource.match(/await createTodo\(/g) ?? [];
  assert.equal(slackTodoCreations.length, 1);
  assert.match(slackSource, /pledge_todo_title:\s*pledgeTodoTitle/);
  assert.match(slackSource, /pledge_todo_id:\s*null/);
  assert.doesNotMatch(slackSource, /const pledgeTodo = await createTodo/);
});

test("web app paginates recovery history in five item pages", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");

  assert.match(appSource, /recoveryHistoryPage/);
  assert.match(appSource, /paginateRecoveryHistory\(sortedRecoveryRequests, recoveryHistoryPage\)/);
  assert.match(appSource, /recoveryHistoryPageData\.items\.map/);
  assert.match(appSource, /aria-label="회복루틴 이력 페이지 이동"/);
});
