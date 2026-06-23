import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type SlackTarget = {
  id: string;
  user_id: string;
  destination: string | null;
};

type StudyTodo = {
  title: string;
  is_completed: boolean;
  start_time: string | null;
  end_time: string | null;
};

type RecoveryRequest = {
  id: string;
  local_date: string;
  trigger_type: "missed_attendance" | "camera_absence_repeat";
  status: "pending" | "submitted";
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "access-control-allow-methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "content-type": "application/json" };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const hasCronSecret = Boolean(cronSecret && request.headers.get("x-cron-secret") === cronSecret);
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const admin = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authResult = hasCronSecret ? { userId: null } : await getAuthenticatedUserId(admin, request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const payload = await request.json().catch(() => null);
  const directChannelId = hasCronSecret ? parseDirectChannelId(payload) : "";
  const recoveryRequestId = hasCronSecret ? parseRecoveryRequestId(payload) : "";
  if (directChannelId && recoveryRequestId) {
    const recoveryRequest = await loadRecoveryRequest(admin, recoveryRequestId);
    if (!recoveryRequest) {
      return json({ error: "Recovery request was not found" }, 404);
    }
    if (recoveryRequest.status !== "pending") {
      return json({ error: "Recovery request is not pending" }, 409);
    }

    const messageTs = await sendRecoveryRoutineTestMessage(directChannelId, recoveryRequest);
    return json({
      ok: true,
      directChannelId,
      recoveryRequestId: recoveryRequest.id,
      localDate: recoveryRequest.local_date,
      messageTs,
    });
  }

  if (directChannelId) {
    const localDate = getLocalDateForTimeZone("Asia/Seoul");
    const messageTs = await sendSlackMessage(directChannelId, localDate, []);
    return json({
      ok: true,
      directChannelId,
      localDate,
      todoCount: 0,
      messageTs,
    });
  }

  const target = await loadSlackTarget(admin, authResult.userId);
  if (!target?.destination) {
    return json({ error: "Enabled Slack notification target was not found" }, 404);
  }

  const localDate = await getLocalDate(admin, target.user_id);
  const todos = await loadTodos(admin, target.user_id, localDate);

  try {
    const messageTs = await sendSlackMessage(target.destination, localDate, todos);
    await recordDelivery(admin, target, localDate, "sent", null);

    return json({
      ok: true,
      targetId: target.id,
      localDate,
      todoCount: todos.length,
      messageTs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordDelivery(admin, target, localDate, "failed", message);
    return json({ error: message }, 502);
  }
});

async function getAuthenticatedUserId(admin: ReturnType<typeof createClient>, request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return { response: json({ error: "Unauthorized" }, 401) };
  }

  const {
    data: { user },
    error,
  } = await admin.auth.getUser(jwt);
  if (error || !user) {
    return { response: json({ error: "Unauthorized" }, 401) };
  }

  return { userId: user.id };
}

async function loadSlackTarget(admin: ReturnType<typeof createClient>, userId: string | null) {
  let query = admin
    .from("notification_targets")
    .select("id,user_id,destination")
    .eq("kind", "slack")
    .eq("enabled", true)
    .not("destination", "is", null)
    .order("updated_at", { ascending: false });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw error;
  }

  return ((data ?? []) as SlackTarget[]).find((target) => target.destination?.trim());
}

async function getLocalDate(admin: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("time_zone")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const timeZone = typeof data?.time_zone === "string" && data.time_zone ? data.time_zone : "Asia/Seoul";
  return getLocalDateForTimeZone(timeZone);
}

