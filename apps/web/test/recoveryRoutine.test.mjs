import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("web app exposes an in-app recovery routine modal and authenticated submit rpc", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const migrationSource = readFileSync("supabase/migrations/20260618121536_in_app_recovery_submission.sql", "utf8");
  const revokeMigrationSource = readFileSync("supabase/migrations/20260618123154_revoke_anon_recovery_submission.sql", "utf8");

  assert.match(appSource, /recoveryModalRequest/);
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
