import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerExpoPushTarget(userId: string) {
  if (!Device.isDevice) {
    throw new Error("Push notifications require a physical device");
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission =
    existing.status === "granted" ? existing : await Notifications.requestPermissionsAsync();

  if (permission.status !== "granted") {
    throw new Error("Notification permission was not granted");
  }

  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

  if (!projectId) {
    throw new Error("EXPO_PUBLIC_EAS_PROJECT_ID is required for push tokens");
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });

  const { error } = await supabase.from("notification_targets").upsert(
    {
      user_id: userId,
      kind: "expo",
      destination: token.data,
      enabled: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,kind,target_key" },
  );

  if (error) {
    throw error;
  }

  return token.data;
}
