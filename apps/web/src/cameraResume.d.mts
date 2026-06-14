export const cameraMonitoringIntentMaxAgeMs: number;

export type CameraMonitoringIntent = {
  userId: string;
  sessionId: string;
  savedAtMs: number;
};

export function cameraMonitoringIntentKey(userId: string): string;

export function createCameraMonitoringIntent(input: {
  userId: string;
  sessionId: string;
  savedAtMs?: number;
}): CameraMonitoringIntent;

export function parseCameraMonitoringIntent(value: string | null | undefined): CameraMonitoringIntent | null;

export function shouldRestoreCameraMonitoring(input: {
  intent: CameraMonitoringIntent | null;
  userId: string;
  activeSessionId: string;
  nowMs?: number;
  maxAgeMs?: number;
}): boolean;
