import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

function readMigrationContaining(pattern) {
  const migrationFile = readdirSync("supabase/migrations")
    .filter((file) => file.endsWith(".sql"))
    .find((file) => pattern.test(readFileSync(`supabase/migrations/${file}`, "utf8")));

  assert.ok(migrationFile, `Expected a migration matching ${pattern}`);
  return readFileSync(`supabase/migrations/${migrationFile}`, "utf8");
}
function readLatestMigrationContaining(pattern) {
  const migrationFile = readdirSync("supabase/migrations")
    .filter((file) => file.endsWith(".sql"))
    .filter((file) => pattern.test(readFileSync(`supabase/migrations/${file}`, "utf8")))
    .at(-1);

  assert.ok(migrationFile, `Expected a migration matching ${pattern}`);
  return readFileSync(`supabase/migrations/${migrationFile}`, "utf8");
}

test("get_due_reminders migration qualifies due reminder columns to avoid PL/pgSQL ambiguity", () => {
  const sql = readFileSync("supabase/migrations/0006_fix_due_reminders_ambiguity.sql", "utf8");

  assert.match(sql, /from due_now dn/i);
  assert.match(sql, /select\s+dn\.user_id,\s*dn\.local_date,\s*'pending',\s*dn\.reminder_at,\s*dn\.deadline_at,\s*p_now/i);
  assert.match(sql, /on conflict on constraint attendance_days_pkey/i);
  assert.doesNotMatch(sql, /select\s+user_id,\s*local_date,\s*'pending',\s*reminder_at,\s*deadline_at,\s*p_now/i);
  assert.doesNotMatch(sql, /on conflict\s*\(\s*user_id\s*,\s*local_date\s*\)/i);
});

test("kakao notification migration stores tokens outside user-managed notification targets", () => {
  const sql = readFileSync("supabase/migrations/0007_kakao_message_notifications.sql", "utf8");

  assert.match(sql, /create table if not exists public\.kakao_message_connections/i);
  assert.match(sql, /access_token text not null/i);
  assert.match(sql, /refresh_token text/i);
  assert.match(sql, /alter table public\.kakao_message_connections enable row level security/i);
  assert.match(sql, /notification_targets_kind_check check \(kind in \('expo', 'web_push', 'email', 'kakao_memo'\)\)/i);
  assert.match(sql, /notification_deliveries_channel_check check \(channel in \('expo', 'web_push', 'email', 'kakao_memo'\)\)/i);
  assert.match(sql, /kind = 'kakao_memo' and destination is not null/i);
  assert.doesNotMatch(sql, /create policy .*kakao_message_connections.* for select/i);
});

test("telegram notification migration adds a destination based channel", () => {
  const sql = readFileSync("supabase/migrations/0008_telegram_notification_targets.sql", "utf8");

  assert.match(sql, /kind in \('expo', 'web_push', 'email', 'kakao_memo', 'telegram'\)/i);
  assert.match(sql, /\(kind in \('expo', 'email', 'kakao_memo', 'telegram'\) and destination is not null\)/i);
  assert.match(sql, /channel in \('expo', 'web_push', 'email', 'kakao_memo', 'telegram'\)/i);
});

test("slack notification migration adds slack and disables legacy telegram targets", () => {
  const sql = readFileSync("supabase/migrations/0014_slack_notification_targets.sql", "utf8");

  assert.match(sql, /kind in \('expo', 'web_push', 'email', 'kakao_memo', 'telegram', 'slack'\)/i);
  assert.match(sql, /\(kind in \('expo', 'email', 'kakao_memo', 'telegram', 'slack'\) and destination is not null\)/i);
  assert.match(sql, /channel in \('expo', 'web_push', 'email', 'kakao_memo', 'telegram', 'slack'\)/i);
  assert.match(sql, /where kind = 'telegram'\s+and enabled = true/i);
});

