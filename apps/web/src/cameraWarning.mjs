import { supabase, supabaseAnonKey, supabaseUrl } from "./supabase";

export async function sendCameraPresenceWarning(session, { sessionId, absenceSeconds, detectedAt }) {
  if (!session?.access_token) {
    throw new Error("Supabase session is required");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/camera-presence-warning`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sessionId,
      absenceSeconds,
      detectedAt,
    }),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? `Camera presence warning failed: ${response.status}`);
  }

  return {
    ok: Boolean(payload?.ok),
    telegramSent: Boolean(payload?.telegramSent),
    telegramMissing: Boolean(payload?.telegramMissing),
    eventId: typeof payload?.eventId === "string" ? payload.eventId : "",
    messageId: payload?.messageId ?? null,
  };
}

export async function recordCameraPresenceEvent(userId, sessionId, eventType, options = {}) {
  const { error } = await supabase.from("study_presence_events").insert({
    user_id: userId,
    session_id: sessionId,
    event_type: eventType,
    absence_seconds: Number.isFinite(Number(options.absenceSeconds)) ? Number(options.absenceSeconds) : 0,
    detected_at: typeof options.detectedAt === "string" ? options.detectedAt : new Date().toISOString(),
    metadata: sanitizePresenceMetadata(options.metadata),
  });

  if (error) {
    throw error;
  }
}

function sanitizePresenceMetadata(metadata) {
  const blockedKeys = new Set(["image", "video", "frame", "faceEmbedding", "landmarks"]);
  const source = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
  return Object.fromEntries(Object.entries(source).filter(([key]) => !blockedKeys.has(key)));
}
