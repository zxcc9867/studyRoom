import type { ReactNode } from "react";
import { BatteryMedium, CheckCircle2, Clock3, Compass, Flame, TrendingDown, TrendingUp } from "lucide-react";
import { buildWeeklyStudyReview } from "./weeklyReview.mjs";

type Props = {
  todayDateKey: string;
  sessions: Array<{ id: string; local_date: string; status: string; duration_seconds: number }>;
  todos: Array<{ local_date: string; is_completed: boolean }>;
  attendanceDays: Array<{ local_date: string; status: string }>;
  reflections: Array<{ session_id: string; focus_score: number; energy_score: number; next_action: string | null; created_at: string }>;
};

export default function WeeklyReviewSection(props: Props) {
  const review = buildWeeklyStudyReview(props);
  const { current } = review;
  return (
    <section className="weekly-review-card" aria-labelledby="weekly-review-title">
      <div className="weekly-review-heading">
        <div><p className="eyebrow">weekly review</p><h3 id="weekly-review-title">이번 주 학습 리뷰</h3></div>
        <span>{current.startDate.slice(5).replace("-", ".")} ~ {current.endDate.slice(5).replace("-", ".")}</span>
      </div>
      <div className="weekly-review-score">
        <div><Compass size={30} /><span>꾸준함 점수</span><strong>{current.consistencyScore}</strong></div>
        <Trend value={review.consistencyChange} suffix="점" />
      </div>
      <div className="weekly-review-metrics">
        <Metric icon={<Clock3 size={20} />} label="공부 시간" value={formatDuration(current.studySeconds)} trend={formatSignedDuration(review.studySecondsChange)} />
        <Metric icon={<CheckCircle2 size={20} />} label="할 일 완료" value={`${current.completionRate}%`} trend={`${signed(review.completionRateChange)}%p`} />
        <Metric icon={<Flame size={20} />} label="출석" value={`${current.presentDays}일`} trend={`${current.sessionCount}회 집중`} />
        <Metric icon={<BatteryMedium size={20} />} label="집중·에너지" value={`${current.averageFocus ?? "-"} / ${current.averageEnergy ?? "-"}`} trend={`${current.reflectionCount}회 회고`} />
      </div>
      <div className="weekly-next-actions">
        <strong>다음 행동</strong>
        {current.nextActions.length > 0 ? <ul>{current.nextActions.map((action) => <li key={action}>{action}</li>)}</ul> : <p>세션 회고에 다음 행동을 남기면 여기에 모아드려요.</p>}
      </div>
    </section>
  );
}

function Metric({ icon, label, value, trend }: { icon: ReactNode; label: string; value: string; trend: string }) {
  return <div className="weekly-review-metric">{icon}<span>{label}</span><strong>{value}</strong><small>{trend}</small></div>;
}

function Trend({ value, suffix }: { value: number; suffix: string }) {
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  return <span className={value >= 0 ? "trend-up" : "trend-down"}><Icon size={17} />지난주보다 {signed(value)}{suffix}</span>;
}

function signed(value: number) { return value > 0 ? `+${value}` : String(value); }
function formatDuration(seconds: number) { return `${Math.floor(seconds / 3600)}시간 ${Math.floor((seconds % 3600) / 60)}분`; }
function formatSignedDuration(seconds: number) { const minutes = Math.round(seconds / 60); return `지난주보다 ${signed(minutes)}분`; }
