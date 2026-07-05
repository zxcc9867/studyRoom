export type NotificationDiagnosticState = "ready" | "needed" | "blocked" | "checking" | "info";

export type NormalizedNotificationDelivery = {
  channel: string;
  status: "sent" | "failed";
  errorMessage: string;
  createdAt: string | null;
  legacy: boolean;
};

export type NotificationDiagnosticItem = {
  id: string;
  label: string;
  state: NotificationDiagnosticState;
  summary: string;
  detail: string;
};

export function normalizeNotificationDeliveries(rows: unknown[]): NormalizedNotificationDelivery[];
export function buildNotificationDiagnostics(input: {
  webPushStatus: unknown;
  slackStatus: { connected: boolean; channelId: string; updatedAt: string | null } | null;
  deliveries: NormalizedNotificationDelivery[];
}): NotificationDiagnosticItem[];
export function formatDiagnosticTime(value: string | null): string;
