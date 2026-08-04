import { Clock3, RotateCcw, X } from "lucide-react";

import {
  BREAK_RETURN_PRESET_MINUTES,
  getStudyBreakReturnPlanState,
} from "./sessionBreak.mjs";

type BreakReturnPlanProps = {
  deadlineMs: number | null;
  nowMs: number;
  timeZone: string;
  leaseDeadlineMs: number | null;
  disabled?: boolean;
  onPlan: (durationMinutes: number) => void;
  onExtend: (durationMinutes: number) => void;
  onClear: () => void;
};

export default function BreakReturnPlan({
  deadlineMs,
  nowMs,
  timeZone,
  leaseDeadlineMs,
  disabled = false,
  onPlan,
  onExtend,
  onClear,
}: BreakReturnPlanProps) {
  const state = getStudyBreakReturnPlanState({ deadlineMs, nowMs, leaseDeadlineMs });

  return (
    <section
      className={`break-return-plan ${state.due ? "due" : state.planned ? "planned" : "unplanned"}`}
      aria-labelledby="break-return-plan-title"
      data-state={state.due ? "due" : state.planned ? "planned" : "unplanned"}
    >
      <div className="break-return-copy">
        <p className="eyebrow"><Clock3 size={15} aria-hidden="true" /> return promise</p>
        <strong id="break-return-plan-title">
          {!state.planned
            ? "언제 다시 앉을까요?"
            : state.due
              ? "돌아올 시간이 됐어요"
              : `${formatReturnTime(state.deadlineMs, timeZone)}에 돌아오기`}
        </strong>
        <small>
          {!state.planned
            ? "복귀 시각을 정해 두면 휴식이 길어지기 전에 다시 시작하기 쉬워져요."
            : state.due
              ? "늦지 않았어요. 위의 공부 계속하기를 누르면 같은 세션으로 돌아가요."
              : `${formatReturnCountdown(state.remainingSeconds)} 남았어요. 공부 시간은 계속 멈춰 있어요.`}
        </small>
        {state.leaseExpiresBeforeReturn && (
          <small className="break-return-lease-warning">
            세션 유지 시간이 복귀 약속보다 먼저 끝날 수 있어요. 필요하면 아래에서 유지 시간을 늘려 주세요.
          </small>
        )}
      </div>

      {!state.planned ? (
        <div className="break-return-actions break-return-presets" aria-label="복귀 시간 선택">
          {BREAK_RETURN_PRESET_MINUTES.map((minutes) => (
            <button
              className="break-return-preset"
              type="button"
              disabled={disabled}
              key={minutes}
              onClick={() => onPlan(minutes)}
            >
              {minutes}분
            </button>
          ))}
        </div>
      ) : (
        <div className="break-return-actions">
          <button className="break-return-extend" type="button" disabled={disabled} onClick={() => onExtend(10)}>
            <RotateCcw size={15} aria-hidden="true" />
            10분 더
          </button>
          <button className="break-return-clear" type="button" disabled={disabled} onClick={onClear}>
            <X size={15} aria-hidden="true" />
            약속 지우기
          </button>
        </div>
      )}
    </section>
  );
}

function formatReturnTime(deadlineMs: number | null, timeZone: string) {
  if (deadlineMs === null) return "";
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  try {
    return new Intl.DateTimeFormat("ko-KR", { ...options, timeZone }).format(deadlineMs);
  } catch {
    return new Intl.DateTimeFormat("ko-KR", options).format(deadlineMs);
  }
}

function formatReturnCountdown(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const restSeconds = safeSeconds % 60;
  return hours > 0
    ? `${hours}시간 ${String(minutes).padStart(2, "0")}분`
    : `${minutes}분 ${String(restSeconds).padStart(2, "0")}초`;
}
