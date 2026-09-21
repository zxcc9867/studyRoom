import { AccessibleDialog } from './AccessibleDialog';
import { formatActualDuration, formatActualInterval, type ActualIntent } from './actualStudy.mjs';

export function CurrentTodoChoice({ todos, selectedIds, currentId, disabled, onChange }: {todos: {id:string;title:string}[]; selectedIds:string[]; currentId:string|null;disabled:boolean;onChange:(id:string)=>void}) {
  if(selectedIds.length < 2) return null;
  return <fieldset className="actual-focus-choice" disabled={disabled}><legend>먼저 집중할 일 하나</legend>{todos.filter(todo=>selectedIds.includes(todo.id)).map(todo=><label key={todo.id}><input type="radio" name="current-session-todo" value={todo.id} checked={currentId===todo.id} onChange={()=>onChange(todo.id)}/><span>{todo.title}</span></label>)}</fieldset>;
}

export function ActualStudyConfirmation({ intent, busy, notice, error, onConfirm, onCancel }: {intent:ActualIntent;busy:boolean;notice:string;error:string;onConfirm:()=>void;onCancel:()=>void}) {
  const action=intent.preview.action==='start'?'시작':intent.preview.action==='resume'?'재개':'전환';
  return <AccessibleDialog className="todo-modal actual-confirmation" ariaLabel="공부와 일정 변경 확인" onClose={()=>{if(!busy && !intent.uncertain)onCancel();}}>
    <p className="eyebrow">review your plan</p><h3>공부와 일정 변경 확인</h3>
    <p>{intent.preview.changes.length}개 일정이 아래와 같이 바뀌어요. 원래 계획과 이미 공부한 기록은 그대로 남아요.</p>
    <p>현재 할 일 남은 분량 · <strong>{intent.preview.remaining_seconds===null?'시간 미지정':formatActualDuration(intent.preview.remaining_seconds)}</strong></p>
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
    {intent.uncertain && <p role="status">결과가 불확실해요. 중복 변경을 막기 위해 같은 요청으로 결과를 다시 확인해 주세요.</p>}
    <ol className="actual-changes">{intent.preview.changes.map(change=><li key={change.todo_id}><h4>{change.title}</h4><dl><div><dt>변경 전</dt><dd>{formatActualInterval(change.before)}</dd></div><div><dt>변경 후</dt><dd>{formatActualInterval(change.after)}</dd></div></dl></li>)}</ol>
    <div className="reminder-actions"><button type="button" className="secondary" data-dialog-initial-focus disabled={busy || intent.uncertain} onClick={onCancel}>취소 · 그대로 두기</button><button type="button" className="primary" disabled={busy} onClick={onConfirm}>{busy?'확인 중…':intent.uncertain?'같은 요청 다시 확인':`변경 확인 후 ${action}`}</button></div>
  </AccessibleDialog>;
}
