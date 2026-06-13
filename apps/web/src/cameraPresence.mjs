export const ABSENCE_WARNING_SECONDS = 5 * 60;
export const ABSENCE_AUTO_END_SECONDS = 10 * 60;
export const WARNING_COOLDOWN_SECONDS = 10 * 60;

const absenceWarningMs = ABSENCE_WARNING_SECONDS * 1000;
const warningCooldownMs = WARNING_COOLDOWN_SECONDS * 1000;

export function createPresenceState(nowMs = Date.now()) {
  return {
    absenceStartedAtMs: null,
    lastFaceSeenAtMs: nowMs,
    lastWarningAtMs: null,
    absenceSeconds: 0,
    excludedSeconds: 0,
    timerPaused: false,
    autoEndDue: false,
    warningDue: false,
  };
}

export function updatePresenceState(state, { faceDetected, nowMs }) {
  if (faceDetected) {
    const completedExcludedSeconds =
      state.absenceSeconds >= ABSENCE_WARNING_SECONDS ? state.excludedSeconds + state.absenceSeconds : state.excludedSeconds;

    return {
      ...state,
      absenceStartedAtMs: null,
      lastFaceSeenAtMs: nowMs,
      absenceSeconds: 0,
      excludedSeconds: completedExcludedSeconds,
      timerPaused: false,
      autoEndDue: false,
      warningDue: false,
    };
  }

  const absenceStartedAtMs = state.absenceStartedAtMs ?? nowMs;
  const absenceSeconds = Math.max(0, Math.floor((nowMs - absenceStartedAtMs) / 1000));
  const cooldownElapsed = !state.lastWarningAtMs || nowMs - state.lastWarningAtMs >= warningCooldownMs;

  return {
    ...state,
    absenceStartedAtMs,
    absenceSeconds,
    timerPaused: absenceSeconds >= ABSENCE_WARNING_SECONDS,
    autoEndDue: absenceSeconds >= ABSENCE_AUTO_END_SECONDS,
    warningDue: absenceSeconds >= ABSENCE_WARNING_SECONDS && cooldownElapsed,
  };
}

export function markPresenceWarningSent(state, { nowMs }) {
  return {
    ...state,
    lastWarningAtMs: nowMs,
    warningDue: false,
  };
}

export function getCurrentExcludedSeconds(state) {
  const liveExcludedSeconds = state.absenceSeconds >= ABSENCE_WARNING_SECONDS ? state.absenceSeconds : 0;
  return Math.max(0, (state.excludedSeconds ?? 0) + liveExcludedSeconds);
}

export function getActiveStudySeconds({ startedAtMs, nowMs, excludedSeconds = 0 }) {
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  return Math.max(0, elapsedSeconds - Math.max(0, Math.floor(excludedSeconds)));
}

export function canStartStudySessionWithCamera({ activeSession, cameraEnabled, cameraRequired = true }) {
  if (activeSession) {
    return { allowed: false, reason: "active-session" };
  }

  if (cameraRequired && !cameraEnabled) {
    return { allowed: false, reason: "camera-required" };
  }

  return { allowed: true, reason: "ready" };
}

export function getCameraSupport(env = globalThis) {
  if (!env.isSecureContext) {
    return { supported: false, reason: "secure-context-required" };
  }

  if (!env.navigator?.mediaDevices?.getUserMedia) {
    return { supported: false, reason: "media-devices-unavailable" };
  }

  return { supported: true, reason: "supported" };
}

export function getPresenceStatusLabel({ cameraEnabled, status, absenceSeconds }) {
  if (!cameraEnabled) return "꺼짐";
  if (status === "starting") return "준비 중";
  if (absenceSeconds >= ABSENCE_AUTO_END_SECONDS) return "자동 종료 중";
  if (absenceSeconds >= ABSENCE_WARNING_SECONDS) return `자동 일시정지 · 얼굴 미감지 ${Math.floor(absenceSeconds / 60)}분`;
  if (status === "warning") return "자리 비움 경고";
  if (status === "error") return "오류";
  if (absenceSeconds > 0) return `얼굴 미감지 ${Math.floor(absenceSeconds / 60)}분`;
  return "감시 중";
}
