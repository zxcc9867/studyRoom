import { ArrowUp, Flower2, Footprints, RefreshCw, Sprout, Target, TreePine } from "lucide-react";

import type { WeeklyHabitRhythm } from "./weeklyHabit.mjs";

type WeeklyHabitRhythmPanelProps = {
  rhythm: WeeklyHabitRhythm;
  inactiveSession: boolean;
};

export default function WeeklyHabitRhythmPanel({
  rhythm,
  inactiveSession,
}: WeeklyHabitRhythmPanelProps) {
  return (
    <section className="weekly-habit-rhythm history-panel" aria-labelledby="weekly-habit-title">
      <div className="weekly-habit-heading">
        <div>
          <p className="eyebrow"><Footprints size={16} aria-hidden="true" /> last 7 days</p>
          <h2 id="weekly-habit-title">최근 7일 숲길</h2>
        </div>
        <span>{rhythm.rangeLabel}</span>
      </div>
      <div className={`weekly-habit-target ${rhythm.target.targetReached ? "completed" : ""} ${rhythm.isGentleRestart ? "restart" : ""}`.trim()}>
        <div className="weekly-habit-target-copy">
          <p><Target size={15} aria-hidden="true" /> flexible goal</p>
          {rhythm.isGentleRestart && (
            <span className="weekly-habit-restart-cue"><RefreshCw size={13} aria-hidden="true" /> 다시 잇는 날</span>
          )}
          <strong>{rhythm.target.targetReached ? "5번 시작 목표 완료" : `5번 시작까지 ${rhythm.target.remainingTargetDays}번`}</strong>
          <small>{rhythm.isGentleRestart ? "쉬었던 하루는 실패가 아니에요. 오늘 10분으로 다시 이어가요." : "최근 7일에서 이틀은 쉬어도 괜찮아요."}</small>
        </div>
        <div
          className="weekly-habit-target-seeds"
          role="progressbar"
          aria-label="최근 7일 5번 시작 목표"
          aria-valuemin={0}
          aria-valuemax={rhythm.target.targetDays}
          aria-valuenow={rhythm.target.creditedStartDays}
          aria-valuetext={`${rhythm.target.creditedStartDays}번 완료, ${rhythm.target.remainingTargetDays}번 남음`}
        >
          {Array.from({ length: rhythm.target.targetDays }, (_, index) => (
            <span className={index < rhythm.target.creditedStartDays ? "completed" : ""} key={index} aria-hidden="true"><Sprout size={17} /></span>
          ))}
        </div>
        {rhythm.primaryActionLabel && inactiveSession && (
          <p className="weekly-habit-action-note">
            <ArrowUp size={16} aria-hidden="true" />
            <span><strong>{rhythm.primaryActionLabel}</strong> · 집중 화면에서 준비해요.</span>
          </p>
        )}
      </div>
      <ol className="weekly-habit-path" aria-label="최근 7일 날짜별 공부 습관">
        {rhythm.days.map((day) => (
          <li
            className={`weekly-habit-day weekly-habit-day-${day.stage} ${day.isToday ? "today" : ""}`.trim()}
            key={day.dateKey}
            aria-current={day.isToday ? "date" : undefined}
            aria-label={`${day.dateLabel} ${day.weekdayLabel}요일, ${day.stageLabel}, 공부 ${day.studyLabel}`}
          >
            <span className="weekly-habit-marker" aria-hidden="true">
              {day.stage === "bloom" ? <Flower2 size={18} /> : day.stage === "tree" ? <TreePine size={18} /> : day.stage === "seed" ? <Sprout size={18} /> : <span className="weekly-habit-rest-dot" />}
            </span>
            <span className="weekly-habit-day-name">{day.isToday ? "오늘" : `${day.weekdayLabel}요일`}</span>
            <strong>{day.dateLabel}</strong>
            <span className="weekly-habit-stage">{day.stageLabel}</span>
            <small>{day.studyLabel}</small>
          </li>
        ))}
      </ol>
      <div className="weekly-habit-stats" aria-label="최근 7일 습관 요약">
        <div><span>7일 시작</span><strong>{rhythm.startSuccessDays}<small>/7일</small></strong></div>
        <div><span>이어온 시작</span><strong>{rhythm.currentStreakDays}<small>일</small></strong></div>
        <div><span>목표 달성</span><strong>{rhythm.goalDays}<small>일 · 꽃 {rhythm.bloomDays}일</small></strong></div>
      </div>
      <div className="weekly-habit-coach" role="status">
        <span className="weekly-habit-coach-icon" aria-hidden="true"><Sprout size={20} /></span>
        <span><strong>{rhythm.coach.title}</strong><small>{rhythm.coach.description}</small></span>
      </div>
    </section>
  );
}
