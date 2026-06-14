export const cameraFrameRecoveryTimeoutMs: number;

export type CameraFrameRecoveryAction = "wait" | "restart" | "fail" | "reset";

export type CameraFrameRecoveryState = {
  loadingStartedAtMs: number | null;
  restartAttempts: number;
};

export function createCameraFrameRecoveryState(): CameraFrameRecoveryState;

export function updateCameraFrameRecoveryState(
  state: CameraFrameRecoveryState,
  input: {
    reason: string;
    nowMs: number;
    timeoutMs?: number;
    maxRestartAttempts?: number;
  },
): {
  action: CameraFrameRecoveryAction;
  state: CameraFrameRecoveryState;
};
