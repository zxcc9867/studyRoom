import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeLearningReflection, type LearningResult } from "./learningContinuity.mjs";

type QueryError = { message?: string; code?: string } | null;
type PageResult = { data: unknown[] | null; error: QueryError };

type RequestOptions = { signal?: AbortSignal; timeoutMs?: number };

export async function runBoundedRequest<T>(
  task: (signal: AbortSignal) => PromiseLike<T>,
  { signal, timeoutMs = 15_000 }: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const timeoutError = Object.assign(new Error("서버 응답을 기다리는 시간이 초과됐습니다."), { name: "RequestTimeoutError" });
  const timer = setTimeout(() => controller.abort(timeoutError), timeoutMs);
  let onAbort: () => void = () => {};
  try {
    // Also settle when auth refresh/transport has not started observing the signal yet.
    const cancelled = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener("abort", onAbort, { once: true });
      if (controller.signal.aborted) onAbort();
    });
    return await Promise.race([
      cancelled,
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return task(controller.signal);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    controller.signal.removeEventListener("abort", onAbort);
    controller.abort();
  }
}

export async function loadDashboardData(client: SupabaseClient, userId: string, options: RequestOptions = {}) {
  return runBoundedRequest(async (signal) => {
    const [profileResult, attendanceResult, sessionData, todoData, sessionTodoLinkData, goalData, recoveryData, latestReflectionResult] = await Promise.all([
      client.from("profiles").select("*").abortSignal(signal).eq("user_id", userId).maybeSingle(),
      client.from("attendance_days").select("*").abortSignal(signal).eq("user_id", userId).order("local_date", { ascending: false }).limit(370),
      fetchAllPages((from, to) => client.from("study_sessions").select("*").abortSignal(signal).eq("user_id", userId).order("started_at", { ascending: false }).range(from, to)),
      fetchAllPages((from, to) => client.from("study_todos").select("*").abortSignal(signal).eq("user_id", userId).order("local_date", { ascending: false }).order("position", { ascending: true }).order("created_at", { ascending: true }).range(from, to)),
      fetchAllPages((from, to) => client.from("study_session_todos").select("*").abortSignal(signal).eq("user_id", userId).order("linked_at", { ascending: false }).range(from, to)),
      fetchAllPages((from, to) => client.from("study_goals").select("*").abortSignal(signal).eq("user_id", userId).order("status", { ascending: true }).order("target_date", { ascending: true }).order("id", { ascending: true }).range(from, to)),
      fetchAllPages((from, to) => client.from("study_recovery_requests").select("id,local_date,covered_start_date,covered_end_date,covered_missed_days,trigger_type,status,reason,makeup_todo_title,pledge_todo_title,created_at").abortSignal(signal).eq("user_id", userId).in("status", ["pending", "submitted"]).order("created_at", { ascending: false }).order("id", { ascending: true }).range(from, to)),
      client.from("study_session_reflections").select("id,session_id,focus_score,energy_score,interruption_reason,note,next_action,created_at").abortSignal(signal).eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    assertQuerySucceeded("프로필", profileResult.error);
    assertQuerySucceeded("출석 기록", attendanceResult.error);
    assertQuerySucceeded("최근 다음 행동", latestReflectionResult.error);

    return {
      profileData: profileResult.data,
      attendanceData: attendanceResult.data ?? [],
      sessionData,
      todoData,
      sessionTodoLinkData,
      goalData,
      recoveryData,
      latestReflectionData: latestReflectionResult.data ?? null,
    };
  }, options);
}

export async function loadReflectionData(client: SupabaseClient, userId: string) {
  return fetchAllPages((from, to) => client
    .from("study_session_reflections")
    .select("id,session_id,focus_score,energy_score,interruption_reason,note,next_action,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to));
}

// Explicit review also finds blank-note rows, intentionally omitted from the result-card snapshot.
// This is read-only; revision acceptance and every write stay in the existing modal/RPC path.
export async function loadLearningReflectionForReview(client: SupabaseClient, userId: string, sessionId: string, signal: AbortSignal): Promise<{ sessionId: string; status: "active" | "completed"; reflection: LearningResult | null }> {
  return runBoundedRequest(async requestSignal => {
    const [reflectionResponse, sessionResponse] = await Promise.all([
      client.from("study_session_reflections").select("id,user_id,session_id,focus_score,energy_score,interruption_reason,note,next_action,context_todo_id,resource_url,resource_position,note_kind,updated_at").eq("user_id", userId).eq("session_id", sessionId).abortSignal(requestSignal).maybeSingle(),
      client.from("study_sessions").select("id,user_id,status,local_date,started_at,ended_at").eq("user_id", userId).eq("id", sessionId).abortSignal(requestSignal).maybeSingle(),
    ]);
    assertQuerySucceeded("최신 회고", reflectionResponse.error);
    assertQuerySucceeded("회고 세션", sessionResponse.error);
    const row = reflectionResponse.data;
    const session = sessionResponse.data;
    if (!session || session.id !== sessionId || session.user_id !== userId || !["active", "completed"].includes(session.status)) throw new Error("최신 회고의 소유자·세션 정보를 확인하지 못했습니다.");
    const status = session.status as "active" | "completed";
    if (!row) return { sessionId, status, reflection: null };
    if (status !== "completed" || row.user_id !== userId || row.session_id !== sessionId || row.note_kind !== "learning_result"
      || typeof row.id !== "string" || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(row.id)
      || ![row.updated_at, session.started_at, session.ended_at].every(value => typeof value === "string" && Number.isFinite(Date.parse(value)))
      || typeof session.local_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(session.local_date)) throw new Error("최신 회고의 소유자·세션 정보를 확인하지 못했습니다.");
    const value = normalizeLearningReflection({ focusScore: row.focus_score, energyScore: row.energy_score, interruptionReason: row.interruption_reason, note: row.note, nextAction: row.next_action, contextTodoId: row.context_todo_id, resourceUrl: row.resource_url, resourcePosition: row.resource_position });
    return { sessionId, status, reflection: { reflectionId: row.id, sessionId, todoId: value.contextTodoId, todoTitle: null, localDate: session.local_date, startedAt: session.started_at, endedAt: session.ended_at, updatedAt: row.updated_at, ...value } };
  }, { signal });
}

export async function loadNotificationDeliveryData(client: SupabaseClient, userId: string) {
  const result = await client
    .from("notification_deliveries")
    .select("channel,status,error_message,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);
  assertQuerySucceeded("알림 진단", result.error);
  return result.data ?? [];
}

async function fetchAllPages(buildPage: (from: number, to: number) => PromiseLike<PageResult>, pageSize = 500) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildPage(from, from + pageSize - 1);
    assertQuerySucceeded("페이지 데이터", error);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function assertQuerySucceeded(label: string, error: QueryError) {
  if (!error) return;
  const detail = error.message ?? error.code ?? "알 수 없는 오류";
  throw new Error(`${label} 조회 실패: ${detail}`);
}