test("attendance cron sends slack targets through bot API and excludes kakao notifications", () => {
  const source = readFileSync("supabase/functions/attendance-cron/index.ts", "utf8");

  assert.match(source, /kind: "expo" \| "web_push" \| "email" \| "slack"/);
  assert.match(source, /\.in\("kind", \["expo", "web_push", "email", "slack"\]\)/);
  assert.match(source, /target\.kind === "slack"/);
  assert.match(source, /getSlackBotToken\(\)/);
  assert.match(source, /STUDY_ALERT_SLACK_BOT_TOKEN/);
  assert.match(source, /https:\/\/slack\.com\/api\/chat\.postMessage/);
  assert.doesNotMatch(source, /TELEGRAM_BOT_TOKEN|api\.telegram\.org/);
  assert.doesNotMatch(source, /sendKakaoMemo|kapi\.kakao\.com|KAKAO_REST_API_KEY|KAKAO_CLIENT_SECRET/);
});

test("slack reminder messages use readable emoji sections", () => {
  const source = readFileSync("supabase/functions/attendance-cron/index.ts", "utf8");

  assert.match(source, /buildSlackReminderMessage\(reminder, todos, appUrl\)/);
  assert.match(source, /getDailyAttendanceGoalLabel\(reminder\.local_date\)/);
  assert.match(source, /📚 독서실 입장 알림/);
  assert.match(source, /⏰ 출석 마감/);
  assert.match(source, /✅ 오늘 할 일/);
  assert.match(source, /🎯 지금 할 일/);
  assert.match(source, /🔗 앱 열기/);
  assert.match(source, /목표를 채우면 출석으로 전환/);
});

test("slack test alarm and camera warning messages use readable emoji sections", () => {
  const testAlarmSource = readFileSync("supabase/functions/slack-test-alarm/index.ts", "utf8");
  const cameraSource = readFileSync("supabase/functions/camera-presence-warning/index.ts", "utf8");

  assert.match(testAlarmSource, /🧪 Slack 테스트 알림/);
  assert.match(testAlarmSource, /📅 기준 날짜/);
  assert.match(testAlarmSource, /✅ 오늘 할 일/);
  assert.match(testAlarmSource, /🔗 앱 열기/);
  assert.match(cameraSource, /📷 카메라 경고/);
  assert.match(cameraSource, /⚠️ 감지 상태/);
  assert.match(cameraSource, /🎯 지금 할 일/);
  assert.match(cameraSource, /🔗 앱 열기/);
});

test("kakao disable migration turns off legacy kakao targets without deleting history", () => {
  const sql = readFileSync("supabase/migrations/0018_disable_kakao_notifications.sql", "utf8");

  assert.match(sql, /update public\.notification_targets\s+set\s+enabled = false/i);
  assert.match(sql, /where kind = 'kakao_memo'\s+and enabled = true/i);
  assert.match(sql, /update public\.kakao_message_connections\s+set\s+enabled = false/i);
});

