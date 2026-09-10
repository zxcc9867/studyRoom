// Synthetic, local-only browser fixture. Never imports credentials or contacts Supabase.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import StudyReportSection from "../../src/StudyReportSection";
import "../../src/styles.css";

const parameters = new URLSearchParams(window.location.search);
const controls = { fail: false, delay: 0 };
const nowMs = Date.parse(parameters.get("now") ?? "2026-09-10T03:00:00Z");
const profileZone = parameters.get("zone") ?? "Asia/Seoul";
const rows: Record<string, Array<Record<string, unknown>>> = {
  study_sessions: [{ id: "session", user_id: "fixture-owner", local_date: "2026-09-08", status: "completed", duration_seconds: 10800 }],
  study_todos: [{ id: "todo", user_id: "fixture-owner", local_date: "2026-09-09", title: "오답 한 문제", is_completed: false }],
  attendance_days: [{ id: "attendance", user_id: "fixture-owner", local_date: "2026-09-08", status: "present" }],
  study_session_reflections: [{ id: "reflection", user_id: "fixture-owner", session_id: "session", focus_score: 4, energy_score: 3, interruption_reason: "phone", next_action: "오답 한 문제", created_at: "2026-09-08T09:00:00Z" }],
};
const client = createClient("https://report-fixture.invalid", "fixture-public-key", {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: async (input, init) => {
    const fail = controls.fail;
    const url = new URL(String(input));
    await new Promise(resolve => setTimeout(resolve, controls.delay));
    if (fail) return new Response(JSON.stringify({ message: "Synthetic failure" }), { status: 503, headers: { "Content-Type": "application/json" } });
    if (url.pathname.endsWith("/profiles")) {
      await new Promise(resolve => setTimeout(resolve, Number(parameters.get("profileDelay") ?? 0)));
      return new Response(JSON.stringify({ time_zone: profileZone }), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname.includes("/rpc/")) {
      const { p_start_date } = JSON.parse(String(init?.body));
      const seconds: Record<string, number> = { "2026-09-07": 10800, "2026-08-31": 7200, "2026-09-01": 18000, "2026-08-01": 36000 };
      return new Response(JSON.stringify([{ completed_seconds: seconds[p_start_date] ?? 3600, completed_session_count: 1, anomaly_session_count: 0, cross_date_session_count: 0 }]), { headers: { "Content-Type": "application/json" } });
    }
    let result = rows[url.pathname.split("/").at(-1)!] ?? [];
    for (const [key, filter] of url.searchParams) {
      if (filter.startsWith("eq.")) result = result.filter(row => String(row[key]) === filter.slice(3));
      if (filter.startsWith("gte.")) result = result.filter(row => String(row[key]) >= filter.slice(4));
      if (filter.startsWith("lte.")) result = result.filter(row => String(row[key]) <= filter.slice(4));
      if (filter.startsWith("in.(")) result = result.filter(row => filter.slice(4, -1).split(",").includes(String(row[key])));
    }
    const offset = Number(url.searchParams.get("offset") ?? 0);
    return new Response(JSON.stringify(result.slice(offset, offset + Number(url.searchParams.get("limit") ?? 500))), { headers: { "Content-Type": "application/json" } });
  } },
});
function Fixture() {
  const [notice, setNotice] = useState("");
  return <main style={{ maxWidth: 1100, margin: "24px auto", padding: 12 }}><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
    <button type="button" onClick={() => { controls.fail = true; setNotice("다음 조회 실패 준비"); }}>조회 실패 켜기</button>
    <button type="button" onClick={() => { controls.fail = false; setNotice("정상 조회 준비"); }}>조회 정상화</button>
    <button type="button" onClick={() => { controls.delay = 3000; setNotice("조회 3초 지연"); }}>조회 지연 켜기</button>
    <button type="button" onClick={() => { controls.delay = 0; setNotice("지연 해제"); }}>지연 해제</button>
    <span data-testid="fixture-notice">{notice}</span>
  </div><StudyReportSection client={client} userId="fixture-owner" profileTimeZone="Asia/Tokyo" nowMs={nowMs} sessions={[]} todos={[]} attendanceDays={[]} reflections={[]} onPlanAction={action => setNotice(`계획 요청: ${action}`)} onOpenPlannedTodo={id => setNotice(`기존 계획: ${id}`)} /></main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
