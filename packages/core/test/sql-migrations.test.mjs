import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

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

test("attendance cron sends slack targets through bot API", () => {
  const source = readFileSync("supabase/functions/attendance-cron/index.ts", "utf8");

  assert.match(source, /kind: "expo" \| "web_push" \| "email" \| "kakao_memo" \| "slack"/);
  assert.match(source, /target\.kind === "slack"/);
  assert.match(source, /getSlackBotToken\(\)/);
  assert.match(source, /STUDY_ALERT_SLACK_BOT_TOKEN/);
  assert.match(source, /https:\/\/slack\.com\/api\/chat\.postMessage/);
  assert.doesNotMatch(source, /TELEGRAM_BOT_TOKEN|api\.telegram\.org/);
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
