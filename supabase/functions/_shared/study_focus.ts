import type { SupabaseClient } from "jsr:@supabase/supabase-js@2.57.4";

type FocusState = {
  user_id: string;
  revision: number;
  changed_at: string;
  last_signal_at: string | null;
};

type FocusDevice = {
  user_id: string;
  expo_push_token: string;
  opted_in: boolean;
  permission_granted: boolean;
  applied_revision: number | null;
};

export function shouldSendFocusSignal(
  state: Pick<FocusState, "revision" | "changed_at" | "last_signal_at">,
  device: Pick<FocusDevice, "opted_in" | "permission_granted" | "applied_revision">,
  nowMs: number,
) {
  if (!device.opted_in || !device.permission_granted) return false;
  if (device.applied_revision === state.revision) return false;
  if (!state.last_signal_at || Date.parse(state.last_signal_at) < Date.parse(state.changed_at)) return true;
  return nowMs - Date.parse(state.last_signal_at) >= 10 * 60_000;
}

export async function sendStudyFocusSignals(admin: SupabaseClient, userId?: string) {
  let stateQuery = admin.from("study_focus_state")
    .select("user_id,revision,changed_at,last_signal_at")
    .order("changed_at", { ascending: false }).limit(userId ? 1 : 100);
  if (userId) stateQuery = stateQuery.eq("user_id", userId);
  const { data: stateRows, error: stateError } = await stateQuery;
  if (stateError) throw stateError;
  const states = (stateRows ?? []) as FocusState[];
  if (states.length === 0) return { attempted: 0, sent: 0, failed: 0 };

  const { data: deviceRows, error: deviceError } = await admin.from("study_focus_devices")
    .select("user_id,expo_push_token,opted_in,permission_granted,applied_revision")
    .in("user_id", states.map((row) => row.user_id));
  if (deviceError) throw deviceError;
  const deviceByUser = new Map(((deviceRows ?? []) as FocusDevice[]).map((row) => [row.user_id, row]));
  const result = { attempted: 0, sent: 0, failed: 0 };

  for (const state of states) {
    const device = deviceByUser.get(state.user_id);
    if (!device || !shouldSendFocusSignal(state, device, Date.now())) continue;
    result.attempted += 1;
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: device.expo_push_token,
          data: { type: "study_focus_changed" },
          priority: "high",
          ttl: 600,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`Expo push HTTP ${response.status}`);
      const receipt = await response.json();
      if (receipt?.data?.status !== "ok") throw new Error("Expo rejected focus signal");
      const { error: updateError } = await admin.from("study_focus_state")
        .update({ last_signal_at: new Date().toISOString() })
        .eq("user_id", state.user_id).eq("revision", state.revision);
      if (updateError) throw updateError;
      result.sent += 1;
    } catch (error) {
      // A failed wake-up must not roll back or block a study session.
      console.warn("Focus signal delivery failed", state.user_id, error instanceof Error ? error.message : String(error));
      result.failed += 1;
    }
  }
  return result;
}
