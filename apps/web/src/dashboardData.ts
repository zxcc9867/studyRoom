import type { SupabaseClient } from "@supabase/supabase-js";

type QueryError = { message?: string; code?: string } | null;
type PageResult = { data: unknown[] | null; error: QueryError };

export async function loadDashboardData(client: SupabaseClient, userId: string) {
  const [profileResult, attendanceResult, sessionData, todoData, sessionTodoLinkData, goalResult, recoveryResult] = await Promise.all([
    client.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    client.from("attendance_days").select("*").eq("user_id", userId).order("local_date", { ascending: false }).limit(370),
    fetchAllPages((from, to) => client.from("study_sessions").select("*").eq("user_id", userId).order("started_at", { ascending: false }).range(from, to)),
    fetchAllPages((from, to) => client.from("study_todos").select("*").eq("user_id", userId).order("local_date", { ascending: false }).order("position", { ascending: true }).order("created_at", { ascending: true }).range(from, to)),
    fetchAllPages((from, to) => client.from("study_session_todos").select("*").eq("user_id", userId).order("linked_at", { ascending: false }).range(from, to)),
    client.from("study_goals").select("*").eq("user_id", userId).order("status", { ascending: true }).order("target_date", { ascending: true }).limit(100),
    client.from("study_recovery_requests").select("id,local_date,trigger_type,status,reason,makeup_todo_title,pledge_todo_title,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
  ]);

  assertQuerySucceeded("프로필", profileResult.error);
  assertQuerySucceeded("출석 기록", attendanceResult.error);
  assertQuerySucceeded("목표", goalResult.error);
  assertQuerySucceeded("회복 루틴", recoveryResult.error);

  return {
    profileData: profileResult.data,
    attendanceData: attendanceResult.data ?? [],
    sessionData,
    todoData,
    sessionTodoLinkData,
    goalData: goalResult.data ?? [],
    recoveryData: recoveryResult.data ?? [],
  };
}

export async function loadReflectionData(client: SupabaseClient, userId: string) {
  return fetchAllPages((from, to) => client
    .from("study_session_reflections")
    .select("id,session_id,focus_score,energy_score,interruption_reason,note,next_action,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to));
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
