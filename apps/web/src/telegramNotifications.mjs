import { supabase, supabaseAnonKey, supabaseUrl } from "./supabase";
import { isValidTelegramChatId, normalizeTelegramChatId } from "./telegramChatId.mjs";

export { isValidTelegramChatId, normalizeTelegramChatId } from "./telegramChatId.mjs";

export async function getTelegramNotificationStatus(userId) {
  const { data, error } = await supabase
    .from("notification_targets")
    .select("destination,enabled,updated_at")
    .eq("user_id", userId)
    .eq("kind", "telegram")
    .eq("enabled", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    connected: Boolean(data?.enabled && data?.destination),
    chatId: data?.destination ?? "",
    updatedAt: data?.updated_at ?? null,
  };
}

export async function saveTelegramNotificationTarget(userId, chatId) {
  const destination = normalizeTelegramChatId(chatId);
  if (!isValidTelegramChatId(destination)) {
    throw new Error("Telegram Chat ID 형식이 올바르지 않습니다.");
  }

  const { error } = await supabase.from("notification_targets").upsert(
    {
      user_id: userId,
      kind: "telegram",
      destination,
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
    chatId: destination,
    updatedAt: new Date().toISOString(),
  };
}

export async function sendTelegramTestAlarm(session) {
  if (!session?.access_token) {
    throw new Error("Supabase session is required");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/telegram-test-alarm`, {
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
    throw new Error(payload?.error ?? `Telegram test alarm failed: ${response.status}`);
  }

  return {
    ok: Boolean(payload?.ok),
    localDate: typeof payload?.localDate === "string" ? payload.localDate : "",
    todoCount: Number.isFinite(Number(payload?.todoCount)) ? Number(payload.todoCount) : 0,
    messageId: payload?.messageId ?? null,
  };
}
