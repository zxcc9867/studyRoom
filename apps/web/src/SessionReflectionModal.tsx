import { CheckCircle2, Leaf, X } from "lucide-react";

export type SessionReflectionDraft = {
  focusScore: number;
  energyScore: number;
  interruptionReason: "none" | "phone" | "environment" | "fatigue" | "schedule" | "other";
  note: string;
  nextAction: string;
};

type TodoCandidate = {
  id: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
};

type SessionReflectionModalProps = {
  candidates: TodoCandidate[];
  selectedTodoIds: string[];
  draft: SessionReflectionDraft;
  busy: boolean;
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
  candidates,
  selectedTodoIds,
  draft,
  busy,
  onToggleTodo,
  onDraftChange,
  onClose,
  onSubmit,
}: SessionReflectionModalProps) {
  return (
    <div className="modal-backdrop">
      <section className="todo-modal session-reflection-modal" role="dialog" aria-modal="true" aria-labelledby="session-reflection-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="회고 닫기"><X size={22} /></button>
        <p className="eyebrow">session reflection</p>
        <h3 id="session-reflection-title">오늘의 집중을 짧게 돌아봐요</h3>
        <p>집중과 에너지 상태를 남기면 다음 세션을 더 쉽게 시작할 수 있어요.</p>

        <div className="reflection-score-grid">
          <ScoreField label="집중도" value={draft.focusScore} onChange={(focusScore) => onDraftChange({ ...draft, focusScore })} />
          <ScoreField label="에너지" value={draft.energyScore} onChange={(energyScore) => onDraftChange({ ...draft, energyScore })} />
        </div>

        <label className="reflection-field">
          가장 큰 방해 요인
          <select
            value={draft.interruptionReason}
            onChange={(event) => onDraftChange({ ...draft, interruptionReason: event.target.value as SessionReflectionDraft["interruptionReason"] })}
          >
            {interruptionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        <label className="reflection-field">
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
        </label>

        <div className="reflection-todo-block">
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
        </div>

        <div className="modal-actions">
          <button className="primary" type="button" disabled={busy} onClick={onSubmit}>
            <CheckCircle2 size={18} />{busy ? "저장하는 중" : "회고 저장하고 종료"}
          </button>
          <button className="secondary" type="button" disabled={busy} onClick={onClose}><X size={18} />계속 공부하기</button>
        </div>
      </section>
    </div>
  );
}

function ScoreField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <fieldset className="reflection-score-field">
      <legend>{label}</legend>
      <div>
        {[1, 2, 3, 4, 5].map((score) => (
          <button key={score} type="button" className={value === score ? "selected" : ""} aria-pressed={value === score} onClick={() => onChange(score)}>
            <Leaf size={15} />{score}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
