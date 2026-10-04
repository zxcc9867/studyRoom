export const cameraFrameRecoveryTimeoutMs = 15 * 1000;

const transientFrameReasons = new Set(["no-current-frame", "no-video-size", "track-muted"]);
const endedTrackReasons = new Set(["track-ended", "no-video-track"]);

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
  if (!transientFrameReasons.has(reason) && !endedTrackReasons.has(reason)) {
    return { action: "reset", state: reason === "visible-frame" ? createCameraFrameRecoveryState() : state };
  }

  const loadingStartedAtMs = state.loadingStartedAtMs ?? nowMs;
  if (endedTrackReasons.has(reason)) {
    return state.restartAttempts < maxRestartAttempts
      ? { action: "restart", state: { loadingStartedAtMs: nowMs, restartAttempts: state.restartAttempts + 1 } }
      : { action: "fail", state };
  }
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
