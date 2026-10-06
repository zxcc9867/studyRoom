export const studyWebOrigin = "https://study-room-attendance.vercel.app";

export type MobileWebTicket = { requestId: string; userId: string; tokenHash: string };

type NativeClient = {
  auth: {
    getSession: () => Promise<{ data: { session: { user: { id: string } } | null }; error: unknown }>;
    getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  };
  functions: {
    invoke: (name: string, options: { body: Record<string, never> }) => Promise<{ data: unknown; error: unknown }>;
  };
};

export async function requestMobileWebTicket(client: NativeClient, expectedUserId: string) {
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError || sessionData.session?.user.id !== expectedUserId) throw new Error("Account changed");
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || userData.user?.id !== expectedUserId) throw new Error("Account changed");

  const { data, error } = await client.functions.invoke("mobile-web-auth", { body: {} });
  if (error || !data || typeof data !== "object") throw new Error("Ticket unavailable");
  const ticket = data as Record<string, unknown>;
  if (ticket.user_id !== expectedUserId) throw new Error("Account mismatch");
  if (ticket.verification_type !== "magiclink" || typeof ticket.token_hash !== "string" || !ticket.token_hash) {
    throw new Error("Ticket unavailable");
  }
  return { tokenHash: ticket.token_hash, userId: expectedUserId };
}

export function isTrustedWebUrl(value: string) {
  try {
    const url = new URL(value);
    return url.origin === studyWebOrigin && url.protocol === "https:" && url.pathname === "/";
  } catch {
    return false;
  }
}

export function buildTicketInjection(ticket: MobileWebTicket) {
  const message = JSON.stringify({
    type: "STUDY_WEB_AUTH_TICKET",
    requestId: ticket.requestId,
    userId: ticket.userId,
    tokenHash: ticket.tokenHash,
  });
  return `window.dispatchEvent(new CustomEvent("study-room-native-message", { detail: ${message} })); true;`;
}

export type NativeBridgeMessage =
  | { type: "STUDY_WEB_DEVICE_STUDY_STATE"; requestId: string; state: "allowed" | "studying" | "unknown" }
  | { type: "STUDY_WEB_SETTINGS_INFO"; requestId: string }
  | { type: "STUDY_WEB_OPEN_SETTINGS"; requestId: string; target: "update" | "focus" | "permissions" }
  | { type: "STUDY_WEB_CAMERA_PERMISSION"; requestId: string }
  | { type: "STUDY_WEB_CAMERA_PERMISSION_CHECK"; requestId: string }
  | { type: "STUDY_WEB_OPEN_APP_SETTINGS"; requestId: string }
  | { type: "STUDY_WEB_READY"; requestId: string }
  | { type: "STUDY_WEB_AUTH_OK"; requestId: string; userId: string }
  | { type: "STUDY_WEB_AUTH_FAILED"; requestId: string }
  | { type: "STUDY_WEB_SIGN_OUT" }
  | { type: "STUDY_WEB_STUDY_STATE_CHANGED" };

export function parseNativeBridgeMessage(raw: string): NativeBridgeMessage | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object") return null;
  const message = value as Record<string, unknown>;
  const validId = (id: unknown) => typeof id === "string" && id.length > 0 && id.length <= 128;
  if (message.type === "STUDY_WEB_DEVICE_STUDY_STATE" && validId(message.requestId) && Object.keys(message).length === 3
    && ["allowed", "studying", "unknown"].includes(message.state as string)) {
    return { type: message.type, requestId: message.requestId as string, state: message.state as "allowed" | "studying" | "unknown" };
  }
  if (message.type === "STUDY_WEB_SETTINGS_INFO" && validId(message.requestId) && Object.keys(message).length === 2) {
    return { type: message.type, requestId: message.requestId as string };
  }
  if (message.type === "STUDY_WEB_OPEN_SETTINGS" && validId(message.requestId) && Object.keys(message).length === 3
    && ["update", "focus", "permissions"].includes(message.target as string)) {
    return { type: message.type, requestId: message.requestId as string, target: message.target as "update" | "focus" | "permissions" };
  }
  if (["STUDY_WEB_CAMERA_PERMISSION", "STUDY_WEB_CAMERA_PERMISSION_CHECK", "STUDY_WEB_OPEN_APP_SETTINGS"].includes(message.type as string)
    && validId(message.requestId) && Object.keys(message).length === 2) {
    return { type: message.type as "STUDY_WEB_CAMERA_PERMISSION" | "STUDY_WEB_CAMERA_PERMISSION_CHECK" | "STUDY_WEB_OPEN_APP_SETTINGS", requestId: message.requestId as string };
  }
  if (message.type === "STUDY_WEB_READY" && validId(message.requestId)) {
    return { type: message.type, requestId: message.requestId as string };
  }
  if (message.type === "STUDY_WEB_AUTH_OK" && validId(message.requestId) && validId(message.userId)) {
    return { type: message.type, requestId: message.requestId as string, userId: message.userId as string };
  }
  if (message.type === "STUDY_WEB_AUTH_FAILED" && validId(message.requestId)) {
    return { type: message.type, requestId: message.requestId as string };
  }
  if (message.type === "STUDY_WEB_SIGN_OUT" && Object.keys(message).length === 1) {
    return { type: message.type };
  }
  if (message.type === "STUDY_WEB_STUDY_STATE_CHANGED" && Object.keys(message).length === 1) {
    return { type: message.type };
  }
  return null;
}

export function buildCameraPermissionInjection(requestId: string, status: string) {
  const message = JSON.stringify({ type: "STUDY_NATIVE_CAMERA_PERMISSION", requestId, status });
  return `window.dispatchEvent(new CustomEvent("study-room-native-message", { detail: ${message} })); true;`;
}
