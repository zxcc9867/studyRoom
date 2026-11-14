import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadLearningContinuity, type LearningContinuitySnapshot } from "./learningContinuity.mjs";

export function learningErrorMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "55P03") return "다른 저장과 겹쳤어요. 현재 상태를 다시 확인한 뒤 직접 재시도해 주세요. 초안은 보존했어요.";
  if (code === "40001") return "다른 곳에서 수정된 기록이에요. 초안을 보존했어요. 최신 기록을 다시 확인해 주세요.";
  return "저장을 확인하지 못했어요. 초안은 보존했으며 서버 상태를 다시 확인합니다. 확인 후 직접 재시도해 주세요.";
}

// This hook owns requests only. Study, camera and account lifecycle remain in DashboardApp.
export function useLearningContinuity(client: SupabaseClient, userId: string | null, studyDate: string, ready: boolean, beginWrite: () => () => void) {
  const key = `${userId ?? ""}:${studyDate}`;
  const identity = useRef(key);
  identity.current = key;
  const owner = useRef(userId);
  owner.current = userId;
  const beginWriteRef = useRef(beginWrite);
  beginWriteRef.current = beginWrite;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; supported: boolean; status: "loading" | "ready" | "error" | "unsupported"; data: LearningContinuitySnapshot | null }>({ key, supported: false, status: "loading", data: null });
  const [busy, setBusy] = useState(false);
  const mutation = useRef<AbortController | null>(null);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!userId || !ready) return;
    const controller = new AbortController();
    setState(old => ({ key, supported: old.key === key && old.supported, status: "loading", data: old.key === key ? old.data : null }));
    void loadLearningContinuity(client, studyDate, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted && identity.current === key) setState({ key, status: "ready", supported: true, data });
    }).catch(error => {
      if (controller.signal.aborted || identity.current !== key) return;
      const missing = ["42883", "PGRST202"].includes(error?.code);
      setState(old => ({ ...old, key, supported: missing ? false : old.supported, status: missing ? "unsupported" : "error" }));
    });
    return () => controller.abort();
  }, [client, userId, studyDate, ready, revision, key]);
  useEffect(() => {
    setBusy(false);
    return () => { mutation.current?.abort(); mutation.current = null; };
  }, [userId]);
  async function runRequest<T>(work: (signal: AbortSignal) => Promise<T>, writing: boolean): Promise<T> {
    if (!userId || owner.current !== userId || mutation.current) throw new Error("Learning request unavailable");
    const controller = new AbortController();
    mutation.current = controller;
    const release = writing ? beginWriteRef.current() : () => {};
    setBusy(true);
    try {
      const data = await work(controller.signal);
      if (owner.current !== userId || controller.signal.aborted) throw new DOMException("Stale learning request", "AbortError");
      if (writing) refresh();
      return data;
    } finally {
      release();
      if (mutation.current === controller) { mutation.current = null; setBusy(false); }
    }
  }
  const current = state.key === key ? state : { key, supported: false, status: "loading" as const, data: null };
  return { ...current, busy, refresh, mutate: <T,>(work: (signal: AbortSignal) => Promise<T>) => runRequest(work, true), review: <T,>(work: (signal: AbortSignal) => Promise<T>) => runRequest(work, false) };
}
