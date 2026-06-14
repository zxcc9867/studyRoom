import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type StudySessionRow = {
  id: string;
  user_id: string;
  local_date: string;
  status: string;
};

type SlackTarget = {
  id: string;
  user_id: string;
  destination: string | null;
};

type PresenceWarningEventType = "absence_warning" | "camera_required_warning";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "content-type": "application/json" };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const admin = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authResult = await getAuthenticatedUser(admin, request);
  if ("response" in authResult) {
    return authResult.response;
  }
  const user = authResult.user;

  const payload = await request.json().catch(() => null);
  const parsed = parseWarningPayload(payload);
  if ("response" in parsed) {
    return parsed.response;
  }
  const { sessionId, absenceSeconds, detectedAt, eventType } = parsed;

  const studySession = await loadStudySession(admin, sessionId);
  if (!studySession || studySession.user_id !== user.id) {
    return json({ error: "Study session was not found" }, 403);
  }

  const target = await loadSlackTarget(admin, user.id);
  const eventId = await recordPresenceEvent(admin, studySession, eventType, absenceSeconds, detectedAt, Boolean(target));

  if (!target?.destination) {
    return json({
      ok: true,
      slackSent: false,
      slackMissing: true,
      eventId,
    });
  }

  try {
    const messageTs = await sendSlackMessage(target.destination, eventType);
    await recordDelivery(admin, target, studySession.local_date, "sent", null);
    return json({
      ok: true,
      slackSent: true,
      slackMissing: false,
      eventId,
      messageTs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordDelivery(admin, target, studySession.local_date, "failed", message);
    return json({ error: message, eventId, slackSent: false }, 502);
  }
});

async function getAuthenticatedUser(admin: ReturnType<typeof createClient>, request: Request) {
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

  return { user };
}

function parseWarningPayload(payload: unknown) {
  const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const sessionId = typeof data?.sessionId === "string" ? data.sessionId : "";
  const absenceSeconds = Number(data?.absenceSeconds);
  const detectedAtInput = typeof data?.detectedAt === "string" ? data.detectedAt : "";
  const detectedAtMs = Date.parse(detectedAtInput);
  const eventType = parseEventType(data?.eventType);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    return { response: json({ error: "sessionId must be a uuid" }, 400) };
  }

  if (!eventType) {
    return { response: json({ error: "eventType is not supported" }, 400) };
  }

  const minimumAbsenceSeconds = eventType === "absence_warning" ? 300 : 0;
  if (!Number.isFinite(absenceSeconds) || absenceSeconds < minimumAbsenceSeconds) {
    return { response: json({ error: `absenceSeconds must be at least ${minimumAbsenceSeconds}` }, 400) };
  }

  return {
    sessionId,
    absenceSeconds: Math.floor(absenceSeconds),
    detectedAt: Number.isFinite(detectedAtMs) ? new Date(detectedAtMs).toISOString() : new Date().toISOString(),
    eventType,
  };
}

function parseEventType(value: unknown): PresenceWarningEventType | null {
  if (value === undefined || value === null || value === "") {
    return "absence_warning";
  }

  if (value === "absence_warning" || value === "camera_required_warning") {
    return value;
  }

  return null;
}

async function loadStudySession(admin: ReturnType<typeof createClient>, sessionId: string) {
  const { data, error } = await admin
    .from("study_sessions")
    .select("id,user_id,local_date,status")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as StudySessionRow | null;
}

async function loadSlackTarget(admin: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await admin
    .from("notification_targets")
    .select("id,user_id,destination")
    .eq("kind", "slack")
    .eq("enabled", true)
    .eq("user_id", userId)
    .not("destination", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return ((data ?? []) as SlackTarget[]).find((target) => target.destination?.trim());
}

async function recordPresenceEvent(
  admin: ReturnType<typeof createClient>,
  studySession: StudySessionRow,
  eventType: PresenceWarningEventType,
  absenceSeconds: number,
  detectedAt: string,
  slackAttempted: boolean,
) {
  const { data, error } = await admin
    .from("study_presence_events")
    .insert({
      user_id: studySession.user_id,
      session_id: studySession.id,
      event_type: eventType,
      absence_seconds: absenceSeconds,
      detected_at: detectedAt,
      metadata: {
        source: "web-camera",
        slackAttempted,
      },
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return String(data.id);
}

async function sendSlackMessage(channelId: string, eventType: PresenceWarningEventType) {
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
      text: buildWarningMessage(appUrl, eventType),
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

function buildWarningMessage(appUrl: string, eventType: PresenceWarningEventType) {
  if (eventType === "camera_required_warning") {
    return [
      "\uCE74\uBA54\uB77C \uAC10\uC2DC \uACBD\uACE0",
      "\uD604\uC7AC \uACF5\uBD80 \uC138\uC158\uC758 \uCE74\uBA54\uB77C \uAC10\uC2DC\uAC00 \uAEBC\uC838 \uC788\uC2B5\uB2C8\uB2E4. \uCD9C\uC11D\uC744 \uC720\uC9C0\uD558\uB824\uBA74 \uC571\uC73C\uB85C \uB3CC\uC544\uC640 \uCE74\uBA54\uB77C\uB97C \uCF1C\uC138\uC694.",
      "",
      appUrl,
    ].join("\n");
  }

  return [
    "\uC790\uB9AC \uBE44\uC6C0 \uACBD\uACE0",
    "5\uBD84 \uB3D9\uC548 \uCE74\uBA54\uB77C\uC5D0\uC11C \uC5BC\uAD74\uC774 \uAC10\uC9C0\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC790\uB9AC\uB85C \uB3CC\uC544\uC640 \uACF5\uBD80\uB97C \uC774\uC5B4\uAC00\uC138\uC694.",
    "",
    appUrl,
  ].join("\n");
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

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
