export const ABSENCE_WARNING_SECONDS: number;
export const WARNING_COOLDOWN_SECONDS: number;

export type PresenceState = {
  absenceStartedAtMs: number | null;
  lastFaceSeenAtMs: number;
  lastWarningAtMs: number | null;
  absenceSeconds: number;
  warningDue: boolean;
};

export type PresenceStatus = "idle" | "starting" | "watching" | "warning" | "error";

export function createPresenceState(nowMs?: number): PresenceState;

export function updatePresenceState(
  state: PresenceState,
  input: {
    faceDetected: boolean;
    nowMs: number;
  },
): PresenceState;

export function markPresenceWarningSent(
  state: PresenceState,
  input: {
    nowMs: number;
  },
): PresenceState;

export function getCameraSupport(env?: typeof globalThis): {
  supported: boolean;
  reason: "supported" | "secure-context-required" | "media-devices-unavailable";
};

export function getPresenceStatusLabel(input: {
  cameraEnabled: boolean;
  status: PresenceStatus;
  absenceSeconds: number;
}): string;
