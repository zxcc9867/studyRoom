import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type DueReminder = {
  user_id: string;
  email: string | null;
  local_date: string;
  reminder_at: string;
  deadline_at: string;
};

type NotificationTarget = {
  id: string;
  user_id: string;
  kind: "expo" | "web_push" | "email" | "kakao_memo" | "telegram";
  destination: string | null;
  subscription: Record<string, unknown> | null;
};

type StudyTodo = {
  user_id: string;
  local_date: string;
  title: string;
  is_completed: boolean;
  position: number;
  created_at: string;
};

type KakaoConnection = {
  access_token: string;
  refresh_token: string | null;
  access_token_expires_at: string | null;
  scope: string | null;
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
    .select("user_id,local_date,title,is_completed,position,created_at")
    .in("user_id", reminderUserIds)
    .in("local_date", reminderDates)
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
      const outcome = await sendTarget(admin, reminder, target, todos);
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
  admin: ReturnType<typeof createClient>,
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
    } else if (target.kind === "kakao_memo") {
      await sendKakaoMemo(admin, reminder.user_id, reminder, todos);
    } else if (target.kind === "telegram") {
      await sendTelegramMessage(target.destination!, reminder, todos);
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
      title: "Study room check-in time",
      body: buildReminderBody(reminder, todos, { maxTodos: 3 }),
      data: {
        type: "study_reminder",
        localDate: reminder.local_date,
        deadlineAt: reminder.deadline_at,
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
      subject: "Study room check-in time",
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
      title: "Study room check-in time",
      body: buildReminderBody(reminder, todos, { maxTodos: 3 }),
      url: "/",
      localDate: reminder.local_date,
      deadlineAt: reminder.deadline_at,
      todos: todos.map((todo) => ({ title: todo.title, isCompleted: todo.is_completed })),
    }),
  );
}

async function sendKakaoMemo(
  admin: ReturnType<typeof createClient>,
  userId: string,
  reminder: DueReminder,
  todos: StudyTodo[],
) {
  const { data, error } = await admin
    .from("kakao_message_connections")
    .select("access_token,refresh_token,access_token_expires_at,scope")
    .eq("user_id", userId)
    .eq("enabled", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Kakao connection is missing");
  }

  const accessToken = await getUsableKakaoAccessToken(admin, userId, data as KakaoConnection);
  const appUrl = Deno.env.get("APP_ORIGIN") ?? Deno.env.get("SITE_URL") ?? "http://127.0.0.1:5177";
  const templateObject = {
    object_type: "text",
    text: buildReminderBody(reminder, todos, { maxTodos: 5 }),
    link: {
      web_url: appUrl,
      mobile_web_url: appUrl,
    },
    button_title: "독서실 열기",
  };
  const body = new URLSearchParams();
  body.set("template_object", JSON.stringify(templateObject));

  const response = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Kakao memo failed: ${response.status} ${await response.text()}`);
  }

  const result = (await response.json().catch(() => null)) as { result_code?: number } | null;
  if (!result || result.result_code !== 0) {
    throw new Error(`Kakao memo returned unexpected result: ${JSON.stringify(result)}`);
  }
}

async function sendTelegramMessage(chatId: string, reminder: DueReminder, todos: StudyTodo[]) {
  if (!chatId) {
    throw new Error("Telegram chat ID is missing");
  }

  const botToken = requiredEnv("TELEGRAM_BOT_TOKEN");
  const appUrl = Deno.env.get("APP_ORIGIN") ?? Deno.env.get("SITE_URL") ?? "http://127.0.0.1:5177";
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      chat_id: chatId,
      text: `${buildReminderBody(reminder, todos, { maxTodos: 5 })}\n${appUrl}`,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram message failed: ${response.status} ${await response.text()}`);
  }

  const result = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!result?.ok) {
    throw new Error(`Telegram message returned unexpected result: ${JSON.stringify(result)}`);
  }
}

function getReminderTodoKey(userId: string, localDate: string) {
  return `${userId}:${localDate}`;
}

function buildReminderBody(reminder: DueReminder, todos: StudyTodo[], options: { maxTodos?: number } = {}) {
  const lines = [
    "독서실 입장 시간입니다.",
    `${formatDeadline(reminder.deadline_at)}까지 타이머를 시작하세요.`,
  ];
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
  const lines = ["오늘 할 일"];
  for (const todo of visibleTodos) {
    lines.push(`${todo.is_completed ? "✓" : "□"} ${todo.title}`);
  }
  if (hiddenCount > 0) {
    lines.push(`외 ${hiddenCount}개`);
  }
  return lines.join("\n");
}

function formatTodoHtml(todos: StudyTodo[]) {
  if (todos.length === 0) {
    return "";
  }

  const items = todos
    .map((todo) => `<li>${todo.is_completed ? "완료" : "예정"}: ${escapeHtml(todo.title)}</li>`)
    .join("");
  return `<p>오늘 할 일</p><ul>${items}</ul>`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function getUsableKakaoAccessToken(
  admin: ReturnType<typeof createClient>,
  userId: string,
  connection: KakaoConnection,
) {
  const expiresAtMs = connection.access_token_expires_at
    ? new Date(connection.access_token_expires_at).getTime()
    : Number.POSITIVE_INFINITY;
  const refreshWindowMs = 60 * 1000;
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now() + refreshWindowMs) {
    return await refreshKakaoAccessToken(admin, userId, connection);
  }

  return connection.access_token;
}

async function refreshKakaoAccessToken(
  admin: ReturnType<typeof createClient>,
  userId: string,
  connection: KakaoConnection,
) {
  if (!connection.refresh_token) {
    throw new Error("Kakao refresh token is missing");
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: requiredEnv("KAKAO_REST_API_KEY"),
    refresh_token: connection.refresh_token,
  });
  const clientSecret = Deno.env.get("KAKAO_CLIENT_SECRET");
  if (clientSecret) {
    params.set("client_secret", clientSecret);
  }

  const response = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: params,
  });

  if (!response.ok) {
    throw new Error(`Kakao token refresh failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!payload.access_token) {
    throw new Error("Kakao token refresh did not return an access token");
  }

  const expiresInSeconds = Number.isFinite(Number(payload.expires_in)) ? Number(payload.expires_in) : 6 * 60 * 60;
  const nextRefreshToken = payload.refresh_token ?? connection.refresh_token;
  const { error } = await admin
    .from("kakao_message_connections")
    .update({
      access_token: payload.access_token,
      refresh_token: nextRefreshToken,
      access_token_expires_at: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      scope: payload.scope ?? connection.scope,
    })
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return payload.access_token;
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
