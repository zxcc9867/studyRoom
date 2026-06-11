import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type TelegramTarget = {
  id: string;
  user_id: string;
  destination: string | null;
};

type StudyTodo = {
  title: string;
  is_completed: boolean;
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

  const target = await loadTelegramTarget(admin, authResult.userId);
  if (!target?.destination) {
    return json({ error: "Enabled Telegram notification target was not found" }, 404);
  }

  const localDate = await getLocalDate(admin, target.user_id);
  const todos = await loadTodos(admin, target.user_id, localDate);

  try {
    const messageId = await sendTelegramMessage(target.destination, localDate, todos);
    await recordDelivery(admin, target, localDate, "sent", null);

    return json({
      ok: true,
      targetId: target.id,
      localDate,
      todoCount: todos.length,
      messageId,
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

async function loadTelegramTarget(admin: ReturnType<typeof createClient>, userId: string | null) {
  let query = admin
    .from("notification_targets")
    .select("id,user_id,destination")
    .eq("kind", "telegram")
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

  return ((data ?? []) as TelegramTarget[]).find((target) => target.destination?.trim());
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
    .select("title,is_completed,position,created_at")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as StudyTodo[];
}

async function sendTelegramMessage(chatId: string, localDate: string, todos: StudyTodo[]) {
  const botToken = requiredEnv("TELEGRAM_BOT_TOKEN");
  const appUrl = Deno.env.get("APP_ORIGIN") ?? "https://study-room-attendance.vercel.app";
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      chat_id: chatId,
      text: buildMessage(localDate, todos, appUrl),
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram message failed: ${response.status} ${await response.text()}`);
  }

  const result = (await response.json().catch(() => null)) as {
    ok?: boolean;
    result?: { message_id?: number };
    description?: string;
  } | null;
  if (!result?.ok) {
    throw new Error(`Telegram message returned unexpected result: ${JSON.stringify(result)}`);
  }

  return result.result?.message_id ?? null;
}

function buildMessage(localDate: string, todos: StudyTodo[], appUrl: string) {
  const lines = [
    "[\uD14C\uC2A4\uD2B8 \uC54C\uB9BC]",
    "\uB3C5\uC11C\uC2E4 \uC785\uC7A5 \uC2DC\uAC04\uC785\uB2C8\uB2E4.",
    "15\uBD84 \uC548\uC5D0 \uC571\uC5D0 \uB4E4\uC5B4\uAC00 \uD0C0\uC774\uBA38\uB97C \uC2DC\uC791\uD558\uC138\uC694.",
    `\uB0A0\uC9DC: ${localDate}`,
  ];

  if (todos.length > 0) {
    lines.push("", "\uC624\uB298 \uD560 \uC77C");
    for (const todo of todos.slice(0, 5)) {
      lines.push(`- ${todo.is_completed ? "[x]" : "[ ]"} ${todo.title}`);
    }
    if (todos.length > 5) {
      lines.push(`- ...\uC678 ${todos.length - 5}\uAC1C`);
    }
  }

  lines.push("", appUrl);
  return lines.join("\n");
}

async function recordDelivery(
  admin: ReturnType<typeof createClient>,
  target: TelegramTarget,
  localDate: string,
  status: "sent" | "failed",
  errorMessage: string | null,
) {
  await admin.from("notification_deliveries").insert({
    user_id: target.user_id,
    target_id: target.id,
    local_date: localDate,
    channel: "telegram",
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

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
