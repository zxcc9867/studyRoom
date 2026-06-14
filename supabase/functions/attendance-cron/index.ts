import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type DueReminder = {
  user_id: string;
  email: string | null;
  local_date: string;
  reminder_at: string;
  deadline_at: string;
  reminder_stage: "initial" | "nudge";
};

type NotificationTarget = {
  id: string;
  user_id: string;
  kind: "expo" | "web_push" | "email" | "slack";
  destination: string | null;
  subscription: Record<string, unknown> | null;
};

type StudyTodo = {
  user_id: string;
  local_date: string;
  title: string;
  is_completed: boolean;
  start_time: string | null;
  end_time: string | null;
  position: number;
  created_at: string;
};

const jsonHeaders = { "content-type": "application/json" };

Deno.serve(async (request) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date().toISOString();
  const { data: dueReminders, error: dueError } = await admin.rpc("get_due_reminders", { p_now: now });
  if (dueError) {
    return new Response(JSON.stringify({ error: dueError.message }), { status: 500, headers: jsonHeaders });
  }

  const { data: missed, error: missedError } = await admin.rpc("mark_missed_attendance", { p_now: now });
  if (missedError) {
    return new Response(JSON.stringify({ error: missedError.message }), { status: 500, headers: jsonHeaders });
  }

  const reminders = (dueReminders ?? []) as DueReminder[];
  const targets = await loadTargets(admin, reminders.map((reminder) => reminder.user_id));
  const todoMap = await loadTodosByReminder(admin, reminders);
  const deliveryResults = await sendReminderNotifications(admin, reminders, targets, todoMap);

  return new Response(
    JSON.stringify({
      dueReminderCount: reminders.length,
      missedCount: missed?.length ?? 0,
      deliveryResults,
    }),
    { status: 200, headers: jsonHeaders },
  );
});

async function loadTargets(admin: ReturnType<typeof createClient>, userIds: string[]) {
  if (userIds.length === 0) {
    return [] as NotificationTarget[];
  }

  const { data, error } = await admin
    .from("notification_targets")
    .select("id,user_id,kind,destination,subscription")
    .in("user_id", userIds)
    .in("kind", ["expo", "web_push", "email", "slack"])
    .eq("enabled", true);

  if (error) {
    throw error;
  }

  return (data ?? []) as NotificationTarget[];
}

async function loadTodosByReminder(admin: ReturnType<typeof createClient>, reminders: DueReminder[]) {
  if (reminders.length === 0) {
    return new Map<string, StudyTodo[]>();
  }

  const reminderUserIds = [...new Set(reminders.map((reminder) => reminder.user_id))];
  const reminderDates = [...new Set(reminders.map((reminder) => reminder.local_date))];
  const { data, error } = await admin
    .from("study_todos")
    .select("user_id,local_date,title,is_completed,start_time,end_time,position,created_at")
    .in("user_id", reminderUserIds)
    .in("local_date", reminderDates)
    .order("start_time", { ascending: true, nullsFirst: false })
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const todosByReminder = new Map<string, StudyTodo[]>();
  for (const todo of (data ?? []) as StudyTodo[]) {
    const key = getReminderTodoKey(todo.user_id, todo.local_date);
    todosByReminder.set(key, [...(todosByReminder.get(key) ?? []), todo]);
  }

  return todosByReminder;
}

async function sendReminderNotifications(
  admin: ReturnType<typeof createClient>,
  reminders: DueReminder[],
  targets: NotificationTarget[],
  todoMap: Map<string, StudyTodo[]>,
) {
  const results = [];

  for (const reminder of reminders) {
    const userTargets = targets.filter((target) => target.user_id === reminder.user_id);
    const todos = todoMap.get(getReminderTodoKey(reminder.user_id, reminder.local_date)) ?? [];
    for (const target of userTargets) {
      const outcome = await sendTarget(reminder, target, todos);
      results.push(outcome);
      await admin.from("notification_deliveries").insert({
        user_id: reminder.user_id,
        target_id: target.id,
        local_date: reminder.local_date,
        channel: target.kind,
        status: outcome.ok ? "sent" : "failed",
        error_message: outcome.ok ? null : outcome.error,
      });
    }
  }

  return results;
}