function getLocalDateForTimeZone(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function loadTodos(admin: ReturnType<typeof createClient>, userId: string, localDate: string) {
  const { data, error } = await admin
    .from("study_todos")
    .select("title,is_completed,start_time,end_time,position,created_at")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .order("start_time", { ascending: true, nullsFirst: false })
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as StudyTodo[];
}

async function sendSlackMessage(channelId: string, localDate: string, todos: StudyTodo[]) {
  const botToken = getSlackBotToken();
  const appUrl = Deno.env.get("APP_ORIGIN") ?? "https://study-room-attendance.vercel.app";
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      ...jsonHeaders,
      authorization: `Bearer ${botToken}`,
    },
    body: JSON.stringify({
      channel: channelId,
      text: buildMessage(localDate, todos, appUrl),
      unfurl_links: false,
      unfurl_media: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack message failed: ${response.status} ${await response.text()}`);
  }

  const result = (await response.json().catch(() => null)) as {
    ok?: boolean;
    ts?: string;
    error?: string;
  } | null;
  if (!result?.ok) {
    throw new Error(`Slack message returned unexpected result: ${JSON.stringify(result)}`);
  }

  return result.ts ?? null;
}

function parseDirectChannelId(payload: unknown) {
  const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const channelId = typeof data?.channelId === "string" ? data.channelId.trim().toUpperCase() : "";
  return /^[CG][A-Z0-9]{8,}$/.test(channelId) ? channelId : "";
}

function parseRecoveryRequestId(payload: unknown) {
  const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const recoveryRequestId = typeof data?.recoveryRequestId === "string" ? data.recoveryRequestId.trim() : "";
  return isUuid(recoveryRequestId) ? recoveryRequestId : "";
}

async function loadRecoveryRequest(admin: ReturnType<typeof createClient>, recoveryRequestId: string) {
  const { data, error } = await admin
    .from("study_recovery_requests")
    .select("id,local_date,trigger_type,status")
    .eq("id", recoveryRequestId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as RecoveryRequest | null) ?? null;
}

async function sendRecoveryRoutineTestMessage(channelId: string, recoveryRequest: RecoveryRequest) {
  const botToken = getSlackBotToken();
  const appUrl = Deno.env.get("APP_ORIGIN") ?? "https://study-room-attendance.vercel.app";
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      ...jsonHeaders,
      authorization: `Bearer ${botToken}`,
    },
    body: JSON.stringify({
      channel: channelId,
      text: buildRecoveryRoutineTestMessage(recoveryRequest, appUrl),
      blocks: buildRecoveryRoutineTestBlocks(recoveryRequest, appUrl),
      unfurl_links: false,
      unfurl_media: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack recovery routine test failed: ${response.status} ${await response.text()}`);
  }

  const result = (await response.json().catch(() => null)) as {
    ok?: boolean;
    ts?: string;
    error?: string;
  } | null;
  if (!result?.ok) {
    throw new Error(`Slack recovery routine test returned unexpected result: ${JSON.stringify(result)}`);
  }

  return result.ts ?? null;
}

function buildRecoveryRoutineTestMessage(recoveryRequest: RecoveryRequest, appUrl: string) {
  return [
    "*🧪 회복 루틴 테스트*",
    "아래 버튼을 눌러 Slack 모달이 열리는지 확인하세요.",
    `날짜: ${recoveryRequest.local_date}`,
    `요청 ID: ${recoveryRequest.id}`,
    appUrl,
  ].join("\n");
}

function buildRecoveryRoutineTestBlocks(recoveryRequest: RecoveryRequest, appUrl: string) {
  const reason = recoveryRequest.trigger_type === "missed_attendance"
    ? "오늘 출석 실패"
    : "자리 비움 반복 감지";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🧪 회복 루틴 테스트*\n${reason} 상태의 pending 요청으로 Slack 모달을 확인합니다.`,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*날짜*\n${recoveryRequest.local_date}` },
        { type: "mrkdwn", text: "*상태*\n회복 루틴 필요" },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "회복 루틴 작성", emoji: true },
          style: "danger",
          action_id: "open_recovery_routine",
          value: recoveryRequest.id,
        },
      ],
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `앱: ${appUrl}` }],
    },
  ];
}

function buildMessage(localDate: string, todos: StudyTodo[], appUrl: string) {
  const lines = [
    "*🧪 Slack 테스트 알림*",
    "",
    "📅 기준 날짜",
    `• ${localDate}`,
    "",
    formatSlackTodoSection(todos, 5),
    "",
    "🎯 설정 확인",
    "• 이 메시지가 보이면 Slack bot token, 채널 ID, bot 초대 상태가 정상입니다.",
    "• 실제 알림에는 출석 마감 시간과 오늘 할 일이 함께 표시됩니다.",
    "",
    "🔗 앱 열기",
    appUrl,
  ];

  return lines.join("\n");
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

function formatTodoWithSchedule(todo: StudyTodo) {
  const schedule = todo.start_time && todo.end_time
    ? `${todo.start_time.slice(0, 5)}-${todo.end_time.slice(0, 5)}`
    : "";
  return schedule ? `${schedule} ${todo.title}` : todo.title;
}

async function recordDelivery(
  admin: ReturnType<typeof createClient>,
  target: SlackTarget,
  localDate: string,
  status: "sent" | "failed",
  errorMessage: string | null,
) {
  await admin.from("notification_deliveries").insert({
    user_id: target.user_id,
    target_id: target.id,
    local_date: localDate,
    channel: "slack",
    status,
    error_message: errorMessage,
  });
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
