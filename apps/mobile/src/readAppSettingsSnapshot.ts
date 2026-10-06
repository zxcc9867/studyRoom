import { PermissionsAndroid, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import nativeUpdate from "../modules/my-module/src/StudyAppUpdateModule";
import { getLocalFocusStatus } from "./focus";
import { readNativeSettingsSnapshot } from "./nativeAppSettings";

export function readAppSettingsSnapshot(updaterStatus: string) {
  return readNativeSettingsSnapshot({
    version: () => nativeUpdate?.getInstalledVersion() ?? null,
    updaterStatus,
    camera: () => Platform.OS === "android" ? PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA) : Promise.resolve(null),
    notifications: async () => (await Notifications.getPermissionsAsync()).status,
    focus: getLocalFocusStatus,
  });
}
