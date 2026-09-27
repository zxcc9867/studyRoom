import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

import { reconcileFocusForSignedInUser } from "./focus";

const taskName = "STUDY_FOCUS_STATE_CHANGED";

TaskManager.defineTask<Notifications.NotificationTaskPayload>(taskName, async ({ data, error }) => {
  if (error || !data || "actionIdentifier" in data) return;
  let payload: Record<string, unknown> = data.data;
  if (typeof payload.dataString === "string") {
    try { payload = JSON.parse(payload.dataString) as Record<string, unknown>; } catch { return; }
  }
  if (payload.type !== "study_focus_changed") return;
  // The push has no desired state. Always fetch the latest state after waking up.
  await reconcileFocusForSignedInUser();
});

void Notifications.registerTaskAsync(taskName).catch((error) => {
  console.warn("Focus background task registration failed", error);
});
