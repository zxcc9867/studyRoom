import { supabase, supabaseAnonKey, supabaseUrl } from "./supabase";
import { isValidSlackChannelId, normalizeSlackChannelId } from "./slackChannelId.mjs";
import { isValidSlackUserId, normalizeSlackUserId } from "./slackUserId.mjs";

export { isValidSlackChannelId, normalizeSlackChannelId } from "./slackChannelId.mjs";
export { buildSlackUserMention, isValidSlackUserId, normalizeSlackUserId } from "./slackUserId.mjs";

export async function getSlackNotificationStatus(userId) {
  const { data, error } = await supabase
    .from("notification_targets")
    .select("destination,enabled,updated_at,slack_user_id")
    .eq("user_id", userId)
    .eq("kind", "slack")
    .eq("enabled", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    connected: Boolean(data?.enabled && data?.destination),
    channelId: data?.destination ?? "",
    updatedAt: data?.updated_at ?? null,
    slackUserId: data?.slack_user_id ?? "",
  };
}

export async function saveSlackNotificationTarget(userId, channelId, slackUserId = "") {
  const destination = normalizeSlackChannelId(channelId);
  const nextSlackUserId = normalizeSlackUserId(slackUserId);
  if (!isValidSlackChannelId(destination)) {
    throw new Error("Slack Channel ID \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  }
  if (nextSlackUserId && !isValidSlackUserId(nextSlackUserId)) {
    throw new Error("Slack User ID \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. U \uB610\uB294 W\uB85C \uC2DC\uC791\uD558\uB294 \uBA64\uBC84 ID\uB97C \uC785\uB825\uD558\uC138\uC694.");
  }

  const { error } = await supabase.from("notification_targets").upsert(
    {
      user_id: userId,
      kind: "slack",
      destination,
      slack_user_id: nextSlackUserId || null,
      enabled: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,kind,target_key" },
  );

  if (error) {
    throw error;
  }

  return {
    connected: true,
    channelId: destination,
    updatedAt: new Date().toISOString(),
    slackUserId: nextSlackUserId,
  };
}
export async function sendSlackTestAlarm(session) {
  if (!session?.access_token) {
    throw new Error("Supabase session is required");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/slack-test-alarm`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
    },
    body: "{}",
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? `Slack test alarm failed: ${response.status}`);
  }

  return {
    ok: Boolean(payload?.ok),
    localDate: typeof payload?.localDate === "string" ? payload.localDate : "",
    todoCount: Number.isFinite(Number(payload?.todoCount)) ? Number(payload.todoCount) : 0,
    messageTs: typeof payload?.messageTs === "string" ? payload.messageTs : null,
  };
}
