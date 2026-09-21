import { formatActualDuration, getActualProgress, firstStartDelayMinutes, type ActualTracking } from './actualStudy.mjs';
import { CurrentTodoChoice } from './ActualStudyDialogs';
import { formatTodoRepeatLabel } from './todoRecurrence.mjs';

export default function ActualStudyPanel({ tracking, paused, nowMs, cameraTotal, timeZone, busy, onSwitch, focusId, onFocus, goalTitles, leaseExpiresAt, onChoose }: {
  tracking: ActualTracking | null; paused: boolean; nowMs: number; cameraTotal: number; timeZone: string; busy: boolean; onSwitch: (id: string) => void; focusId: string | null; onFocus: (id: string) => void; goalTitles: Map<string,string>; leaseExpiresAt: string | null; onChoose: () => void;
}) {
  const current = tracking?.todos.find(todo => todo.id === tracking.current_todo_id);
  const next = tracking?.todos.filter(todo => todo.id !== tracking.current_todo_id) ?? [];
  const initialDelay = current ? firstStartDelayMinutes(current) : null;
  const progress = current && tracking ? getActualProgress({...current, open_started_at: paused ? null : current.open_started_at}, tracking, nowMs, cameraTotal, leaseExpiresAt) : null;
  const date = (value: string) => new Intl.DateTimeFormat('ko-KR', {timeZone, month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
  return <div className="session-todo-panel actual-study-panel" aria-label="이번 세션 할 일">
    <div className="session-todo-head"><div><p className="eyebrow">session tasks</p><h3>이번 세션 할 일</h3></div><span className="actual-state">{paused ? '휴식 중' : '집중 중'}</span></div>
    {!tracking ? <p role="status">서버의 공부 기록을 확인하고 있어요. 확인 전에는 세션을 변경할 수 없어요.</p> : <>
      {current && progress ? <div className="actual-current">
        <h4>{current.title}</h4>
        {initialDelay !== null && <p className="actual-start">{initialDelay > 0 ? `최초 ${initialDelay >= 60 ? `${Math.floor(initialDelay / 60)}시간${initialDelay % 60 ? ` ${initialDelay % 60}분` : ""}` : `${initialDelay}분`} 늦게 시작` : "계획대로 첫 시작"} · 재개 시각은 지연으로 평가하지 않아요.</p>}
        <p className="actual-start">{current.first_started_at ? `최초 시작 ${date(current.first_started_at)}` : current.first_tracked_at ? `확인 가능한 측정 시작 ${date(current.first_tracked_at)}` : '실제 시작 미확인'}{current.open_started_at && current.open_started_at !== current.first_started_at && <> · 이번 재개 {date(current.open_started_at)}</>}</p>
        <div className="actual-progress"><div><span>확인된 누적 공부</span><strong>{formatActualDuration(progress.known)}</strong></div><div><span>{current.unknown_allocation ? '확인된 시간 기준 최대 남은 분량' : '목표까지 남은 분량'}</span><strong>{progress.remaining === null ? '시간 미지정' : formatActualDuration(progress.remaining)}</strong></div></div>
        {current.target_seconds !== null && current.target_seconds > 0 && <progress aria-label="현재 할 일 진행도" value={Math.min(progress.known,current.target_seconds)} max={current.target_seconds}/>}
        {progress.remaining === 0 && <p>목표 분량에 도달했어요. 공부는 직접 종료하거나 전환할 때까지 이어져요.</p>}
        <dl className="actual-schedule"><div><dt>조정 일정</dt><dd>{current.start_time && current.end_time ? `${current.local_date} ${current.start_time.slice(0,5)} → ${current.end_time.slice(0,5)}${current.end_time <= current.start_time ? ' (다음 날)' : ''}` : '시간 미지정'}</dd></div><div><dt>원래 계획</dt><dd>{current.original_start_at && current.original_end_at ? `${date(current.original_start_at)} → ${date(current.original_end_at)}` : '시간 미지정'}</dd></div></dl>
        <div className="todo-meta-row"><span className="todo-meta-chip">{formatTodoRepeatLabel(current)}</span>{current.goal_id && goalTitles.has(current.goal_id) && <span className="todo-goal-chip">{goalTitles.get(current.goal_id)}</span>}</div>
      </div> : <p>현재 집중할 일을 선택해 주세요. 이전 공부시간을 새 할 일에 임의로 배분하지 않아요.</p>}
      {(tracking.unknown_allocation || current?.unknown_allocation) && <p className="actual-unknown">이전 공부시간 배분 미확인 · 확인 가능한 새 구간만 합산해요. 과거 최초 시작과 지연은 평가하지 않아요.</p>}
      {!tracking.todos.some(todo => !todo.is_completed) && <button type="button" className="secondary" disabled={busy} onClick={onChoose}>집중할 할 일 선택</button>}
      {paused && <CurrentTodoChoice todos={tracking.todos} selectedIds={tracking.todos.filter(todo=>!todo.is_completed).map(todo=>todo.id)} currentId={focusId} disabled={busy} onChange={onFocus}/>}
      <details key={tracking.current_todo_id ?? 'unassigned'} className="actual-next"><summary>다음 할 일 ({next.length})</summary><ul>{next.map(todo=><li key={todo.id}><div><strong>{todo.title}</strong><small>{todo.local_date} · {todo.is_completed ? '완료' : '대기'}</small></div>{!todo.is_completed && <button type="button" className="secondary" disabled={busy || paused} onClick={()=>onSwitch(todo.id)} aria-label={`${todo.title}로 전환`}>집중 전환</button>}</li>)}</ul></details>
    </>}
  </div>;
}
