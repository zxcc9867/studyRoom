import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import WeeklyReviewSection from "./WeeklyReviewSection";
import { formatStudyDuration } from "./weeklyReview.mjs";
import { buildStudyReport, getStudyReportPeriods, getStudyReportTodayDate } from "./studyReports.mjs";
import type { StudyReportPeriods } from "./studyReports.mjs";
import { createStudyReportRequest, getStudyReportState, loadStudyReportData, loadStudyReportProfile } from "./studyReportData.mjs";
import type { ReportAttendance, ReportReflection, ReportSession, ReportTodo, StudyReportState } from "./studyReportData.mjs";
import "./studyReports.css";

type Actions = { onPlanAction?: (action: string) => void; onOpenPlannedTodo?: (todoId: string) => void };
type Props = Actions & {
  client: SupabaseClient;
  userId: string;
  profileTimeZone?: string;
  nowMs: number;
  sessions: ReportSession[];
  todos: ReportTodo[];
  attendanceDays: ReportAttendance[];
  reflections: ReportReflection[];
};

export default function StudyReportSection(props: Props) {
  const [retry, setRetry] = useState(0);
  const [profile, setProfile] = useState<StudyReportState<{ timeZone: string }> | null>(null);
  const request = useMemo(() => createStudyReportRequest<{ timeZone: string }>(), []);
  // The parent profile is only an invalidation hint, never the report date source.
  const key = JSON.stringify([props.userId, props.profileTimeZone, retry]);
  useEffect(() => {
    void request.run(key, signal => loadStudyReportProfile(props.client, props.userId, signal), setProfile);
    return request.cancel;
  }, [request, key, props.client, props.userId]);
  const currentProfile = getStudyReportState(profile, key);
  if (currentProfile.status !== "ready") return <section className="study-report"><div className="study-report-toolbar"><h3>차곡차곡, 학습 리포트</h3></div><ReportStatus error={currentProfile.status === "error"} onRetry={() => setRetry(value => value + 1)} /></section>;
  const timeZone = currentProfile.data.timeZone;
  return <StudyReportWithProfile key={props.userId} {...props} timeZone={timeZone} todayDateKey={getStudyReportTodayDate(props.nowMs, timeZone)} />;
}

function StudyReportWithProfile(props: Props & { timeZone: string; todayDateKey: string }) {
  const [mode, setMode] = useState<"week" | "month">("week");
  const [anchorDate, setAnchorDate] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<StudyReportState | null>(null);
  const anchor = anchorDate && anchorDate <= props.todayDateKey ? anchorDate : props.todayDateKey;
  const periodInput = useRef<HTMLInputElement>(null);
  const periodInputValue = mode === "week" ? anchor : anchor.slice(0, 7);
  useEffect(() => {
    if (periodInput.current && periodInput.current.value !== periodInputValue) periodInput.current.value = periodInputValue;
  }, [periodInputValue, mode]);
  const periods = useMemo(() => getStudyReportPeriods({ todayDateKey: props.todayDateKey, mode, anchorDate: anchor }), [props.todayDateKey, mode, anchor]);
  const revision = useMemo(() => JSON.stringify([
    props.sessions.map(row => [row.id, row.local_date, row.status, row.duration_seconds]),
    props.todos.map(row => [row.id, row.title, row.local_date, row.is_completed]),
    props.attendanceDays.map(row => [row.local_date, row.status]),
    props.reflections.map(row => [row.session_id, row.focus_score, row.energy_score, row.interruption_reason, row.next_action, row.created_at]),
  ]), [props.sessions, props.todos, props.attendanceDays, props.reflections]);
  const key = JSON.stringify([props.userId, props.timeZone, periods, revision, retry]);
  const request = useMemo(() => createStudyReportRequest(), []);
  useEffect(() => {
    void request.run(key, signal => loadStudyReportData(props.client, props.userId, periods, signal), setState);
    return request.cancel;
  }, [request, key, props.client, props.userId, periods]);

  const selectPeriod = (value: string) => {
    const date = mode === "month" ? `${value}-01` : value;
    try {
      getStudyReportPeriods({ todayDateKey: props.todayDateKey, mode, anchorDate: date });
      setAnchorDate(date);
    } catch { /* A cleared or incomplete native date input is not a new selection. */ }
  };

  return (
    <section className="study-report" aria-labelledby="study-report-heading">
      <div className="study-report-toolbar">
        <div><p className="eyebrow">my study journal</p><h3 id="study-report-heading">차곡차곡, 학습 리포트</h3><p className="study-report-intro">한 주의 흐름부터 한 달의 변화까지 돌아보세요.</p></div>
        <div className="study-report-mode" role="group" aria-label="리포트 단위">
          <button type="button" aria-pressed={mode === "week"} onClick={() => setMode("week")}>주간</button>
          <button type="button" aria-pressed={mode === "month"} onClick={() => setMode("month")}>월간</button>
        </div>
        <div className="study-report-navigation">
          <button type="button" aria-label={mode === "week" ? "이전 주 보기" : "이전 달 보기"} onClick={() => setAnchorDate(periods.previousAnchor)}><ChevronLeft size={20} /></button>
          <label><span>{mode === "week" ? "주간 기준 날짜" : "리포트 월"}</span><input ref={periodInput} type={mode === "week" ? "date" : "month"} aria-label={mode === "week" ? "주간 기준 날짜" : "리포트 월"} defaultValue={periodInputValue} max={mode === "week" ? props.todayDateKey : props.todayDateKey.slice(0, 7)} onChange={event => selectPeriod(event.target.value)} onBlur={event => { event.currentTarget.value = periodInputValue; }} /></label>
          <button type="button" aria-label={mode === "week" ? "다음 주 보기" : "다음 달 보기"} disabled={!periods.canGoForward} onClick={() => setAnchorDate(periods.nextAnchor)}><ChevronRight size={20} /></button>
          <button type="button" className="study-report-today" disabled={periods.isCurrentPeriod} onClick={() => setAnchorDate(null)}><RotateCcw size={16} />{mode === "week" ? "이번 주" : "이번 달"}</button>
        </div>
      </div>
      <StudyReportContent periods={periods} todayDateKey={props.todayDateKey} state={getStudyReportState(state, key)} onRetry={() => setRetry(value => value + 1)} onPlanAction={props.onPlanAction} onOpenPlannedTodo={props.onOpenPlannedTodo} />
    </section>
  );
}

