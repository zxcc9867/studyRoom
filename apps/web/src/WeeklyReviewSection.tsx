import type { ReactNode } from "react";
import { AlertTriangle, BatteryMedium, CheckCircle2, Clock3, Compass, Flame, TrendingDown, TrendingUp } from "lucide-react";

import { buildComparableWeeklyStudyReview, formatStudyDuration, formatStudyDurationChange } from "./weeklyReview.mjs";
import type { StudyPeriodSummary } from "./studyPeriodSummary.mjs";

type Props = {
  todayDateKey: string;
  sessions: Array<{ id: string; local_date: string; status: string; duration_seconds: number }>;
  todos: Array<{ local_date: string; is_completed: boolean }>;
  attendanceDays: Array<{ local_date: string; status: string }>;
  reflections: Array<{ session_id: string; focus_score: number; energy_score: number; next_action: string | null; created_at: string }>;
  currentStudySummary?: StudyPeriodSummary | null;
  previousStudySummary?: StudyPeriodSummary | null;
};

export default function WeeklyReviewSection(props: Props) {
  const review = buildComparableWeeklyStudyReview(props);
  const { current, previous } = review;
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
      <div className="weekly-next-actions">
        <strong>다음 행동</strong>
        {current.nextActions.length > 0 ? <ul>{current.nextActions.map((action) => <li key={action}>{action}</li>)}</ul> : <p>세션 회고에 다음 행동을 남기면 여기에 모아드려요.</p>}
      </div>
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
