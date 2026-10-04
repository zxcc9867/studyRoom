import type { FocusSnapshot } from "./focus";

export type LocalFocusStatus = { supported: boolean; hasAccess: boolean; active: boolean };
export type FocusAction = "connecting" | "checking" | "disconnecting" | null;
export type FocusDisplay = {
  kind: "idle" | "active" | "warning" | "checking";
  label: string;
  description: string;
};

export function getFocusDisplay({ snapshot, local, error, action, paused, nowMs }: {
  snapshot: FocusSnapshot | null;
  local: LocalFocusStatus | null;
  error: string;
  action: FocusAction;
  paused: boolean;
  nowMs: number;
}): FocusDisplay {
  if (action) return { kind: "checking", label: action === "connecting" ? "휴대폰 연결 중" : action === "disconnecting" ? "연결 해제 중" : "적용 상태 확인 중", description: "Android 상태를 확인하고 있어요." };
  if (error) return { kind: "warning", label: "적용 확인 필요", description: "집중 설정에서 오류를 확인하고 다시 시도해 주세요." };
  if (!local?.supported) return { kind: "warning", label: "지원 여부 확인 필요", description: "Android 15 이상 전용 APK에서 사용할 수 있어요." };
  if (!snapshot?.device_connected) return { kind: "idle", label: "미연결", description: "휴대폰을 연결하면 공부 시작·휴식에 맞춰 방해금지가 바뀌어요." };
  if (!snapshot.opted_in || !local.hasAccess || !snapshot.permission_granted) return { kind: "warning", label: "방해금지 권한 확인 필요", description: "Android 설정에서 독서실의 방해금지 접근을 확인해 주세요." };
  if (snapshot.last_error) return { kind: "warning", label: "적용 확인 필요", description: snapshot.last_error };
  if (snapshot.applied_revision !== snapshot.revision) return { kind: "checking", label: "휴대폰 적용 확인 중", description: "공부 상태 변경을 휴대폰에 반영하고 있어요." };
  const acknowledgedAt = snapshot.last_ack_at ? Date.parse(snapshot.last_ack_at) : NaN;
  if (!Number.isFinite(acknowledgedAt) || nowMs - acknowledgedAt > 5 * 60 * 1000 || acknowledgedAt - nowMs > 30 * 1000) {
    return { kind: "warning", label: "최근 적용 확인 필요", description: "마지막 확인이 오래됐어요. 현재 켜짐을 보장할 수 없어요." };
  }
  const desired = snapshot.desired_focus && Boolean(snapshot.lease_expires_at && Date.parse(snapshot.lease_expires_at) > nowMs);
  if (snapshot.applied_focus !== desired || local.active !== desired) return { kind: "warning", label: "방해금지 상태 불일치", description: "공부 상태와 Android 규칙이 달라요. 상태를 다시 확인해 주세요." };
  return desired
    ? { kind: "active", label: "방해금지 켜짐", description: "독서실 공부 집중 규칙의 켜짐을 확인했어요." }
    : { kind: "idle", label: paused ? "휴식 중 · 독서실 방해금지 꺼짐" : "연결됨 · 공부 시작 대기", description: "독서실 규칙은 꺼져 있어요. 수동으로 켠 다른 모드는 유지돼요." };
}