export function StudyReportContent({ periods, todayDateKey, state, onRetry, ...actions }: Actions & { periods: StudyReportPeriods; todayDateKey: string; state: StudyReportState; onRetry: () => void }) {
  if (state.status !== "ready") return <ReportStatus error={state.status === "error"} onRetry={onRetry} />;
  const review = buildStudyReport(periods, state.data);
  const { current, previous } = review;
  const title = periods.mode === "month" ? `${current.startDate.slice(0, 4)}년 ${Number(current.startDate.slice(5, 7))}월 학습 리포트` : periods.isCurrentPeriod ? "이번 주 학습 리포트" : "지난 주간 학습 리포트";
  const empty = current.sessionCount === 0 && current.plannedTodoCount === 0 && current.presentDays === 0 && current.reflectionCount === 0 && !state.data.attendanceDays.some(row => row.local_date >= current.startDate && row.local_date <= current.endDate);
  return (
    <div className="study-report-ready">
      <div className="study-report-comparison">
        <p><strong>선택 기간</strong> {displayDate(current.startDate)} ~ {displayDate(current.endDate)} <span>({current.coveredDayCount}일)</span></p>
        <p><strong>비교 기간</strong> {displayDate(previous.startDate)} ~ {displayDate(previous.endDate)} <span>({previous.coveredDayCount}일)</span></p>
        <small>{periods.isCurrentPeriod ? "진행 중인 기간은 오늘까지, 이전 기간도 같은 경과 일수까지만 비교해요. 월말은 실제 마지막 날까지 계산해요." : "완료된 기간끼리 전체 기록을 비교해요."}</small>
        {periods.mode === "month" && <p className="study-report-daily-average"><strong>일평균 공부</strong> {formatStudyDuration(current.studySeconds / current.coveredDayCount)} <span>· 이전 달 {formatStudyDuration(previous.studySeconds / previous.coveredDayCount)}</span></p>}
      </div>
      {empty && <p className="study-report-empty" role="status">이 기간에는 아직 기록이 없어요. 다른 주나 달을 선택해 지난 공부를 돌아보세요.</p>}
      <WeeklyReviewSection todayDateKey={todayDateKey} sessions={state.data.sessions} todos={state.data.plannedTodos} attendanceDays={state.data.attendanceDays} reflections={state.data.reflections} review={review} reportTitle={title} comparisonLabel={periods.comparisonLabel} {...actions} />
      <p className="study-report-footnote">공부 시간은 완료한 세션만 날짜 경계에 맞춰 나눠 합산해요. 출석·할 일은 해당 날짜, 회고와 방해 요인은 세션을 시작한 날짜 기준이에요. 진행 중이거나 쉬는 중인 세션은 종료 후 반영돼요.</p>
    </div>
  );
}

function ReportStatus({ error, onRetry }: { error: boolean; onRetry: () => void }) {
  if (error) return <div className="study-report-status study-report-error" role="alert"><strong>리포트를 불러오지 못했어요.</strong><p>기록은 바뀌지 않았어요. 잠시 후 다시 확인해 주세요.</p><button type="button" onClick={onRetry}>다시 불러오기</button></div>;
  return <div className="study-report-status" role="status" aria-live="polite"><span className="study-report-seed" aria-hidden="true" /><strong>이 기간의 기록을 모으고 있어요.</strong><p>계정의 시간대와 공부 시간, 출석, 회고를 확인한 뒤 보여드릴게요.</p></div>;
}

function displayDate(date: string) { return date.replaceAll("-", "."); }
