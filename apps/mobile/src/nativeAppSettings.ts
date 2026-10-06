export type SettingsTarget = "update" | "focus" | "permissions";
export type PermissionState = "granted" | "denied" | "unsupported" | "unknown";
export type SettingsSnapshot = {
  versionName: string | null;
  versionCode: number | null;
  updaterStatus: string;
  permissions: { camera: PermissionState; notifications: PermissionState; focus: PermissionState };
};
export type SettingsContext = { active: boolean; owner: string | null; authenticatedOwner: string | null; document: number; url: string;
  ownerRevision?: number; authenticatedOwnerRevision?: number; navigation?: number };
type SettingsRequest = { type: "STUDY_WEB_SETTINGS_INFO"; requestId: string }
  | { type: "STUDY_WEB_OPEN_SETTINGS"; requestId: string; target: SettingsTarget };
function isSettingsUrl(value: string) {
  try { const url = new URL(value); return url.origin === "https://study-room-attendance.vercel.app" && url.pathname === "/" && url.hash === "#settings"; }
  catch { return false; }
}
function validContext(c: SettingsContext) { return c.active && Boolean(c.owner) && c.owner === c.authenticatedOwner
  && c.ownerRevision === c.authenticatedOwnerRevision && isSettingsUrl(c.url); }
export async function handleNativeSettingsRequest(message: SettingsRequest, event: { url: string; isTopFrame?: boolean }, deps: {
  current: () => SettingsContext;
  read: () => Promise<SettingsSnapshot>;
  respond: (message: { type: "STUDY_NATIVE_SETTINGS_INFO"; requestId: string; snapshot: SettingsSnapshot }) => void;
  open: (target: SettingsTarget) => void;
}) {
  const start = deps.current();
  let trusted = false;
  try { const url = new URL(event.url); trusted = url.origin === "https://study-room-attendance.vercel.app" && url.pathname === "/"; } catch { /* Fail closed. */ }
  if (event.isTopFrame !== true || !trusted || !validContext(start)) return;
  if (message.type === "STUDY_WEB_OPEN_SETTINGS") { deps.open(message.target); return; }
  const raw = await deps.read();
  const current = deps.current();
  if (!validContext(current) || current.owner !== start.owner || current.ownerRevision !== start.ownerRevision
    || current.document !== start.document || current.navigation !== start.navigation || current.url !== start.url) return;
  // Explicit projection prevents native metadata, tokens and URLs crossing into the document.
  const snapshot = { versionName: raw.versionName, versionCode: raw.versionCode, updaterStatus: raw.updaterStatus,
    permissions: { camera: raw.permissions.camera, notifications: raw.permissions.notifications, focus: raw.permissions.focus } };
  deps.respond({ type: "STUDY_NATIVE_SETTINGS_INFO", requestId: message.requestId, snapshot });
}
export async function readNativeSettingsSnapshot(deps: {
  version: () => { versionName: string; versionCode: number } | null;
  updaterStatus: string;
  camera: () => Promise<boolean | null>;
  notifications: () => Promise<string>;
  focus: () => { supported: boolean; hasAccess: boolean } | null;
}): Promise<SettingsSnapshot> {
  let versionName: string | null = null, versionCode: number | null = null;
  let camera: PermissionState = "unknown", notifications: PermissionState = "unknown", focus: PermissionState = "unknown";
  try { const v = deps.version(); if (v && typeof v.versionName === "string" && Number.isSafeInteger(v.versionCode) && v.versionCode > 0) { versionName = v.versionName; versionCode = v.versionCode; } } catch { /* No raw errors exposed. */ }
  await Promise.all([
    (async () => { try { const v = await deps.camera(); camera = v === null ? "unsupported" : v ? "granted" : "denied"; } catch { /* Read failure stays unknown. */ } })(),
    (async () => { try { const v = await deps.notifications(); notifications = v === "granted" ? "granted" : v === "denied" || v === "undetermined" ? "denied" : "unknown"; } catch { /* Read failure stays unknown. */ } })(),
  ]);
  try { const v = deps.focus(); focus = !v?.supported ? "unsupported" : v.hasAccess ? "granted" : "denied"; } catch { /* Read failure stays unknown. */ }
  return { versionName, versionCode, updaterStatus: deps.updaterStatus, permissions: { camera, notifications, focus } };
}
