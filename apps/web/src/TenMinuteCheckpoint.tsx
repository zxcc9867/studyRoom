import { CheckCircle2, Play, Sprout, Square } from "lucide-react";

import { formatHabitDuration, type TenMinuteCheckpointState } from "./dailyHabit.mjs";

type TenMinuteCheckpointProps = {
  state: TenMinuteCheckpointState;
  paused: boolean;
  busy: boolean;
  onContinue: () => void;
  onFinish: () => void;
};

export default function TenMinuteCheckpoint({
  state,
  paused,
  busy,
  onContinue,
  onFinish,
}: TenMinuteCheckpointProps) {
  if (!state.eligible) return null;

  if (!state.reached) {
    return (
      <section
        className={`ten-minute-checkpoint ${paused ? "paused" : ""}`.trim()}
        aria-labelledby="ten-minute-checkpoint-progress-title"
        data-state="progress"
      >
        <div className="ten-minute-checkpoint-head">
          <span className="ten-minute-checkpoint-icon" aria-hidden="true"><Sprout size={20} /></span>
          <div>
            <p className="eyebrow">first ten minutes</p>
            <h4 id="ten-minute-checkpoint-progress-title">
              {paused
                ? "첫 10분 체크포인트도 잠시 쉬는 중"
                : `${formatHabitDuration(state.remainingSeconds)} 뒤 오늘 습관 성공`}
            </h4>
          </div>
          <strong>{state.progressPercent}%</strong>
        </div>
        <div
          className="ten-minute-checkpoint-track"
          role="progressbar"
          aria-label="첫 10분 체크포인트"
          aria-valuemin={0}
          aria-valuemax={state.thresholdSeconds}
          aria-valuenow={state.creditedSeconds}
          aria-valuetext={`${formatHabitDuration(state.remainingSeconds)} 남음`}
        >
          <span style={{ width: `${state.progressPercent}%` }} />
        </div>
        <small>
          {paused
            ? "휴식 시간은 포함하지 않아요. 공부를 다시 시작하면 남은 시간이 이어집니다."
            : "휴식·카메라 부재 시간을 뺀 오늘의 유효 공부시간으로 계산해요."}
        </small>
      </section>
    );
  }

  if (!state.visible) return null;

  return (
    <section
      className="ten-minute-checkpoint complete"
      aria-labelledby="ten-minute-checkpoint-complete-title"
      aria-live="polite"
      data-state="complete"
    >
      <div className="ten-minute-checkpoint-head">
        <span className="ten-minute-checkpoint-icon" aria-hidden="true"><CheckCircle2 size={22} /></span>
        <div>
          <p className="eyebrow">checkpoint complete</p>
          <h4 id="ten-minute-checkpoint-complete-title">오늘의 시작은 이미 성공했어요</h4>
        </div>
        <strong>10분</strong>
      </div>
      <p>여기서 마쳐도 오늘은 0일이 아니에요. 여유가 있으면 지금 흐름만 조금 더 이어가세요.</p>
      <small>10분 습관 성공과 출석 2·4시간 목표는 서로 다른 기록으로 유지됩니다.</small>
      <div className="ten-minute-checkpoint-actions">
        <button className="secondary" type="button" onClick={onContinue}>
          <Play size={17} /> 조금 더 이어가기
        </button>
        <button
          className="secondary ten-minute-checkpoint-finish"
          type="button"
          onClick={onFinish}
          disabled={busy}
        >
          <Square size={17} /> 오늘은 마무리
        </button>
      </div>
    </section>
  );
}
