import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, BatteryMedium, CalendarDays, CheckCircle2, Clock3, Compass, Flame, ShieldCheck, Sprout, TrendingDown, TrendingUp } from "lucide-react";

import { buildComparableWeeklyStudyReview, buildWeeklyActionPlanItems, formatStudyDuration, formatStudyDurationChange } from "./weeklyReview.mjs";
import type { StudyPeriodSummary } from "./studyPeriodSummary.mjs";

type Props = {
  todayDateKey: string;
  sessions: Array<{ id: string; local_date: string; status: string; duration_seconds: number }>;
  todos: Array<{ id?: string; title?: string; local_date: string; is_completed: boolean }>;
  attendanceDays: Array<{ local_date: string; status: string }>;
  reflections: Array<{ session_id: string; focus_score: number; energy_score: number; interruption_reason: "none" | "phone" | "environment" | "fatigue" | "schedule" | "other" | null; next_action: string | null; created_at: string }>;
  currentStudySummary?: StudyPeriodSummary | null;
  previousStudySummary?: StudyPeriodSummary | null;
  onPlanAction?: (action: string) => void;
  onOpenPlannedTodo?: (todoId: string) => void;
};

export default function WeeklyReviewSection(props: Props) {
  const review = buildComparableWeeklyStudyReview(props);
  const { current, previous } = review;
  const actionPlanItems = buildWeeklyActionPlanItems({ nextActions: current.nextActions, todos: props.todos });
  const anomalyCount = current.anomalySessionCount + previous.anomalySessionCount;
  const splitCount = current.crossDateSessionCount + previous.crossDateSessionCount;

  return (
    <section className="weekly-review-card" aria-labelledby="weekly-review-title">
      <div className="weekly-review-heading">
        <div><p className="eyebrow">weekly review</p><h3 id="weekly-review-title">이번 주 학습 리뷰</h3></div>
        <span className="weekly-review-period">
          <strong>{formatShortDate(current.startDate)} ~ {formatShortDate(current.endDate)}</strong>
          <small>{formatShortDate(props.todayDateKey)} 현재 · 지난주 같은 요일까지 비교</small>
        </span>
      </div>
      <div className="weekly-review-score">
        <div><Compass size={30} /><span>꾸준함 점수</span><strong>{current.consistencyScore}</strong></div>
        <Trend value={review.consistencyChange} suffix="점" />
      </div>
      <div className="weekly-review-metrics">
        <Metric
          icon={<Clock3 size={20} />}
          label="완료 세션 공부 시간"
          value={formatStudyDuration(current.studySeconds)}
          detail={`${current.sessionCount}회 완료 합계`}
          trend={formatStudyDurationChange(review.studySecondsChange)}
        />
        <Metric icon={<CheckCircle2 size={20} />} label="할 일 완료" value={`${current.completionRate}%`} trend={`${signed(review.completionRateChange)}%p`} />
        <Metric icon={<Flame size={20} />} label="출석" value={`${current.presentDays}일`} trend={`${current.coveredDayCount}일 기준`} />
        <Metric icon={<BatteryMedium size={20} />} label="집중·에너지" value={`${current.averageFocus ?? "-"} / ${current.averageEnergy ?? "-"}`} trend={`${current.reflectionCount}회 회고`} />
      </div>
      {(anomalyCount > 0 || splitCount > 0) && (
        <div className="weekly-data-quality" role="note">
          <AlertTriangle size={20} />
          <div>
            <strong>시간 기록을 날짜 경계에 맞춰 계산했어요.</strong>
            <p>
              {splitCount > 0 ? `자정을 넘긴 세션 ${splitCount}건은 날짜별로 나눴습니다. ` : ""}
              {anomalyCount > 0 ? `12시간을 넘긴 장기 세션 ${anomalyCount}건은 원본을 유지한 채 검토 필요 기록으로 표시합니다.` : ""}
            </p>
          </div>
        </div>
      )}
      {current.frictionPlan && (
        <aside className={`weekly-friction-plan weekly-friction-${current.frictionPlan.reason}`} aria-labelledby="weekly-friction-plan-title">
          <div className="weekly-friction-sign">
            <span className="weekly-friction-icon" aria-hidden="true"><ShieldCheck size={22} /></span>
            <div>
              <p className="weekly-friction-kicker">숲길 정비 노트</p>
              <h4 id="weekly-friction-plan-title">반복된 방해를 한 칸 줄여봐요</h4>
            </div>
            <span className="weekly-friction-count">{current.frictionPlan.label} · 이번 주 {current.frictionPlan.count}회</span>
          </div>
          <div className="weekly-friction-copy">
            <strong>{current.frictionPlan.title}</strong>
            <p>{current.frictionPlan.action}</p>
            <span><Clock3 size={15} aria-hidden="true" />{current.frictionPlan.cue}</span>
          </div>
        </aside>
      )}
      <section className="weekly-next-actions" aria-labelledby="weekly-action-plan-title">
        <div className="weekly-next-actions-heading">
          <span className="weekly-action-plan-seed" aria-hidden="true"><Sprout size={21} /></span>
          <div>
            <h4 id="weekly-action-plan-title">다음 공부로 이어가기</h4>
            <p>회고에서 한 가지를 골라 날짜와 시간을 정해 두세요.</p>
          </div>
        </div>
        {actionPlanItems.length > 0 ? (
          <ul className="weekly-action-plan-list">
            {actionPlanItems.map((item) => (
              <li className={`weekly-action-plan-item weekly-action-${item.status}`} key={item.action}>
                <span className="weekly-action-plan-marker" aria-hidden="true">
                  {item.status === "planned" ? <CheckCircle2 size={19} /> : <CalendarDays size={19} />}
                </span>
                <span className="weekly-action-plan-copy">
                  <strong>{item.action}</strong>
                  <small>{item.status === "planned" ? `${item.dateLabel ? `${item.dateLabel} · ` : ""}계획됨` : "날짜와 시간을 정하면 다음 시작이 쉬워져요."}</small>
                </span>
                {item.status === "planned" && item.todoId && props.onOpenPlannedTodo ? (
                  <button
                    className="weekly-action-plan-button planned"
                    type="button"
                    onClick={() => props.onOpenPlannedTodo?.(item.todoId!)}
                    aria-label={`${item.action} 계획 보기`}
                  >
                    계획 보기 <ArrowRight size={16} />
                  </button>
                ) : props.onPlanAction ? (
                  <button
                    className="weekly-action-plan-button"
                    type="button"
                    onClick={() => props.onPlanAction?.(item.action)}
                    aria-label={`${item.action}을 계획에 넣기`}
                  >
                    계획에 넣기 <ArrowRight size={16} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="weekly-action-plan-empty">세션을 마칠 때 다음 행동을 남기면 여기서 바로 계획할 수 있어요.</p>
        )}
      </section>
    </section>
  );
}

function Metric({ icon, label, value, detail, trend }: { icon: ReactNode; label: string; value: string; detail?: string; trend: string }) {
  return <div className="weekly-review-metric">{icon}<span>{label}</span><strong>{value}</strong>{detail ? <small className="weekly-review-metric-detail">{detail}</small> : null}<small>{trend}</small></div>;
}

function Trend({ value, suffix }: { value: number; suffix: string }) {
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  return <span className={value >= 0 ? "trend-up" : "trend-down"}><Icon size={17} />지난주보다 {signed(value)}{suffix}</span>;
}

function signed(value: number) { return value > 0 ? `+${value}` : String(value); }
function formatShortDate(dateKey: string) { return dateKey.slice(5).replace("-", "."); }
