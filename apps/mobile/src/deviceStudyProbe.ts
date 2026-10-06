import type { InstallGate } from "./useAppUpdate";

export type DeviceSession = { id: string; paused: boolean } | null;
export type DeviceStudyReader = (session: DeviceSession) => Promise<InstallGate>;
type Context = { active: boolean; owner: string | null; ownerRevision?: number; authenticatedOwner: string | null;
  authenticatedOwnerRevision?: number; document: number; nativeDocument: number | null; navigation: number; url: string; cameraPermissionBusy: boolean };
type EventProof = { url: string; isTopFrame?: boolean; sourceOrigin?: string; studySettingsDocumentId?: number };
const origin = "https://study-room-attendance.vercel.app";
let sequence = 0;
function trusted(c: Context) {
  try {
    const url = new URL(c.url);
    return c.active && Boolean(c.owner) && c.owner === c.authenticatedOwner
      && c.ownerRevision !== undefined && c.ownerRevision === c.authenticatedOwnerRevision
      && c.nativeDocument !== null && c.nativeDocument > 0
      && url.origin === origin && url.pathname === "/" && !url.username && !url.password;
  } catch { return false; }
}
function same(a: Context, b: Context) {
  return trusted(b) && a.owner === b.owner && a.ownerRevision === b.ownerRevision && a.document === b.document
    && a.nativeDocument === b.nativeDocument && a.navigation === b.navigation && a.url === b.url;
}
export function createDeviceStudyProbe({ current, inject, timeoutMs = 5000 }: { current: () => Context; inject: (script: string) => void; timeoutMs?: number }) {
  let pending: { requestId: string; context: Context; finish: (state: InstallGate) => void } | null = null;
  const read: DeviceStudyReader = session => {
    const context = { ...current() };
    if (!trusted(context) || pending) return Promise.resolve("unknown");
    if (context.cameraPermissionBusy) return Promise.resolve("studying");
    return new Promise(resolve => {
      const requestId = `device-study-${Date.now()}-${++sequence}`;
      const timer = setTimeout(() => finish("unknown"), timeoutMs);
      const finish = (state: InstallGate) => { clearTimeout(timer); pending = null; resolve(state); };
      pending = { requestId, context, finish };
      const message = JSON.stringify({ type: "STUDY_NATIVE_DEVICE_STUDY_CHECK", requestId, userId: context.owner, session });
      try {
        inject(`if (window.top === window && window.location.href === ${JSON.stringify(context.url)}) { window.dispatchEvent(new CustomEvent("study-room-native-message", { detail: ${message} })); } true;`);
      } catch { finish("unknown"); }
    });
  };
  return { read, invalidate() { pending?.finish("unknown"); }, receive(message: { type: string; requestId?: string; state?: unknown }, proof: EventProof) {
    const p = pending;
    if (!p || message.type !== "STUDY_WEB_DEVICE_STUDY_STATE" || message.requestId !== p.requestId
      || !["allowed", "studying", "unknown"].includes(message.state as string)) return;
    let eventUrl: URL;
    try { eventUrl = new URL(proof.url); } catch { return; }
    if (proof.isTopFrame !== true || (proof.sourceOrigin !== origin && proof.sourceOrigin !== `${origin}/`)
      || proof.studySettingsDocumentId !== p.context.nativeDocument || eventUrl.origin !== origin || eventUrl.pathname !== "/"
      || eventUrl.username || eventUrl.password) return;
    const latest = current();
    p.finish(same(p.context, latest) ? latest.cameraPermissionBusy ? "studying" : message.state as InstallGate : "unknown");
  } };
}
