import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("web app does not auto-open non-blocking same-day missed recovery requests", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const autoOpenStart = appSource.indexOf("const autoOpenRecoveryRequests");
  const autoOpenEnd = appSource.indexOf("const todayCompletedSeconds");
  assert.notEqual(autoOpenStart, -1);
  assert.notEqual(autoOpenEnd, -1);

  const autoOpenSnippet = appSource.slice(autoOpenStart, autoOpenEnd);
  assert.match(autoOpenSnippet, /autoOpenRecoveryRequests/);
  assert.match(autoOpenSnippet, /blockingRecoveryRequests/);
  assert.match(autoOpenSnippet, /openRecoveryRoutineModal/);
  assert.doesNotMatch(autoOpenSnippet, /pendingRecoveryRequests\.length === 0/);
});