async function sendTarget(
  reminder: DueReminder,
  target: NotificationTarget,
  todos: StudyTodo[],
) {
  try {
    if (target.kind === "expo") {
      await sendExpoPush(target.destination!, reminder, todos);
    } else if (target.kind === "email") {
      await sendEmail(target.destination ?? reminder.email, reminder, todos);
    } else if (target.kind === "web_push") {
      await sendWebPush(target.subscription!, reminder, todos);
    } else if (target.kind === "slack") {
      await sendSlackMessage(target.destination!, reminder, todos);
    } else {
      throw new Error(`Unsupported notification target kind: ${String(target.kind)}`);
    }
    return { targetId: target.id, kind: target.kind, ok: true };
  } catch (error) {
    return {
      targetId: target.id,
      kind: target.kind,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function sendExpoPush(to: string, reminder: DueReminder, todos: StudyTodo[]) {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      to,
      title: buildReminderTitle(reminder),
      body: buildReminderBody(reminder, todos, { maxTodos: 3 }),
      data: {
        type: "study_reminder",
        localDate: reminder.local_date,
        deadlineAt: reminder.deadline_at,
        reminderStage: reminder.reminder_stage,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Expo push failed: ${response.status}`);
  }
}

async function sendEmail(to: string | null, reminder: DueReminder, todos: StudyTodo[]) {
  if (!to) {
    throw new Error("Email destination is missing");
  }

  const apiKey = requiredEnv("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "Study Room <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      ...jsonHeaders,
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to,
      subject: buildReminderTitle(reminder),
      html: `<p>Open the study room app and start your timer now.</p><p>Check-in deadline: ${reminder.deadline_at}</p>${formatTodoHtml(todos)}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend email failed: ${response.status}`);
  }
}

async function sendWebPush(subscription: Record<string, unknown>, reminder: DueReminder, todos: StudyTodo[]) {
  const publicKey = requiredEnv("WEB_PUSH_VAPID_PUBLIC_KEY");
  const privateKey = requiredEnv("WEB_PUSH_VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("WEB_PUSH_SUBJECT") ?? "mailto:study-room@example.com";

  webpush.setVapidDetails(subject, publicKey, privateKey);
  await webpush.sendNotification(
    subscription,
    JSON.stringify({
      title: buildReminderTitle(reminder),
      body: buildReminderBody(reminder, todos, { maxTodos: 3 }),
      url: "/",
      localDate: reminder.local_date,
      deadlineAt: reminder.deadline_at,
      reminderStage: reminder.reminder_stage,
      todos: todos.map((todo) => ({ title: formatTodoWithSchedule(todo), isCompleted: todo.is_completed })),
    }),
  );
}

async function sendSlackMessage(channelId: string, reminder: DueReminder, todos: StudyTodo[]) {
  if (!channelId) {
    throw new Error("Slack channel ID is missing");
  }

  const botToken = getSlackBotToken();
  const appUrl = Deno.env.get("APP_ORIGIN") ?? Deno.env.get("SITE_URL") ?? "http://127.0.0.1:5177";
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      ...jsonHeaders,
      authorization: `Bearer ${botToken}`,
    },
    body: JSON.stringify({
      channel: channelId,
      text: `${buildReminderBody(reminder, todos, { maxTodos: 5 })}\n${appUrl}`,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack message failed: ${response.status} ${await response.text()}`);
  }

  const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    throw new Error(`Slack message returned unexpected result: ${JSON.stringify(result)}`);
  }
}

function getReminderTodoKey(userId: string, localDate: string) {
  return `${userId}:${localDate}`;
}

function buildReminderTitle(reminder: DueReminder) {
  return reminder.reminder_stage === "nudge" ? "Study room final nudge" : "Study room check-in time";
}

function buildReminderBody(reminder: DueReminder, todos: StudyTodo[], options: { maxTodos?: number } = {}) {
  const lines =
    reminder.reminder_stage === "nudge"
      ? [
          "Final study-room nudge.",
          "15 minutes have passed since the first alarm.",
          `Start the timer before ${formatDeadline(reminder.deadline_at)} or today will be marked missed.`,
        ]
      : ["Study-room check-in time.", `Start the timer before ${formatDeadline(reminder.deadline_at)}.`];
  const todoSummary = formatTodoSummary(todos, options);
  if (todoSummary) {
    lines.push("", todoSummary);
  }
  return lines.join("\n");
}

function formatTodoSummary(todos: StudyTodo[], options: { maxTodos?: number } = {}) {
  if (todos.length === 0) {
    return "";
  }

  const maxTodos = options.maxTodos ?? 5;
  const visibleTodos = todos.slice(0, maxTodos);
  const hiddenCount = Math.max(0, todos.length - visibleTodos.length);
  const lines = ["Today's tasks"];
  for (const todo of visibleTodos) {
    lines.push(`${todo.is_completed ? "[x]" : "[ ]"} ${formatTodoWithSchedule(todo)}`);
  }
  if (hiddenCount > 0) {
    lines.push(`+${hiddenCount} more`);
  }
  return lines.join("\n");
}

function formatTodoHtml(todos: StudyTodo[]) {
  if (todos.length === 0) {
    return "";
  }

  const items = todos
    .map((todo) => `<li>${todo.is_completed ? "Done" : "Todo"}: ${escapeHtml(formatTodoWithSchedule(todo))}</li>`)
    .join("");
  return `<p>Today's tasks</p><ul>${items}</ul>`;
}

function formatTodoWithSchedule(todo: StudyTodo) {
  const schedule = formatTodoScheduleLabel(todo);
  return schedule ? `${schedule} ${todo.title}` : todo.title;
}

function formatTodoScheduleLabel(todo: StudyTodo) {
  return todo.start_time && todo.end_time
    ? `${formatTime(todo.start_time)}-${formatTime(todo.end_time)}`
    : "";
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDeadline(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function getSlackBotToken() {
  const value = Deno.env.get("SLACK_BOT_TOKEN") ?? Deno.env.get("STUDY_ALERT_SLACK_BOT_TOKEN");
  if (!value) {
    throw new Error("SLACK_BOT_TOKEN or STUDY_ALERT_SLACK_BOT_TOKEN is required");
  }
  return value;
}
