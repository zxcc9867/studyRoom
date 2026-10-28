import { useEffect, useId, useRef, useState } from 'react';
import { timeZoneChoices, validTimeZone } from './profileTimeZone.mjs';
import './profileTimeZone.css';

const choices = timeZoneChoices();
export function TimeZoneField({ value, onChange, disabled = false }: {value:string;onChange:(value:string)=>void;disabled?:boolean}) {
  const id = useId();
  return <label className="profile-zone-field">시간대 검색·선택
    <input list={id} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} required autoComplete="off" placeholder="Asia/Seoul" />
    <datalist id={id}>{choices.map(zone => <option key={zone} value={zone}>{zone === 'Asia/Seoul' ? '서울' : zone === 'Asia/Tokyo' ? '도쿄' : zone}</option>)}</datalist>
    <small>서울: Asia/Seoul · 도쿄: Asia/Tokyo</small>
  </label>;
}

export default function TimeZonePicker({ value, onSave }: {value:string;onSave:(zone:string)=>Promise<void>}) {
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const changeButton = useRef<HTMLButtonElement>(null);
  const editor = useRef<HTMLFormElement>(null);
  const editorId = useId();
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) editor.current?.querySelector('input')?.focus(); }, [editing]);
  function finishEditing() { setEditing(false); requestAnimationFrame(() => changeButton.current?.focus()); }
  return <div className="profile-timezone">
    <div className="settings-edit-row"><div><h3>시간대</h3><p className="settings-current-value">{value}</p></div><button ref={changeButton} type="button" className="secondary" aria-label="시간대 변경" aria-expanded={editing} aria-controls={editing ? editorId : undefined} disabled={editing || busy} onClick={() => { setDraft(value); setError(''); setMessage(''); setEditing(true); }}>변경</button></div>
    {editing && <form id={editorId} ref={editor} className="settings-inline-editor" onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    setError(''); setMessage('');
    if (!validTimeZone(draft)) { setError('목록에서 올바른 시간대를 선택해 주세요.'); return; }
    setBusy(true);
    try { await onSave(draft); setMessage('시간대를 저장했어요. 앞으로의 일정과 알림에 적용됩니다.'); finishEditing(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '시간대를 저장하지 못했어요.'); }
    finally { setBusy(false); }
  }}>
    <TimeZoneField value={draft} onChange={setDraft} disabled={busy} />
    {browserZone !== draft && <button type="button" className="plain" disabled={busy} onClick={() => setDraft(browserZone)}>기기 시간대 사용: {browserZone}</button>}
    <p>캘린더와 알림은 선택한 지역의 시간을 사용합니다. 과거 기록은 유지됩니다.</p>
    <div className="settings-actions"><button type="submit" className="primary" disabled={busy || draft === value}>{busy ? '저장 중…' : '시간대 저장'}</button><button type="button" className="secondary" disabled={busy} onClick={() => { setDraft(value); setError(''); finishEditing(); }}>취소</button></div>
    {error && <p role="alert" className="profile-zone-error">{error}</p>}
  </form>}
  {message && <p role="status">{message}</p>}
  </div>;
}
