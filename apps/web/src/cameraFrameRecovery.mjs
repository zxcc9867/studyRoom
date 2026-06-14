export const cameraFrameRecoveryTimeoutMs = 15 * 1000;

const transientFrameReasons = new Set(["no-current-frame", "no-video-size"]);

export function createCameraFrameRecoveryState() {
  return {
    loadingStartedAtMs: null,
    restartAttempts: 0,
  };
}

export function updateCameraFrameRecoveryState(
  state,
  {
    reason,
    nowMs,
    timeoutMs = cameraFrameRecoveryTimeoutMs,
    maxRestartAttempts = 1,
  },
) {
  if (!transientFrameReasons.has(reason)) {
    return { action: "reset", state: createCameraFrameRecoveryState() };
  }

  const loadingStartedAtMs = state.loadingStartedAtMs ?? nowMs;
  const elapsedMs = nowMs - loadingStartedAtMs;
  if (elapsedMs < timeoutMs) {
    return {
      action: "wait",
      state: {
        ...state,
        loadingStartedAtMs,
      },
    };
  }

  if (state.restartAttempts < maxRestartAttempts) {
    return {
      action: "restart",
      state: {
        loadingStartedAtMs: nowMs,
        restartAttempts: state.restartAttempts + 1,
      },
    };
  }

  return {
    action: "fail",
    state: {
      ...state,
      loadingStartedAtMs,
    },
  };
}