test("attendance cron includes reminder date todos in server notifications", () => {
  const source = readFileSync("supabase/functions/attendance-cron/index.ts", "utf8");

  assert.match(source, /type StudyTodo = \{/);
  assert.match(source, /\.from\("study_todos"\)/);
  assert.match(source, /\.in\("local_date", reminderDates\)/);
  assert.match(source, /formatTodoSummary\(todos/);
  assert.match(source, /buildReminderBody\(reminder, todos/);
  assert.match(source, /sendWebPush\(target\.subscription!, reminder, todos\)/);
  assert.match(source, /sendSlackMessage\(target\.destination!, reminder, todos\)/);
});

test("todo schedule reminder migration stores duplicate-safe start and end warnings", () => {
  const sql = readMigrationContaining(/study_todo_schedule_deliveries/i);

  assert.match(sql, /create table if not exists public\.study_todo_schedule_deliveries/i);
  assert.match(sql, /reminder_type text not null/i);
  assert.match(sql, /reminder_type in \('start', 'end_soon'\)/i);
  assert.match(sql, /unique \(todo_id, target_id, reminder_type, scheduled_at\)/i);
  assert.match(sql, /alter table public\.study_todo_schedule_deliveries enable row level security/i);
  assert.match(sql, /Users can read their todo schedule deliveries/i);
  assert.match(sql, /create or replace function public\.get_due_todo_schedule_reminders/i);
  assert.match(sql, /st\.is_completed = false/i);
  assert.match(sql, /interval '5 minutes'/i);
  assert.match(sql, /st\.start_time <> st\.end_time/i);
  assert.match(sql, /grant execute on function public\.get_due_todo_schedule_reminders\(timestamptz\) to service_role/i);
});

test("attendance cron sends Slack todo schedule reminders without duplicate deliveries", () => {
  const source = readFileSync("supabase/functions/attendance-cron/index.ts", "utf8");

  assert.match(source, /type DueTodoScheduleReminder = \{/);
  assert.match(source, /admin\.rpc\(\s*"get_due_todo_schedule_reminders"/);
  assert.match(source, /sendTodoScheduleReminderNotifications/);
  assert.match(source, /\.from\("study_todo_schedule_deliveries"\)/);
  assert.match(source, /reminder_type/);
  assert.match(source, /onConflict: "todo_id,target_id,reminder_type,scheduled_at"/);
  assert.match(source, /target\.kind !== "slack"/);
  assert.match(source, /buildSlackTodoScheduleReminderMessage/);
  assert.match(source, /⏳ 일정 종료 5분 전/);
  assert.match(source, /📌 지금 시작할 일정/);
  assert.match(source, /notification_deliveries/);
});
test("attendance cron distinguishes initial reminders from 15 minute nudge reminders", () => {
  const source = readFileSync("supabase/functions/attendance-cron/index.ts", "utf8");

  assert.match(source, /reminder_stage:\s*"initial"\s*\|\s*"nudge"/);
  assert.match(source, /reminder\.reminder_stage === "nudge"/);
  assert.match(source, /15 minutes/);
});

test("start_study_session only marks attendance present inside the reminder window", () => {
  const sql = readFileSync("supabase/migrations/0009_start_session_attendance_window.sql", "utf8");

  assert.match(sql, /if\s+now\(\)\s*>=\s*v_reminder_at\s+and\s+now\(\)\s*<=\s*v_deadline_at\s+then/i);
  assert.match(sql, /insert into public\.attendance_days/i);
  assert.match(sql, /end if;/i);
});

test("two-step attendance window migration sends nudge at 15 minutes and marks missed at 30 minutes", () => {
  const sql = readFileSync("supabase/migrations/0010_two_step_attendance_deadline.sql", "utf8");

  assert.match(sql, /reminder_stage text/i);
  assert.match(sql, /'initial'::text as reminder_stage/i);
  assert.match(sql, /'nudge'::text as reminder_stage/i);
  assert.match(sql, /d\.reminder_at \+ interval '15 minutes'/i);
  assert.match(sql, /d\.reminder_at \+ interval '30 minutes' as deadline_at/i);
  assert.match(sql, /v_deadline_at := v_reminder_at \+ interval '30 minutes'/i);
  assert.match(sql, /now\(\)\s*<\s*v_deadline_at/i);
  assert.match(sql, /p_now >= ad\.deadline_at/i);
  assert.match(sql, /ss\.started_at < ad\.deadline_at/i);
});

test("pre-reminder active sessions suppress reminders and count before missed attendance", () => {
  const sql = readFileSync("supabase/migrations/0015_pre_reminder_active_session_attendance.sql", "utf8");

  assert.match(sql, /create or replace function public\.get_due_reminders/i);
  assert.match(sql, /create or replace function public\.mark_missed_attendance/i);
  assert.match(sql, /ss\.started_at <= d\.reminder_at/i);
  assert.match(sql, /coalesce\(ss\.ended_at, p_now\) >= d\.reminder_at/i);
  assert.match(sql, /ss\.started_at <= ad\.reminder_at/i);
  assert.match(sql, /coalesce\(ss\.ended_at, p_now\) >= ad\.reminder_at/i);
  assert.match(sql, /set status = 'present'/i);
  assert.match(sql, /qualifying_session_id = qualified\.session_id/i);
});

test("study todo time window migration adds optional start and end times", () => {
  const sql = readFileSync("supabase/migrations/0016_study_todo_time_window.sql", "utf8");

  assert.match(sql, /alter table public\.study_todos\s+add column if not exists start_time time/i);
  assert.match(sql, /alter table public\.study_todos\s+add column if not exists end_time time/i);
  assert.match(sql, /study_todos_time_window_check/i);
  assert.match(sql, /start_time is null and end_time is null/i);
  assert.match(sql, /start_time is not null and end_time is not null and start_time < end_time/i);
  assert.match(sql, /study_todos_user_date_time_idx/i);
});

test("study todo overnight time migration allows next-day end times", () => {
  const sql = readFileSync("supabase/migrations/0017_allow_overnight_study_todo_times.sql", "utf8");

  assert.match(sql, /alter table public\.study_todos\s+drop constraint if exists study_todos_time_window_check/i);
  assert.match(sql, /add constraint study_todos_time_window_check check/i);
  assert.match(sql, /start_time is null and end_time is null/i);
  assert.match(sql, /start_time is not null and end_time is not null and start_time <> end_time/i);
});

test("study presence events migration stores camera warnings without media payloads", () => {
  const sql = readFileSync("supabase/migrations/0011_study_presence_events.sql", "utf8");

  assert.match(sql, /create table if not exists public\.study_presence_events/i);
  assert.match(sql, /session_id uuid not null references public\.study_sessions\(id\) on delete cascade/i);
  assert.match(sql, /event_type text not null/i);
  assert.match(sql, /event_type in \('camera_started', 'camera_stopped', 'absence_warning', 'camera_permission_denied'\)/i);
  assert.match(sql, /absence_seconds integer not null default 0/i);
  assert.match(sql, /metadata jsonb not null default '\{\}'::jsonb/i);
  assert.match(sql, /not \(metadata \? 'image'\)/i);
  assert.match(sql, /not \(metadata \? 'video'\)/i);
  assert.match(sql, /not \(metadata \? 'frame'\)/i);
  assert.match(sql, /not \(metadata \? 'faceEmbedding'\)/i);
  assert.match(sql, /alter table public\.study_presence_events enable row level security/i);
  assert.match(sql, /auth\.uid\(\) = user_id/i);
  assert.match(sql, /from public\.study_sessions ss/i);
  assert.match(sql, /grant select, insert on public\.study_presence_events to authenticated/i);
});

test("camera required warning migration extends presence event types", () => {
  const sql = readFileSync("supabase/migrations/0012_camera_required_warning.sql", "utf8");

  assert.match(sql, /drop constraint if exists study_presence_events_event_type_check/i);
  assert.match(sql, /add constraint study_presence_events_event_type_check check/i);
  assert.match(sql, /'camera_required_warning'/i);
});

test("end_study_session migration excludes camera absence seconds from stored duration", () => {
  const sql = readFileSync("supabase/migrations/0013_exclude_camera_absence_from_sessions.sql", "utf8");

  assert.match(sql, /drop function if exists public\.end_study_session\(uuid\)/i);
  assert.match(sql, /p_excluded_seconds integer default 0/i);
  assert.match(sql, /duration_seconds = greatest\(\s*0,\s*floor\(extract\(epoch from \(now\(\) - started_at\)\)\)::integer\s*-\s*greatest\(0, p_excluded_seconds\)\s*\)/i);
  assert.match(sql, /grant execute on function public\.end_study_session\(uuid, integer\) to authenticated/i);
});

test("camera presence warning Edge Function validates session ownership before slack warning", () => {
  const source = readFileSync("supabase/functions/camera-presence-warning/index.ts", "utf8");

  assert.match(source, /admin\.auth\.getUser\(jwt\)/);
  assert.match(source, /\.from\("study_sessions"\)/);
  assert.match(source, /\.eq\("id", sessionId\)/);
  assert.match(source, /studySession\.user_id !== user\.id/);
  assert.match(source, /\.from\("study_presence_events"\)/);
  assert.match(source, /event_type: eventType/);
  assert.match(source, /"absence_warning"/);
  assert.match(source, /camera_required_warning/);
  assert.match(source, /eventType/);
  assert.match(source, /loadSlackTarget\(admin, user\.id\)/);
  assert.match(source, /https:\/\/slack\.com\/api\/chat\.postMessage/);
  assert.match(source, /getSlackBotToken\(\)/);
  assert.match(source, /STUDY_ALERT_SLACK_BOT_TOKEN/);
  assert.doesNotMatch(source, /TELEGRAM_BOT_TOKEN|api\.telegram\.org/);
  assert.doesNotMatch(source, /image|video|frame|faceEmbedding|landmarks/);
});

test("study recovery migration stores pending recovery requests and blocks session start", () => {
  const sql = readMigrationContaining(/study_recovery_requests/i);

  assert.match(sql, /create table if not exists public\.study_recovery_requests/i);
  assert.match(sql, /trigger_type text not null/i);
  assert.match(sql, /trigger_type in \('missed_attendance', 'camera_absence_repeat'\)/i);
  assert.match(sql, /status text not null default 'pending'/i);
  assert.match(sql, /status in \('pending', 'submitted'\)/i);
  assert.match(sql, /reason text/i);
  assert.match(sql, /makeup_todo_title text/i);
  assert.match(sql, /pledge_todo_title text/i);
  assert.match(sql, /makeup_todo_id uuid references public\.study_todos\(id\)/i);
  assert.match(sql, /pledge_todo_id uuid references public\.study_todos\(id\)/i);
  assert.match(sql, /slack_submitter_id text/i);
  assert.match(sql, /followup_sent_at timestamptz/i);
  assert.match(sql, /where status = 'pending'/i);
  assert.match(sql, /alter table public\.study_recovery_requests enable row level security/i);
  assert.match(sql, /Users can read their study recovery requests/i);
  assert.match(sql, /grant select on public\.study_recovery_requests to authenticated/i);
  assert.match(sql, /create or replace function public\.start_study_session/i);
  assert.match(sql, /from public\.study_recovery_requests rr/i);
  assert.match(sql, /rr\.status = 'pending'/i);
  assert.match(sql, /Recovery routine required/i);
});

test("attendance policy migration supports weekday and weekend study goals", () => {
  const sql = readMigrationContaining(/study_attendance_goal_seconds/i);

  assert.match(sql, /create or replace function public\.study_attendance_goal_seconds\(p_local_date date\)/i);
  assert.match(sql, /extract\(isodow from p_local_date\) in \(6, 7\)/i);
  assert.match(sql, /4 \* 60 \* 60/i);
  assert.match(sql, /2 \* 60 \* 60/i);
  assert.match(sql, /create or replace function public\.effective_reminder_time\(p_local_date date, p_reminder_time time\)/i);
  assert.match(sql, /time '14:00'/i);
  assert.match(sql, /time '20:30'/i);
});

test("attendance policy migration promotes late study totals to present", () => {
  const sql = readMigrationContaining(/promote_attendance_by_daily_study_total/i);

  assert.match(sql, /create or replace function public\.promote_attendance_by_daily_study_total/i);
  assert.match(sql, /sum\(duration_seconds\)/i);
  assert.match(sql, /public\.study_attendance_goal_seconds\(p_local_date\)/i);
  assert.match(sql, /status = 'present'/i);
  assert.match(sql, /trigger_type = 'missed_attendance'/i);
  assert.match(sql, /status = 'submitted'/i);
  assert.match(sql, /create or replace function public\.end_study_session/i);
  assert.match(sql, /perform public\.promote_attendance_by_daily_study_total/i);
});

test("recovery hard-block migration blocks same-day missed recovery study", () => {
  const sql = readMigrationContaining(/hard_block_pending_recovery_requests/i);

  assert.match(sql, /from public\.study_recovery_requests rr/i);
  assert.match(sql, /rr\.status = 'pending'/i);
  assert.doesNotMatch(sql, /trigger_type <> 'missed_attendance'/i);
  assert.match(sql, /Recovery routine required/i);
});

test("study todo repeat metadata migration supports editable recurring todos", () => {
  const sql = readMigrationContaining(/repeat_group_id/i);

  assert.match(sql, /alter table public\.study_todos\s+add column if not exists repeat_group_id uuid/i);
  assert.match(sql, /alter table public\.study_todos\s+add column if not exists repeat_mode text/i);
  assert.match(sql, /alter table public\.study_todos\s+add column if not exists repeat_weekdays smallint\[\]/i);
  assert.match(sql, /alter table public\.study_todos\s+add column if not exists repeat_until date/i);
  assert.match(sql, /study_todos_repeat_mode_check/i);
  assert.match(sql, /study_todos_repeat_weekdays_check/i);
  assert.match(sql, /study_todos_repeat_group_idx/i);
  assert.match(sql, /grant select, insert, update, delete on public\.study_todos to authenticated/i);
});

test("study todo repeat forever migration supports no-end weekly schedules", () => {
  const sql = readMigrationContaining(/repeat_forever/i);

  assert.match(sql, /alter table public\.study_todos\s+add column if not exists repeat_forever boolean not null default false/i);
  assert.match(sql, /drop constraint if exists study_todos_repeat_consistency_check/i);
  assert.match(sql, /repeat_mode = 'single'[\s\S]*repeat_forever = false/i);
  assert.match(sql, /repeat_mode = 'weekly'[\s\S]*\(repeat_forever = true or repeat_until is not null\)/i);
});

test("study goals migration stores user scoped goals and links todos", () => {
  const sql = readMigrationContaining(/study_goals/i);

  assert.match(sql, /create table if not exists public\.study_goals/i);
  assert.match(sql, /target_date date not null/i);
  assert.match(sql, /target_study_seconds integer not null default 0/i);
  assert.match(sql, /status text not null default 'active'/i);
  assert.match(sql, /status in \('active', 'completed', 'archived'\)/i);
  assert.match(sql, /alter table public\.study_goals enable row level security/i);
  assert.match(sql, /Users can read their study goals/i);
  assert.match(sql, /Users can insert their study goals/i);
  assert.match(sql, /Users can update their study goals/i);
  assert.match(sql, /Users can delete their study goals/i);
  assert.match(sql, /grant select, insert, update, delete on public\.study_goals to authenticated/i);
  assert.match(sql, /alter table public\.study_todos\s+add column if not exists goal_id uuid/i);
  assert.match(sql, /foreign key \(goal_id, user_id\) references public\.study_goals\(id, user_id\)/i);
  assert.match(sql, /study_todos_goal_idx/i);
});

test("study session todo links migration stores user scoped session plans", () => {
  const sql = readMigrationContaining(/study_session_todos/i);

  assert.match(sql, /create table if not exists public\.study_session_todos/i);
  assert.match(sql, /session_id uuid not null/i);
  assert.match(sql, /todo_id uuid not null/i);
  assert.match(sql, /completed_during_session boolean not null default false/i);
  assert.match(sql, /unique \(session_id, todo_id\)/i);
  assert.match(sql, /foreign key \(session_id, user_id\)\s+references public\.study_sessions\(id, user_id\)/i);
  assert.match(sql, /foreign key \(todo_id, user_id\)\s+references public\.study_todos\(id, user_id\)/i);
  assert.match(sql, /alter table public\.study_session_todos enable row level security/i);
  assert.match(sql, /Users can read their study session todo links/i);
  assert.match(sql, /Users can insert their study session todo links/i);
  assert.match(sql, /Users can update their study session todo links/i);
  assert.match(sql, /grant select, insert, update, delete on public\.study_session_todos to authenticated/i);
});

test("dashboard planner preferences migration stores task view and section order", () => {
  const sql = readMigrationContaining(/today_task_view/i);

  assert.match(sql, /alter table public\.profiles\s+add column if not exists today_task_view text not null default 'checklist'/i);
  assert.match(sql, /today_task_view in \('checklist', 'planner'\)/i);
  assert.match(sql, /alter table public\.profiles\s+add column if not exists today_section_order jsonb not null default/i);
  assert.match(sql, /jsonb_typeof\(today_section_order\) = 'array'/i);
  assert.match(sql, /topbar/i);
  assert.match(sql, /attendance/i);
  assert.match(sql, /focus/i);
  assert.match(sql, /tasks/i);
  assert.match(sql, /grant select, insert, update on public\.profiles to authenticated/i);
});

test("attendance cron creates missed recovery requests and one follow-up", () => {
  const source = readFileSync("supabase/functions/attendance-cron/index.ts", "utf8");

  assert.match(source, /createRecoveryRequest/);
  assert.match(source, /triggerType:\s*"missed_attendance"/);
  assert.match(source, /sendRecoveryRequestSlackMessage/);
  assert.match(source, /sendPendingRecoveryFollowups/);
  assert.match(source, /followup_sent_at/);
});

test("camera warning creates recovery request on repeated absence warnings only", () => {
  const source = readFileSync("supabase/functions/camera-presence-warning/index.ts", "utf8");

  assert.match(source, /countAbsenceWarningsForDate/);
  assert.match(source, /absenceWarningCount >= 2/);
  assert.match(source, /triggerType:\s*"camera_absence_repeat"/);
  assert.match(source, /sendRecoveryRequestSlackMessage/);
  assert.doesNotMatch(source, /camera_required_warning[\s\S]{0,240}camera_absence_repeat/);
});


test("schedule extension migration shifts selected and later incomplete timed todos", () => {
  const sql = readLatestMigrationContaining(/extend_todo_schedule/i);

  assert.match(sql, /create or replace function public\.extend_todo_schedule/i);
  assert.match(sql, /p_todo_id uuid/i);
  assert.match(sql, /p_extension_minutes integer/i);
  assert.match(sql, /p_extension_minutes not between 1 and 120/i);
  assert.match(sql, /selected_todo\.is_completed = true/i);
  assert.match(sql, /raise exception 'Completed todo schedules cannot be extended'/i);
  assert.match(sql, /candidate_todos/i);
  assert.match(sql, /where st\.user_id = selected_todo\.user_id/i);
  assert.match(sql, /and st\.local_date = selected_todo\.local_date/i);
  assert.match(sql, /and st\.is_completed = false/i);
  assert.match(sql, /st\.start_time >= selected_todo\.start_time/i);
  assert.match(sql, /update public\.study_todos st/i);
  assert.match(sql, /make_interval\(mins => p_extension_minutes\)/i);
  assert.match(sql, /start_time = \(\(\(st\.local_date::text \|\| ' ' \|\| st\.start_time::text\)::timestamp \+ make_interval\(mins => p_extension_minutes\)\)::time\)/i);
  assert.doesNotMatch(sql, /when st\.id = selected_todo\.id then st\.start_time/i);
  assert.match(sql, /grant execute on function public\.extend_todo_schedule\(uuid, integer\) to service_role/i);
  assert.match(sql, /grant execute on function public\.extend_todo_schedule\(uuid, integer\) to authenticated/i);
});

test("slack schedule reminders expose extension actions and interaction handler", () => {
  const attendanceSource = readFileSync("supabase/functions/attendance-cron/index.ts", "utf8");
  const interactionSource = readFileSync("supabase/functions/slack-recovery-interactions/index.ts", "utf8");

  assert.match(attendanceSource, /blocks: buildSlackTodoScheduleReminderBlocks\(reminder\)/);
  assert.match(attendanceSource, /extend_schedule_5/);
  assert.match(attendanceSource, /extend_schedule_10/);
  assert.match(attendanceSource, /extend_schedule_custom/);
  assert.match(attendanceSource, /schedule_extension\|\$\{reminder\.todo_id\}\|5/);
  assert.match(attendanceSource, /schedule_extension\|\$\{reminder\.todo_id\}\|10/);

  assert.match(interactionSource, /SLACK_SIGNING_SECRET/);
  assert.match(interactionSource, /x-slack-signature/i);
  assert.match(interactionSource, /x-slack-request-timestamp/i);
  assert.match(interactionSource, /crypto\.subtle\.sign/);
  assert.match(interactionSource, /type === "block_actions"/);
  assert.match(interactionSource, /extend_schedule_5|extend_schedule_10/);
  assert.match(interactionSource, /extend_todo_schedule/);
  assert.match(interactionSource, /p_todo_id/);
  assert.match(interactionSource, /p_extension_minutes/);
  assert.match(interactionSource, /views\.open/);
  assert.match(interactionSource, /type === "view_submission"/);
  assert.match(interactionSource, /chat\.postEphemeral/);
});


test("session lease migration stores server deadline and exposes one hour extension", () => {
  const sql = readMigrationContaining(/extend_study_session_lease/i);

  assert.match(sql, /alter table public\.study_sessions\s+add column if not exists lease_expires_at timestamptz/i);
  assert.match(sql, /add column if not exists lease_warning_sent_at timestamptz/i);
  assert.match(sql, /started_at \+ interval '1 hour'/i);
  assert.match(sql, /insert into public\.study_sessions\s*\([^)]*lease_expires_at[^)]*\)[\s\S]*now\(\) \+ interval '1 hour'/i);
  assert.match(sql, /create or replace function public\.extend_study_session_lease/i);
  assert.match(sql, /p_session_id uuid/i);
  assert.match(sql, /p_extension_minutes integer default 60/i);
  assert.match(sql, /p_extension_minutes <> 60/i);
  assert.match(sql, /greatest\(coalesce\(lease_expires_at, now\(\)\), now\(\)\) \+ make_interval\(mins => p_extension_minutes\)/i);
  assert.match(sql, /lease_warning_sent_at = null/i);
  assert.match(sql, /create or replace function public\.get_due_session_lease_warnings/i);
  assert.match(sql, /lease_expires_at - interval '5 minutes'/i);
  assert.match(sql, /lease_warning_sent_at is null/i);
  assert.match(sql, /notification_targets nt/i);
  assert.match(sql, /nt\.kind = 'slack'/i);
  assert.match(sql, /grant execute on function public\.extend_study_session_lease\(uuid, integer\) to authenticated/i);
  assert.match(sql, /grant execute on function public\.extend_study_session_lease\(uuid, integer\) to service_role/i);
});

test("session lease Slack warnings expose a one hour extension action", () => {
  const attendanceSource = readFileSync("supabase/functions/attendance-cron/index.ts", "utf8");
  const interactionSource = readFileSync("supabase/functions/slack-recovery-interactions/index.ts", "utf8");

  assert.match(attendanceSource, /get_due_session_lease_warnings/);
  assert.match(attendanceSource, /sendSessionLeaseWarningNotifications/);
  assert.match(attendanceSource, /buildSlackSessionLeaseWarningBlocks/);
  assert.match(attendanceSource, /extend_session_lease_60/);
  assert.match(attendanceSource, /session_lease_extension\|\$\{warning\.session_id\}\|60/);
  assert.match(attendanceSource, /lease_warning_sent_at/);

  assert.match(interactionSource, /extend_session_lease_60/);
  assert.match(interactionSource, /session_lease_extension/);
  assert.match(interactionSource, /extend_study_session_lease/);
  assert.match(interactionSource, /p_session_id/);
  assert.match(interactionSource, /p_extension_minutes/);
  assert.match(interactionSource, /\uC138\uC158\uC744 1\uC2DC\uAC04 \uC5F0\uC7A5\uD588\uC2B5\uB2C8\uB2E4/);
});

test("slack recovery interactions verify signatures, open modal, and create the makeup todo", () => {
  const source = readFileSync("supabase/functions/slack-recovery-interactions/index.ts", "utf8");

  assert.match(source, /SLACK_SIGNING_SECRET/);
  assert.match(source, /x-slack-signature/i);
  assert.match(source, /x-slack-request-timestamp/i);
  assert.match(source, /crypto\.subtle\.sign/);
  assert.match(source, /views\.open/);
  assert.match(source, /type === "block_actions"/);
  assert.match(source, /type === "view_submission"/);
  assert.match(source, /reason/);
  assert.match(source, /makeup_todo_title/);
  assert.match(source, /pledge_todo_title/);
  assert.match(source, /\.from\("study_recovery_requests"\)/);
  assert.match(source, /\.from\("study_todos"\)/);
  assert.match(source, /slack_submitter_id/);
});
