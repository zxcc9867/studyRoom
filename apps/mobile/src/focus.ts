import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

import FocusMode from "../modules/my-module/src/StudyFocusModeModule";
import { registerExpoPushTarget } from "./notifications";
import { supabase } from "./supabase";

const ownerKey = "study-focus-owner";
const installationKey = "study-focus-installation";

function nativeFocusMode() {
  if (!FocusMode) throw new Error("Android 집중 모드 APK에서만 사용할 수 있습니다.");
  return FocusMode;
}

export type FocusSnapshot = {
  revision: number;
  desired_focus: boolean;
  lease_expires_at: string | null;
  device_connected: boolean;
  installation_id: string | null;
  opted_in: boolean;
  permission_granted: boolean;
  applied_revision: number | null;
  applied_focus: boolean | null;
  last_ack_at: string | null;
  last_error: string | null;
};

async function installationId() {
  const saved = await AsyncStorage.getItem(installationKey);
  if (saved) return saved;
  const id = Crypto.randomUUID();
  await AsyncStorage.setItem(installationKey, id);
  return id;
}

export function getLocalFocusStatus() {
  return FocusMode?.getStatus() ?? { supported: false, hasAccess: false, active: false };
}

export function openFocusPolicySettings() {
  nativeFocusMode().openPolicySettings();
}

export async function connectStudyFocus(userId: string) {
  const status = nativeFocusMode().getStatus();
  if (!status.supported) throw new Error("Android 15 이상에서 사용할 수 있습니다.");
  if (!status.hasAccess) throw new Error("방해금지 정책 접근 권한을 먼저 허용해 주세요.");
  const pushToken = await registerExpoPushTarget(userId);
  const id = await installationId();
  const { error } = await supabase.rpc("register_study_focus_device", {
    p_installation_id: id,
    p_expo_push_token: pushToken,
    p_opted_in: true,
    p_permission_granted: true,
  });
  if (error) throw error;
  await AsyncStorage.setItem(ownerKey, userId);
  return reconcileStudyFocus(userId);
}

async function readSnapshot(): Promise<FocusSnapshot> {
  const { data, error } = await supabase.rpc("get_study_focus_snapshot");
  if (error) throw error;
  if (!data) throw new Error("집중 모드 상태를 확인하지 못했습니다.");
  return data as FocusSnapshot;
}

export async function reconcileStudyFocus(userId: string): Promise<FocusSnapshot | null> {
  const owner = await AsyncStorage.getItem(ownerKey);
  if (owner !== userId) {
    // A different account can never inherit this installation's active rule.
    if (owner) {
      try { nativeFocusMode().setOwnRule(false, 0); } catch { /* Permission may have been revoked. */ }
      await AsyncStorage.removeItem(ownerKey);
    }
    return null;
  }
  const id = await installationId();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const snapshot = await readSnapshot();
    if (!snapshot.device_connected || snapshot.installation_id !== id || !snapshot.opted_in) {
      nativeFocusMode().setOwnRule(false, 0);
      await AsyncStorage.removeItem(ownerKey);
      return snapshot;
    }
    const permission = nativeFocusMode().getStatus();
    let applied = false;
    let failure: string | null = null;
    try {
      if (!permission.hasAccess) throw new Error("방해금지 정책 접근 권한이 해제되었습니다.");
      const lease = snapshot.lease_expires_at ? Date.parse(snapshot.lease_expires_at) : 0;
      const desired = snapshot.desired_focus && lease > Date.now();
      nativeFocusMode().setOwnRule(desired, desired ? lease : 0);
      await new Promise((resolve) => setTimeout(resolve, 350));
      applied = nativeFocusMode().getStatus().active;
      if (applied !== desired) throw new Error("Android에서 방해금지 적용을 확인하지 못했습니다.");
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      applied = nativeFocusMode().getStatus().active;
    }
    const { data: accepted, error: ackError } = await supabase.rpc("ack_study_focus_device", {
      p_installation_id: id,
      p_revision: snapshot.revision,
      p_applied_focus: applied,
      p_permission_granted: permission.hasAccess,
      p_error: failure,
    });
    if (ackError) throw ackError;
    if (accepted) return { ...snapshot, applied_focus: applied, applied_revision: snapshot.revision, last_error: failure };
  }
  throw new Error("공부 상태가 바뀌었습니다. 다시 동기화해 주세요.");
}

export async function reconcileFocusForSignedInUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await reconcileStudyFocus(user.id);
}

export async function disconnectStudyFocus(userId: string) {
  nativeFocusMode().setOwnRule(false, 0);
  await new Promise((resolve) => setTimeout(resolve, 350));
  if (nativeFocusMode().getStatus().active) {
    throw new Error("Android에서 방해금지 해제를 확인하지 못했습니다. 설정에서 직접 확인해 주세요.");
  }
  const owner = await AsyncStorage.getItem(ownerKey);
  if (owner === userId) {
    const { error } = await supabase.rpc("unregister_study_focus_device", {
      p_installation_id: await installationId(),
    });
    if (error) throw error;
    await AsyncStorage.removeItem(ownerKey);
  }
}
