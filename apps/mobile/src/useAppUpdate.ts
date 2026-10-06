import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import native, { type NativeUpdateState } from "../modules/my-module/src/StudyAppUpdateModule";
import { getUpdateErrorMessage, isNewerRelease, validateAndroidRelease, type AndroidRelease, type InstalledVersion } from "./appUpdate";

export type InstallGate = "allowed" | "studying" | "unknown";
type Status = "idle" | "checking" | "latest" | "available" | "downloading" | "verifying" | "ready" | "cancelled" | "failed" | "permission_required" | "install_pending" | "installed";
type State = { supported: boolean; current: InstalledVersion | null; release: AndroidRelease | null; status: Status; error: string; progress: number; isOpen: boolean; busy: boolean };
export type AppUpdateController = State & { open(): void; close(): void; check(): Promise<void>; download(): Promise<void>; cancel(): void; install(): Promise<void>; settings(): void };

export function useAppUpdate(beforeInstall: () => Promise<InstallGate>): AppUpdateController {
  const [state, setState] = useState<State>({ supported: false, current: null, release: null, status: "idle", error: "", progress: 0, isOpen: false, busy: false });
  const stateRef = useRef(state);
  const mounted = useRef(false);
  const operation = useRef(0);
  const locked = useRef(false);
  const gate = useRef(beforeInstall); gate.current = beforeInstall;
  function update(patch: Partial<State>) {
    if (!mounted.current) return;
    stateRef.current = { ...stateRef.current, ...patch }; setState(stateRef.current);
  }
  function readCurrent() {
    const current = native?.getInstalledVersion() ?? null;
    update({ current, supported: Boolean(current?.supported) });
    return current;
  }
  function applyNative(s: NativeUpdateState) {
    const previous = stateRef.current;
    const current = readCurrent();
    const r = s.release ? validateAndroidRelease(s.release) : stateRef.current.release;
    const completed = Boolean(r && current?.supported && current.packageName === r.packageName && current.versionCode >= r.versionCode);
    // Native idle means no download, not that the validated release offer or JS check disappeared.
    if (s.phase === "idle" && !completed) {
      if (locked.current || previous.status === "failed" || previous.status === "cancelled") return;
      update({ release: r, status: r && current ? isNewerRelease(r, current) ? "available" : "latest" : "idle", busy: false });
      return;
    }
    const phase = s.phase === "installed" && !completed ? "ready" : s.phase;
    update({ release: r, status: completed ? "installed" : locked.current && previous.status === "checking" && phase === "ready" ? "checking" : phase,
      progress: s.totalBytes > 0 ? Math.min(100, Math.max(0, Math.round(s.downloadedBytes / s.totalBytes * 100))) : 0,
      error: s.phase === "failed" ? getUpdateErrorMessage({ code: s.errorCode }) : "",
      busy: locked.current || phase === "downloading" || phase === "verifying" });
  }
  async function check() {
    if (!native || locked.current || stateRef.current.busy || stateRef.current.status === "install_pending") return;
    locked.current = true;
    const id = ++operation.current;
    update({ status: "checking", busy: true, error: "" });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const latest = await Promise.race([native.fetchLatestRelease(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("CHECK_TIMEOUT")), 12000); })]);
      if (!mounted.current || id !== operation.current) return;
      const r = validateAndroidRelease(latest), current = readCurrent();
      update({ release: r, status: current && isNewerRelease(r, current) ? "available" : "latest", progress: 0 });
    } catch (error) { if (id === operation.current) update({ status: "failed", error: getUpdateErrorMessage(error) }); }
    finally { if (timer !== undefined) clearTimeout(timer); if (id === operation.current) { locked.current = false; update({ busy: false }); } }
  }
  async function download() {
    if (!native || locked.current || stateRef.current.busy || !stateRef.current.release || !stateRef.current.current || !isNewerRelease(stateRef.current.release, stateRef.current.current)) return;
    if (!["available", "cancelled", "failed"].includes(stateRef.current.status)) return;
    locked.current = true;
    const id = ++operation.current;
    update({ status: "downloading", busy: true, error: "", progress: 0 });
    try { const result = await native.downloadRelease(stateRef.current.release); if (mounted.current && id === operation.current) applyNative(result); }
    catch (error) { if (id === operation.current) update({ status: "failed", error: getUpdateErrorMessage(error) }); }
    finally { if (id === operation.current) { locked.current = false; update({ busy: false }); } }
  }
  function cancel() {
    if (!native || !["downloading", "verifying"].includes(stateRef.current.status)) return;
    ++operation.current; locked.current = false;
    try { applyNative(native.cancelDownload()); } catch (error) { update({ status: "failed", busy: false, error: getUpdateErrorMessage(error) }); }
  }
  async function install() {
    if (!native || locked.current || stateRef.current.busy || !["ready", "permission_required"].includes(stateRef.current.status)) return;
    locked.current = true; const id = ++operation.current; update({ busy: true, error: "" });
    try {
      let allowed: InstallGate = "unknown";
      try { allowed = await gate.current(); } catch { /* A failed read must never grant installation. */ }
      if (!mounted.current || id !== operation.current) return;
      if (AppState.currentState !== "active") allowed = "unknown";
      if (allowed !== "allowed") { update({ error: allowed === "studying" ? "이 휴대폰에서 공부 중에는 설치를 미뤄요. 먼저 휴대폰의 휴식 또는 종료 버튼을 사용한 뒤 다시 설치해 주세요." : "이 휴대폰의 공부 상태를 확인하지 못했어요. 공부방 연결을 확인한 뒤 다시 설치해 주세요." }); return; }
      if (!native.canInstall()) { update({ status: "permission_required" }); return; }
      const result = await native.installDownloaded();
      if (mounted.current && id === operation.current) applyNative(result);
    } catch (error) { if (id === operation.current) update({ status: "failed", error: getUpdateErrorMessage(error) }); }
    finally { if (id === operation.current) { locked.current = false; update({ busy: false }); } }
  }
  function settings() {
    if (!native || locked.current || stateRef.current.status !== "permission_required" || AppState.currentState !== "active") return;
    try { native.openInstallPermissionSettings(); } catch (error) { update({ error: getUpdateErrorMessage(error) }); }
  }
  useEffect(() => {
    mounted.current = true;
    if (!native) return () => { mounted.current = false; ++operation.current; };
    const adapter = native;
    let event: { remove(): void } | undefined, foreground: { remove(): void } | undefined;
    try {
      const current = readCurrent();
      if (current?.supported) {
        const saved = native.getState();
        applyNative(saved);
        event = native.addListener("onUpdateState", s => { try { applyNative(s); } catch (error) { update({ status: "failed", error: getUpdateErrorMessage(error), busy: false }); } });
        foreground = AppState.addEventListener("change", status => {
          if (status === "active") { try { applyNative(adapter.getState()); } catch (error) { update({ error: getUpdateErrorMessage(error) }); } }
        });
        if (saved.phase === "idle" || saved.phase === "cancelled" || saved.phase === "failed") void check();
      }
    } catch (error) { update({ status: "failed", error: getUpdateErrorMessage(error) }); }
    return () => { mounted.current = false; ++operation.current; locked.current = false; event?.remove(); foreground?.remove(); };
  }, []);
  return { ...state, open: () => update({ isOpen: true }), close: () => update({ isOpen: false }), check, download, cancel, install, settings };
}
