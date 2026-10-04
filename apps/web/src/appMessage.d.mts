export const SUCCESS_MESSAGE_AUTO_DISMISS_MS: number;

export function shouldAutoDismissMessage(message: unknown): boolean;

export type AppMessageTone = "info" | "success" | "warning" | "danger";
export function getAppMessagePresentation(message: unknown): {
  title: string;
  body: string;
  tone: AppMessageTone;
  role: "status" | "alert";
} | null;
