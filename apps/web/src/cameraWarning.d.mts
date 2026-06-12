import type { Session } from "@supabase/supabase-js";

export type CameraWarningResult = {
  ok: boolean;
  telegramSent: boolean;
  telegramMissing: boolean;
  eventId: string;
  messageId: number | null;
};

export function sendCameraPresenceWarning(
  session: Session,
  payload: {
    sessionId: string;
    absenceSeconds: number;
    detectedAt: string;
  },
): Promise<CameraWarningResult>;

export function recordCameraPresenceEvent(
  userId: string,
  sessionId: string,
  eventType: "camera_started" | "camera_stopped" | "absence_warning" | "camera_permission_denied",
  options?: {
    absenceSeconds?: number;
    detectedAt?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void>;
