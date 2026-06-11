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

test("attendance cron sends telegram targets through bot API", () => {
  const source = readFileSync("supabase/functions/attendance-cron/index.ts", "utf8");

  assert.match(source, /kind: "expo" \| "web_push" \| "email" \| "kakao_memo" \| "telegram"/);
  assert.match(source, /target\.kind === "telegram"/);
  assert.match(source, /requiredEnv\("TELEGRAM_BOT_TOKEN"\)/);
  assert.match(source, /https:\/\/api\.telegram\.org\/bot\$\{botToken\}\/sendMessage/);
});

test("attendance cron includes reminder date todos in server notifications", () => {
  const source = readFileSync("supabase/functions/attendance-cron/index.ts", "utf8");

  assert.match(source, /type StudyTodo = \{/);
  assert.match(source, /\.from\("study_todos"\)/);
  assert.match(source, /\.in\("local_date", reminderDates\)/);
  assert.match(source, /formatTodoSummary\(todos/);
  assert.match(source, /buildReminderBody\(reminder, todos/);
  assert.match(source, /sendWebPush\(target\.subscription!, reminder, todos\)/);
  assert.match(source, /sendTelegramMessage\(target\.destination!, reminder, todos\)/);
});

test("start_study_session only marks attendance present inside the reminder window", () => {
  const sql = readFileSync("supabase/migrations/0009_start_session_attendance_window.sql", "utf8");

  assert.match(sql, /if\s+now\(\)\s*>=\s*v_reminder_at\s+and\s+now\(\)\s*<=\s*v_deadline_at\s+then/i);
  assert.match(sql, /insert into public\.attendance_days/i);
  assert.match(sql, /end if;/i);
});
