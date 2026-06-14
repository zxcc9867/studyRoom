export const cameraMonitoringIntentMaxAgeMs = 15 * 60 * 1000;

export function cameraMonitoringIntentKey(userId) {
  return `study-room-camera-monitoring-intent:${String(userId ?? "").trim()}`;
}

export function createCameraMonitoringIntent({ userId, sessionId, savedAtMs = Date.now() }) {
  return {
    userId: String(userId ?? ""),
    sessionId: String(sessionId ?? ""),
    savedAtMs: Number(savedAtMs),
  };
}

export function parseCameraMonitoringIntent(value) {
  try {
    const parsed = JSON.parse(String(value ?? ""));
    if (
      !parsed ||
      typeof parsed.userId !== "string" ||
      typeof parsed.sessionId !== "string" ||
      !Number.isFinite(Number(parsed.savedAtMs))
    ) {
      return null;
    }

    return {
      userId: parsed.userId,
      sessionId: parsed.sessionId,
      savedAtMs: Number(parsed.savedAtMs),
    };
  } catch {
    return null;
  }
}

export function shouldRestoreCameraMonitoring({
  intent,
  userId,
  activeSessionId,
  nowMs = Date.now(),
  maxAgeMs = cameraMonitoringIntentMaxAgeMs,
}) {
  if (!intent || !userId || !activeSessionId) {
    return false;
  }

  return (
    intent.userId === userId &&
    intent.sessionId === activeSessionId &&
    Number.isFinite(intent.savedAtMs) &&
    nowMs - intent.savedAtMs >= 0 &&
    nowMs - intent.savedAtMs <= maxAgeMs
  );
}
