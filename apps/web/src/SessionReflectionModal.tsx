import { CheckCircle2, Leaf, X } from "lucide-react";

import { AccessibleDialog } from "./AccessibleDialog";
import type { LearningResult } from "./learningContinuity.mjs";

export type SessionReflectionDraft = {
  focusScore: number | null;
  energyScore: number | null;
  interruptionReason: "none" | "phone" | "environment" | "fatigue" | "schedule" | "other" | null;
  note: string;
  nextAction: string;
  contextTodoId?: string | null;
  resourceUrl?: string;
  resourcePosition?: string;
};

type TodoCandidate = {
  id: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
};

type SessionReflectionModalProps = {
  mode?: "completion" | "follow-up" | "bookmark";
  sessionLabel?: string;
  candidates: TodoCandidate[];
  selectedTodoIds: string[];
  draft: SessionReflectionDraft;
  busy: boolean;
  learningSupported?: boolean;
  contextCandidates?: TodoCandidate[];
  error?: string;
  onRecheck?: () => void;
  latestRecord?: LearningResult;
  onAcceptLatest?: (result: LearningResult) => void;
  onToggleTodo: (todoId: string) => void;
  onDraftChange: (draft: SessionReflectionDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
};

const interruptionOptions: Array<{ value: SessionReflectionDraft["interruptionReason"]; label: string }> = [
  { value: "none", label: "방해 없음" },
  { value: "phone", label: "휴대폰" },
  { value: "environment", label: "소음·환경" },
  { value: "fatigue", label: "피로" },
  { value: "schedule", label: "일정" },
  { value: "other", label: "기타" },
];

export default function SessionReflectionModal({
  mode = "completion",
  sessionLabel,
  candidates,
  selectedTodoIds,
  draft,
  busy,
  learningSupported = false,
  contextCandidates = [],
  error,
  onRecheck,
  latestRecord,
  onAcceptLatest,
  onToggleTodo,
  onDraftChange,
  onClose,
  onSubmit,
}: SessionReflectionModalProps) {
  const followUp = mode === "follow-up" || mode === "bookmark";
  const bookmarkOnly = mode === "bookmark";

  return (
    <AccessibleDialog
      className={`todo-modal session-reflection-modal${learningSupported ? " learning-dialog" : ""}`}
      labelledBy="session-reflection-title"
      describedBy="session-reflection-description"
      onClose={() => { if (!busy) onClose(); }}
    >
      <div className="todo-header">
        <div>
          <h3 id="session-reflection-title">
            {learningSupported ? bookmarkOnly ? "다음 시작점 수정" : followUp ? "학습 회고 수정" : "공부 마무리" : followUp ? "놓친 세션을 짧게 돌아봐요" : "오늘의 집중을 짧게 돌아봐요"}
          </h3>
        </div>
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label={followUp ? "나중 회고 닫기" : "회고 닫기"}
          data-dialog-initial-focus
        >
          <X size={22} />
        </button>
      </div>
      <p id="session-reflection-description">
        {sessionLabel ? `${sessionLabel} · ` : ""}
        {learningSupported ? "남긴 것과 다음 시작점은 선택 입력이에요." : "집중과 에너지 상태를 남기면 다음 세션을 더 쉽게 시작할 수 있어요."}
      </p>

      {error && <div className="learning-error" role="alert">{error}{onRecheck && <button type="button" className="plain" disabled={busy} onClick={onRecheck}>최신 기록 다시 확인</button>}</div>}
      {latestRecord && <div className="learning-latest"><p>서버의 최신 결과: {latestRecord.note || "작성한 결과 없음"}</p><p>최신 시작점: {latestRecord.nextAction || "없음"}</p><button type="button" className="secondary" disabled={busy} onClick={() => onAcceptLatest?.(latestRecord)}>최신 기록을 확인하고 내 초안 유지</button></div>}
      {learningSupported && <>
        {!bookmarkOnly && <label className="reflection-field">오늘 남긴 것<textarea value={draft.note} maxLength={500} rows={3} disabled={busy} placeholder="오늘 이해하거나 완성한 것을 남겨보세요. (선택)" onChange={event => onDraftChange({ ...draft, note: event.target.value })} /></label>}
        <label className="reflection-field">다음 시작점<input value={draft.nextAction} maxLength={160} disabled={busy} placeholder="다음에는 어디부터 이어갈까요? (선택)" onChange={event => onDraftChange({ ...draft, nextAction: event.target.value })} /></label>
        {contextCandidates.length > 0 && <label className="reflection-field">연결할 할 일<select value={draft.contextTodoId ?? ""} disabled={busy} onChange={event => onDraftChange({ ...draft, contextTodoId: event.target.value || null })}><option value="">연결하지 않음</option>{contextCandidates.map(todo => <option key={todo.id} value={todo.id}>{todo.title}</option>)}</select></label>}
        <details><summary>자료 위치 추가</summary><label className="reflection-field">자료 URL<input value={draft.resourceUrl ?? ""} type="text" inputMode="url" maxLength={2048} disabled={busy} placeholder="https://…" onChange={event => onDraftChange({ ...draft, resourceUrl: event.target.value })} /></label><label className="reflection-field">자료 위치<input value={draft.resourcePosition ?? ""} maxLength={160} disabled={busy} placeholder="예: 12쪽, 3장, 08:20" onChange={event => onDraftChange({ ...draft, resourcePosition: event.target.value })} /></label></details>
      </>}

      {!bookmarkOnly && <details className="reflection-details" open={learningSupported ? undefined : true}>
      <summary>{learningSupported ? "집중 상태 · 할 일 완료" : "집중 상태"}</summary>

      <div className="reflection-score-grid">
        <ScoreField label="집중도" value={draft.focusScore} disabled={busy} optional={learningSupported} onChange={(focusScore) => onDraftChange({ ...draft, focusScore })} />
        <ScoreField label="에너지" value={draft.energyScore} disabled={busy} optional={learningSupported} onChange={(energyScore) => onDraftChange({ ...draft, energyScore })} />
      </div>

      <label className="reflection-field">
        가장 큰 방해 요인
        <select
          value={draft.interruptionReason ?? ""}
          disabled={busy}
          onChange={(event) => onDraftChange({ ...draft, interruptionReason: (event.target.value || null) as SessionReflectionDraft["interruptionReason"] })}
        >
          {learningSupported && <option value="">선택하지 않음</option>}
          {interruptionOptions.map((option) => <option key={option.value} value={option.value ?? ""}>{option.label}</option>)}
        </select>
      </label>

      {!learningSupported && <><label className="reflection-field">
        다음 세션에서 바로 할 한 가지
        <input
          value={draft.nextAction}
          maxLength={160}
          placeholder="예: 3단원 연습문제 1번부터"
          onChange={(event) => onDraftChange({ ...draft, nextAction: event.target.value })}
        />
      </label>

      <label className="reflection-field">
        한 줄 메모
        <textarea
          value={draft.note}
          maxLength={500}
          rows={3}
          placeholder="잘된 점이나 다음에 바꿀 점을 남겨보세요."
          onChange={(event) => onDraftChange({ ...draft, note: event.target.value })}
        />
      </label></>}

      {!followUp && <div className="reflection-todo-block">
        <strong>이번 세션에서 끝낸 할 일</strong>
        {candidates.length === 0 ? (
          <p className="todo-empty">완료할 수 있는 오늘 할 일이 없어요.</p>
        ) : (
          <ul className="todo-list session-completion-list">
            {candidates.map((todo) => (
              <li className="todo-item" key={todo.id}>
                <label className="todo-check-row">
                  <input type="checkbox" checked={selectedTodoIds.includes(todo.id)} disabled={busy} onChange={() => onToggleTodo(todo.id)} />
                  <span className="todo-title">{todo.title}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>}
      </details>}

      <div className="modal-actions">
        <button className="primary" type="button" disabled={busy} onClick={onSubmit}>
          <CheckCircle2 size={18} />{busy ? "저장하는 중" : followUp ? "회고 저장하기" : learningSupported ? "저장하고 종료" : "회고 저장하고 종료"}
        </button>
        <button className="secondary" type="button" disabled={busy} onClick={onClose}>
          <X size={18} />{followUp ? "나중에" : "계속 공부하기"}
        </button>
      </div>
    </AccessibleDialog>
  );
}

function ScoreField({ label, value, disabled, optional, onChange }: { label: string; value: number | null; disabled: boolean; optional: boolean; onChange: (value: number | null) => void }) {
  return (
    <fieldset className="reflection-score-field">
      <legend>{label}</legend>
      <div>
        {[1, 2, 3, 4, 5].map((score) => (
          <button key={score} type="button" disabled={disabled} className={value === score ? "selected" : ""} aria-pressed={value === score} onClick={() => onChange(optional && value === score ? null : score)}>
            <Leaf size={15} />{score}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
