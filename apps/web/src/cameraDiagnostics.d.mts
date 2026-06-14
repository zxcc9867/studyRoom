import type { PresenceStatus } from "./cameraPresence.mjs";
import type { CameraHealth } from "./cameraVideoHealth.mjs";

export type CameraDiagnosticTone = "idle" | "loading" | "notice" | "ok" | "warning" | "error";

export type CameraDiagnostic = {
  tone: CameraDiagnosticTone;
  title: string;
  detail: string;
  checks: string[];
};

export type CameraDiagnosticInput = {
  activeSession: boolean;
  cameraEnabled: boolean;
  cameraStatus: PresenceStatus;
  supportReason?: "supported" | "secure-context-required" | "media-devices-unavailable" | null;
  healthReason?: CameraHealth["reason"] | "permission-denied" | "unknown-error" | null;
  absenceSeconds?: number;
  timerPaused?: boolean;
};

export function getCameraDiagnostic(input: CameraDiagnosticInput): CameraDiagnostic;
