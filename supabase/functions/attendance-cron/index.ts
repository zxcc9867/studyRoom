import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import {
  createRecoveryRequest,
  loadSlackTarget as loadRecoverySlackTarget,
  sendPendingRecoveryFollowups,
  sendRecoveryRequestSlackMessage,
} from "../_shared/recovery.ts";
import { sendWeeklyRecoverySummaries } from "../_shared/recovery_summary.ts";

type DueReminder = {
  user_id: string;
  email: string | null;
  local_date: string;
  reminder_at: string;
  deadline_at: string;
  reminder_stage: "initial" | "nudge";
};

type MissedAttendance = {
  user_id: string;
  local_date: string;
  reminder_at: string;
  deadline_at: string;
};

type DueTodoScheduleReminder = {
  user_id: string;
  target_id: string;
  channel_id: string;
  todo_id: string;
  local_date: string;
  title: string;
  start_time: string;
  end_time: string;
  reminder_type: "start" | "end_soon";
  scheduled_at: string;
  next_todo_title: string | null;
  next_start_time: string | null;
  next_end_time: string | null;
};

type DueSessionLeaseWarning = {
  user_id: string;
  session_id: string;
  target_id: string;
  channel_id: string;
  slack_user_id: string | null;
  local_date: string;
  started_at: string;
  lease_expires_at: string;
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

  const { data: dueTodoScheduleReminders, error: scheduleReminderError } = await admin.rpc(
    "get_due_todo_schedule_reminders",
    { p_now: now },
  );
  if (scheduleReminderError) {
    return new Response(JSON.stringify({ error: scheduleReminderError.message }), { status: 500, headers: jsonHeaders });
  }

  const { data: dueSessionLeaseWarnings, error: leaseWarningError } = await admin.rpc(
    "get_due_session_lease_warnings",
    { p_now: now },
  );
  if (leaseWarningError) {
    return new Response(JSON.stringify({ error: leaseWarningError.message }), { status: 500, headers: jsonHeaders });
  }

  const reminders = (dueReminders ?? []) as DueReminder[];
  const targets = await loadTargets(admin, reminders.map((reminder) => reminder.user_id));
  const todoMap = await loadTodosByReminder(admin, reminders);
  const deliveryResults = await sendReminderNotifications(admin, reminders, targets, todoMap);
  const missedRecoveryResults = await sendMissedRecoveryRequests(
    admin,
    (missed ?? []) as MissedAttendance[],
  );
  const scheduleReminders = (dueTodoScheduleReminders ?? []) as DueTodoScheduleReminder[];
  const scheduleReminderResults = await sendTodoScheduleReminderNotifications(admin, scheduleReminders);
  const sessionLeaseWarnings = (dueSessionLeaseWarnings ?? []) as DueSessionLeaseWarning[];
  const sessionLeaseWarningResults = await sendSessionLeaseWarningNotifications(admin, sessionLeaseWarnings);
  // sendPendingRecoveryFollowups updates study_recovery_requests.followup_sent_at to avoid repeated nudges.
  const recoveryFollowupResults = await sendPendingRecoveryFollowups(admin, now);
  const recoveryWeeklySummaryResults = await sendWeeklyRecoverySummaries(admin, now);

  return new Response(
    JSON.stringify({
      dueReminderCount: reminders.length,
      missedCount: missed?.length ?? 0,
      scheduleReminderCount: scheduleReminders.length,
      sessionLeaseWarningCount: sessionLeaseWarnings.length,
      deliveryResults,
      scheduleReminderResults,
      sessionLeaseWarningResults,
      missedRecoveryResults,
      recoveryFollowupResults,
      recoveryWeeklySummaryResults,
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

async function sendTodoScheduleReminderNotifications(
  admin: ReturnType<typeof createClient>,
  reminders: DueTodoScheduleReminder[],
) {
  const results = [];

  for (const reminder of reminders) {
    const target = {
      id: reminder.target_id,
      kind: "slack" as const,
      destination: reminder.channel_id,
    };

    if (target.kind !== "slack") {
      results.push({ todoId: reminder.todo_id, targetId: target.id, skipped: true, reason: "non_slack_target" });
      continue;
    }

    const { data: locks, error: lockError } = await admin
      .from("study_todo_schedule_deliveries")
      .upsert(
        {
          user_id: reminder.user_id,
          todo_id: reminder.todo_id,
          target_id: target.id,
          local_date: reminder.local_date,
          reminder_type: reminder.reminder_type,
          scheduled_at: reminder.scheduled_at,
          status: "pending",
        },
        { onConflict: "todo_id,target_id,reminder_type,scheduled_at", ignoreDuplicates: true },
      )
      .select("id");

    if (lockError) {
      results.push({ todoId: reminder.todo_id, targetId: target.id, ok: false, error: lockError.message });
      continue;
    }

    const lock = locks?.[0];
    if (!lock) {
      results.push({ todoId: reminder.todo_id, targetId: target.id, skipped: true, reason: "duplicate" });
      continue;
    }

    const outcome = await sendTodoScheduleTarget(target.destination, reminder);
    const { data: notificationDelivery } = await admin
      .from("notification_deliveries")
      .insert({
        user_id: reminder.user_id,
        target_id: target.id,
        local_date: reminder.local_date,
        channel: "slack",
        status: outcome.ok ? "sent" : "failed",
        error_message: outcome.ok ? null : outcome.error,
      })
      .select("id")
      .single();

    await admin
      .from("study_todo_schedule_deliveries")
      .update({
        status: outcome.ok ? "sent" : "failed",
        notification_delivery_id: notificationDelivery?.id ?? null,
        error_message: outcome.ok ? null : outcome.error,
      })
      .eq("id", lock.id);

    results.push({
      todoId: reminder.todo_id,
      targetId: target.id,
      reminderType: reminder.reminder_type,
      ok: outcome.ok,
      error: outcome.error,
    });
  }

  return results;
}

async function sendSessionLeaseWarningNotifications(
  admin: ReturnType<typeof createClient>,
  warnings: DueSessionLeaseWarning[],
) {
  const results = [];

  for (const warning of warnings) {
    const outcome = await sendSessionLeaseWarningTarget(warning.channel_id, warning);
    const { data: notificationDelivery } = await admin
      .from("notification_deliveries")
      .insert({
        user_id: warning.user_id,
        target_id: warning.target_id,
        local_date: warning.local_date,
        channel: "slack",
        status: outcome.ok ? "sent" : "failed",
        error_message: outcome.ok ? null : outcome.error,
      })
      .select("id")
      .single();

    if (outcome.ok) {
      await admin
        .from("study_sessions")
        .update({ lease_warning_sent_at: new Date().toISOString() })
        .eq("id", warning.session_id)
        .is("lease_warning_sent_at", null);
    }

    results.push({
      sessionId: warning.session_id,
      targetId: warning.target_id,
      notificationDeliveryId: notificationDelivery?.id ?? null,
      ok: outcome.ok,
      error: outcome.error,
    });
  }

  return results;
}

async function sendSessionLeaseWarningTarget(channelId: string, warning: DueSessionLeaseWarning) {
  try {
    await sendSlackSessionLeaseWarningMessage(channelId, warning);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
async function sendMissedRecoveryRequests(
  admin: ReturnType<typeof createClient>,
  missedRows: MissedAttendance[],
) {
  const results = [];

  for (const missedRow of missedRows) {
    try {
      const { request, created } = await createRecoveryRequest(admin, {
        userId: missedRow.user_id,
        localDate: missedRow.local_date,
        triggerType: "missed_attendance",
      });

      if (!created && request.slack_message_ts) {
        results.push({
          ok: true,
          skipped: true,
          recoveryRequestId: request.id,
          triggerType: request.trigger_type,
        });
        continue;
      }

      const target = await loadRecoverySlackTarget(admin, missedRow.user_id);
      if (!target?.destination) {
        results.push({
          ok: true,
          slackMissing: true,
          recoveryRequestId: request.id,
          triggerType: request.trigger_type,
        });
        continue;
      }

      results.push(await sendRecoveryRequestSlackMessage(admin, target, request));
    } catch (error) {
      results.push({
        ok: false,
        userId: missedRow.user_id,
        localDate: missedRow.local_date,
        error: error instanceof Error ? error.message : String(error),
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
      html: `<p>Open the study room app and start your timer now.</p><p>Check-in deadline: ${reminder.deadline_at}</p><p>If you miss the check-in window, completing today's ${getDailyAttendanceGoalLabel(reminder.local_date)} study goal will still count as present.</p>${formatTodoHtml(todos)}`,
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

async function sendTodoScheduleTarget(channelId: string, reminder: DueTodoScheduleReminder) {
  try {
    await sendSlackTodoScheduleReminderMessage(channelId, reminder);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function sendSlackSessionLeaseWarningMessage(channelId: string, warning: DueSessionLeaseWarning) {
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
      text: buildSlackSessionLeaseWarningMessage(warning, appUrl),
      blocks: buildSlackSessionLeaseWarningBlocks(warning),
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

async function sendSlackTodoScheduleReminderMessage(channelId: string, reminder: DueTodoScheduleReminder) {
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
      text: buildSlackTodoScheduleReminderMessage(reminder, appUrl),
      blocks: buildSlackTodoScheduleReminderBlocks(reminder),
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
      text: buildSlackReminderMessage(reminder, todos, appUrl),
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
  const goalLabel = getDailyAttendanceGoalLabel(reminder.local_date);
  const lines =
    reminder.reminder_stage === "nudge"
      ? [
          "Final study-room nudge.",
          "15 minutes have passed since the first alarm.",
          `Start the timer before ${formatDeadline(reminder.deadline_at)} or today will be marked missed.`,
          `If you miss it, completing today's ${goalLabel} study goal will recover attendance.`,
        ]
      : [
          "Study-room check-in time.",
          `Start the timer before ${formatDeadline(reminder.deadline_at)}.`,
          `Completing today's ${goalLabel} study goal also counts as present.`,
        ];
  const todoSummary = formatTodoSummary(todos, options);
  if (todoSummary) {
    lines.push("", todoSummary);
  }
  return lines.join("\n");
}

function buildSlackReminderMessage(reminder: DueReminder, todos: StudyTodo[], appUrl: string) {
  const isNudge = reminder.reminder_stage === "nudge";
  const title = isNudge ? "🚨 독서실 마지막 재촉 알림" : "📚 독서실 입장 알림";
  const goalLabel = getDailyAttendanceGoalLabel(reminder.local_date);
  const deadlineNote = isNudge
    ? `• 15분 재촉 알림입니다. 마감 전에 시작하면 즉시 출석이고, 놓쳤다면 오늘 ${goalLabel} 목표를 채우면 출석으로 전환됩니다.`
    : `• 30분 안에 타이머를 시작하거나 오늘 ${goalLabel} 목표를 채우면 출석으로 인정됩니다.`;
  const action = isNudge
    ? "• 아직 타이머 시작 기록이 없습니다. 지금 앱을 열고 [입장하고 시작]을 눌러주세요."
    : "• 앱을 열고 [입장하고 시작]을 눌러 오늘 공부를 시작하세요.";

  return [
    `*${title}*`,
    "",
    "⏰ 출석 마감",
    `• ${formatDeadline(reminder.deadline_at)}`,
    deadlineNote,
    "",
    formatSlackTodoSection(todos, 5),
    "",
    "🎯 지금 할 일",
    action,
    "",
    "🔗 앱 열기",
    appUrl,
  ].join("\n");
}

function buildSlackSessionLeaseWarningMessage(warning: DueSessionLeaseWarning, appUrl: string) {
  const mention = buildSlackUserMention(warning.slack_user_id);
  return [
    ...(mention ? [mention, ""] : []),
    "*⏰ 세션 종료 5분 전*",
    "",
    `세션 유지 시간이 ${formatDateTime(warning.lease_expires_at)}에 만료됩니다.`,
    "계속 공부 중이면 아래 버튼으로 연장하세요. 연장 후 남은 시간은 최대 2시간입니다.",
    "연장하지 않으면 앱이 열려 있을 때 세션이 자동 종료되고, 이후 시간은 공부 시간에서 제외됩니다.",
    "",
    "🔗 앱 열기",
    appUrl,
  ].join("\n");
}

function buildSlackSessionLeaseWarningBlocks(warning: DueSessionLeaseWarning) {
  const mention = buildSlackUserMention(warning.slack_user_id);
  const mentionPrefix = mention ? `${mention}\n` : "";
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${mentionPrefix}*⏰ 세션 종료 5분 전*\n세션 유지 시간이 *${formatDateTime(warning.lease_expires_at)}*에 만료됩니다.`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "계속 공부 중이면 *세션 유지*를 눌러 연장하세요. 남은 시간은 최대 2시간입니다.",
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          style: "primary",
          text: { type: "plain_text", text: "세션 유지 (최대 2시간)", emoji: true },
          action_id: "extend_session_lease_60",
          value: `session_lease_extension|${warning.session_id}|60`,
        },
      ],
    },
  ];
}
function buildSlackTodoScheduleReminderMessage(reminder: DueTodoScheduleReminder, appUrl: string) {
  const scheduleLabel = formatTodoScheduleWindow(reminder.start_time, reminder.end_time);
  if (reminder.reminder_type === "end_soon") {
    const nextSchedule = reminder.next_todo_title && reminder.next_start_time && reminder.next_end_time
      ? [
          "",
          "다음 일정",
          `• ${formatTodoScheduleWindow(reminder.next_start_time, reminder.next_end_time)} ${reminder.next_todo_title}`,
        ]
      : [];

    return [
      "*⏳ 일정 종료 5분 전*",
      "",
      "지금 일정이 곧 끝납니다.",
      `• ${scheduleLabel} ${reminder.title}`,
      "• 5분 뒤 마무리하고 다음 계획으로 넘어가세요.",
      ...nextSchedule,
      "",
      "🔗 앱 열기",
      appUrl,
    ].join("\n");
  }

  return [
    "*📌 지금 시작할 일정*",
    "",
    `${reminder.title}를 시작할 시간입니다.`,
    `• ${scheduleLabel}`,
    "• 생활계획표에 맞춰 지금 이 할 일을 진행하세요.",
    "",
    "🔗 앱 열기",
    appUrl,
  ].join("\n");
}

function buildSlackTodoScheduleReminderBlocks(reminder: DueTodoScheduleReminder) {
  const scheduleLabel = formatTodoScheduleWindow(reminder.start_time, reminder.end_time);
  const title = reminder.reminder_type === "end_soon" ? "⏳ 일정 종료 5분 전" : "📌 지금 시작할 일정";
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${title}*\n${scheduleLabel} ${reminder.title}`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "5분 연장", emoji: true },
          action_id: "extend_schedule_5",
          value: `schedule_extension|${reminder.todo_id}|5`,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "10분 연장", emoji: true },
          action_id: "extend_schedule_10",
          value: `schedule_extension|${reminder.todo_id}|10`,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "직접 입력", emoji: true },
          action_id: "extend_schedule_custom",
          value: `schedule_extension|${reminder.todo_id}|custom`,
        },
      ],
    },
  ];
}
function formatTodoScheduleWindow(startTime: string, endTime: string) {
  return `${formatTime(startTime)}-${formatTime(endTime)}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDailyAttendanceGoalLabel(localDate: string) {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  const day = date.getUTCDay();
  return day === 0 || day === 6 ? "4시간" : "2시간";
}

function formatSlackTodoSection(todos: StudyTodo[], maxTodos: number) {
  if (todos.length === 0) {
    return "✅ 오늘 할 일\n• 아직 등록된 할 일이 없습니다.";
  }

  const visibleTodos = todos.slice(0, maxTodos);
  const hiddenCount = Math.max(0, todos.length - visibleTodos.length);
  const lines = ["✅ 오늘 할 일"];
  for (const todo of visibleTodos) {
    lines.push(`• ${todo.is_completed ? "☑️" : "⬜"} ${formatTodoWithSchedule(todo)}`);
  }
  if (hiddenCount > 0) {
    lines.push(`• 외 ${hiddenCount}개 더 있습니다.`);
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

function buildSlackUserMention(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return /^[UW][A-Z0-9]{8,}$/.test(normalized) ? `<@${normalized}>` : "";
}
function getSlackBotToken() {
  const value = Deno.env.get("SLACK_BOT_TOKEN") ?? Deno.env.get("STUDY_ALERT_SLACK_BOT_TOKEN");
  if (!value) {
    throw new Error("SLACK_BOT_TOKEN or STUDY_ALERT_SLACK_BOT_TOKEN is required");
  }
  return value;
}
