import type { Session } from "@supabase/supabase-js";

export type CameraWarningResult = {
  ok: boolean;
  slackSent: boolean;
  slackMissing: boolean;
  eventId: string;
  messageTs: string | null;
};

export function sendCameraPresenceWarning(
  session: Session,
  payload: {
    sessionId: string;
    absenceSeconds: number;
    detectedAt: string;
    eventType?: "absence_warning" | "camera_required_warning";
  },
): Promise<CameraWarningResult>;

export function recordCameraPresenceEvent(
  userId: string,
  sessionId: string,
  eventType:
    | "camera_started"
    | "camera_stopped"
    | "absence_warning"
    | "camera_permission_denied"
    | "camera_required_warning",
  options?: {
    absenceSeconds?: number;
    detectedAt?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void>;
