import { useEffect, useId, useState } from 'react';
import { timeZoneChoices, validTimeZone } from './coachTime.mjs';

const choices = timeZoneChoices();
export function TimeZoneField({ value, onChange, disabled = false }: {value:string;onChange:(value:string)=>void;disabled?:boolean}) {
  const id = useId();
  return <label className="coach-field">시간대 검색·선택
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
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  useEffect(() => { setDraft(value); }, [value]);
  return <form className="career-coach coach-timezone" onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    setError(''); setMessage('');
    if (!validTimeZone(draft)) { setError('목록에서 올바른 시간대를 선택해 주세요.'); return; }
    setBusy(true);
    try { await onSave(draft); setMessage('시간대를 저장했어요. 앞으로의 일정과 알림에 적용됩니다.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '시간대를 저장하지 못했어요.'); }
    finally { setBusy(false); }
  }}>
    <h3>나의 시간대</h3><TimeZoneField value={draft} onChange={setDraft} disabled={busy} />
    {browserZone !== draft && <button type="button" className="plain" disabled={busy} onClick={() => setDraft(browserZone)}>기기 시간대 사용: {browserZone}</button>}
    <p>캘린더와 알림은 선택한 지역의 시간을 사용합니다. 과거 기록은 유지됩니다.</p>
    <button type="submit" className="secondary" disabled={busy || draft === value}>{busy ? '저장 중…' : '시간대 저장'}</button>
    {error && <p role="alert" className="coach-error">{error}</p>}<p role="status">{message}</p>
  </form>;
}
