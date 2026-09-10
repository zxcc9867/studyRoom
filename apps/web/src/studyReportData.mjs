import { normalizeStudyPeriodSummary } from "./studyPeriodSummary.mjs";

const PAGE_SIZE = 500;

export async function loadStudyReportProfile(client, userId, signal) {
  if (!userId) throw new Error("A signed-in report owner is required");
  let query = client.from("profiles").select("time_zone").eq("user_id", userId).maybeSingle();
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw new Error("Report profile could not be loaded");
  const timeZone = data?.time_zone ?? "UTC";
  new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
  return { timeZone };
}

async function allPages(build, signal) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    signal?.throwIfAborted();
    let query = build().range(offset, offset + PAGE_SIZE - 1);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error || !Array.isArray(data)) throw new Error("Report records could not be loaded");
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function summaryFor(client, range, signal) {
  let query = client.rpc("get_study_period_summary", { p_start_date: range.startDate, p_end_date: range.endDate });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  const row = Array.isArray(data) && data.length === 1 ? data[0] : !Array.isArray(data) ? data : null;
  const fields = ["completed_seconds", "completed_session_count", "anomaly_session_count", "cross_date_session_count"];
  if (error || !row || fields.some(field => row[field] === null || row[field] === "" || !["number", "string"].includes(typeof row[field]) || !Number.isFinite(Number(row[field])) || Number(row[field]) < 0)) {
    throw new Error("Canonical report summary is unavailable");
  }
  return normalizeStudyPeriodSummary(row);
}

export async function loadStudyReportData(client, userId, periods, signal) {
  if (!userId) throw new Error("A signed-in report owner is required");
  const start = periods.previousRange.startDate;
  const end = periods.currentRange.endDate;
  const dated = (table, columns) => () => client.from(table).select(columns).eq("user_id", userId).gte("local_date", start).lte("local_date", end).order("local_date", { ascending: true }).order("id", { ascending: true });
  const [currentSummary, previousSummary, sessions, todos, attendanceDays, plannedTodos] = await Promise.all([
    summaryFor(client, periods.currentRange, signal),
    summaryFor(client, periods.previousRange, signal),
    allPages(() => dated("study_sessions", "id,local_date,status,duration_seconds")().eq("status", "completed"), signal),
    allPages(dated("study_todos", "id,title,local_date,is_completed"), signal),
    allPages(dated("attendance_days", "id,local_date,status"), signal),
    allPages(() => client.from("study_todos").select("id,title,local_date,is_completed").eq("user_id", userId).eq("is_completed", false).order("local_date", { ascending: true }).order("id", { ascending: true }), signal),
  ]);
  const reflections = [];
  for (let offset = 0; offset < sessions.length; offset += 100) {
    const sessionIds = sessions.slice(offset, offset + 100).map(session => session.id);
    reflections.push(...await allPages(() => client.from("study_session_reflections")
      .select("id,session_id,focus_score,energy_score,interruption_reason,next_action,created_at")
      .eq("user_id", userId).in("session_id", sessionIds)
      .order("created_at", { ascending: true }).order("id", { ascending: true }), signal));
  }
  return { currentSummary, previousSummary, sessions, todos, attendanceDays, reflections, plannedTodos };
}

export function getStudyReportState(state, key) {
  return state?.key === key ? state : { key, status: "loading" };
}

export function createStudyReportRequest({ timeoutMs = 15000 } = {}) {
  let version = 0;
  let activeController = null;
  const cancel = () => { version += 1; activeController?.abort(); activeController = null; };
  return {
    cancel,
    async run(key, load, emit) {
      cancel();
      const requestVersion = version;
      const controller = new AbortController();
      activeController = controller;
      emit({ key, status: "loading" });
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let onAbort;
      const aborted = new Promise((_, reject) => {
        onAbort = () => reject(new Error("Report request stopped"));
        controller.signal.addEventListener("abort", onAbort, { once: true });
      });
      try {
        const data = await Promise.race([load(controller.signal), aborted]);
        if (requestVersion === version) emit({ key, status: "ready", data });
      } catch {
        if (requestVersion === version) emit({ key, status: "error" });
      } finally {
        clearTimeout(timeout);
        controller.signal.removeEventListener("abort", onAbort);
        controller.abort();
        if (requestVersion === version) activeController = null;
      }
    },
  };
}
