import { assertEquals } from "jsr:@std/assert@1";
import { shouldSendFocusSignal } from "./study_focus.ts";

Deno.test("focus signal is sent only for an opted-in device with a changed or unacknowledged revision", () => {
  const now = Date.parse("2026-09-27T12:00:00Z");
  const state = { revision: 4, changed_at: "2026-09-27T11:59:00Z", last_signal_at: null };
  const device = { opted_in: true, permission_granted: true, applied_revision: 3 };
  assertEquals(shouldSendFocusSignal(state, device, now), true);
  assertEquals(shouldSendFocusSignal(state, { ...device, opted_in: false }, now), false);
  assertEquals(shouldSendFocusSignal({ ...state, last_signal_at: "2026-09-27T11:59:30Z" }, { ...device, applied_revision: 4 }, now), false);
  assertEquals(shouldSendFocusSignal({ ...state, last_signal_at: "2026-09-27T11:59:30Z" }, device, now), false);
  assertEquals(shouldSendFocusSignal({ ...state, last_signal_at: "2026-09-27T11:40:00Z" }, device, now), true);
});
