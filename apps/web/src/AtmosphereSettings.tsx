import {useId, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import {atmosphereThemes, getAtmosphereController, type AtmospherePreferences} from './atmosphere.mjs';

export default function AtmosphereSettings() {
  const controller = getAtmosphereController(window);
  const current = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [draft, setDraft] = useState<AtmospherePreferences | null>(null);
  const id = useId();
  const entry = useRef<HTMLButtonElement>(null);
  const editor = useRef<HTMLFieldSetElement>(null);
  const editing = draft !== null;
  useLayoutEffect(() => { if (editing) editor.current?.querySelector<HTMLInputElement>('input:checked')?.focus(); }, [editing]);
  function closeEditor() { setDraft(null); entry.current?.focus(); }
  const currentTheme = atmosphereThemes.find(theme => theme.id === current.background)!;
  const liveAvailable = atmosphereThemes.find(theme => theme.id === draft?.background)?.live;
  return <section className="atmosphere-settings" aria-label="배경 테마">
    <div className="settings-edit-row">
      <div><h3>배경 테마</h3><p className="settings-current-value atmosphere-current">{currentTheme.name}{current.motion === 'live' ? ' · 라이브' : ' · 정적'}</p></div>
      <button ref={entry} type="button" className="secondary" aria-label="배경 테마 변경" aria-expanded={editing} aria-controls={`${id}-editor`} onClick={() => draft ? closeEditor() : setDraft({background: current.background, motion: current.motion, intensity: current.intensity, paused: current.paused})}>{editing ? '닫기' : '변경'}</button>
    </div>
    {draft && <fieldset ref={editor} id={`${id}-editor`} className="settings-inline-editor atmosphere-editor" onKeyDown={event => {if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); closeEditor();}}}>
      <legend>배경 테마 편집</legend>
      <div className="atmosphere-options">{atmosphereThemes.map(theme => <label key={theme.id} className="atmosphere-option">
        <input type="radio" name={`${id}-background`} value={theme.id} checked={draft.background === theme.id} onChange={() => setDraft({...draft, background: theme.id, motion: theme.live ? draft.motion : 'static', paused: false})} />
        <span className={`atmosphere-thumbnail atmosphere-thumbnail--${theme.id}`} aria-hidden="true">{theme.id !== 'charcoal' && <img src={`/themes/${theme.id}-thumb.webp`} alt="" loading="lazy" />}</span>
        <span className="atmosphere-option-name">{theme.name}<span className="atmosphere-selected" aria-hidden="true">{draft.background === theme.id ? '✓' : ''}</span></span>
      </label>)}</div>
      {liveAvailable && <>
        <fieldset className="atmosphere-controls"><legend>배경 움직임</legend>
          {(['static', 'live'] as const).map(value => <label key={value}><input type="radio" name={`${id}-motion`} checked={draft.motion === value} onChange={() => setDraft({...draft, motion: value, paused: false})} /><span>{value === 'live' ? '라이브' : '정적'}</span></label>)}
        </fieldset>
        {draft.motion === 'live' && <fieldset className="atmosphere-controls"><legend>움직임 강도</legend>
          {(['subtle', 'normal'] as const).map(value => <label key={value}><input type="radio" name={`${id}-intensity`} checked={draft.intensity === value} onChange={() => setDraft({...draft, intensity: value})} /><span>{value === 'subtle' ? '잔잔하게' : '보통'}</span></label>)}
        </fieldset>}
      </>}
      <p>이 기기에 적용됩니다. 라이브 효과는 소리 없이 재생됩니다.</p>
      <div className="settings-actions"><button type="button" className="secondary" onClick={closeEditor}>취소</button><button type="button" className="primary" onClick={() => {controller.setPreferences(draft); closeEditor();}}>적용</button></div>
    </fieldset>}
    {current.motion === 'live' && <div className="atmosphere-playback"><span>{current.reducedMotion ? '움직임 줄이기 설정으로 정지 중' : current.playing ? '라이브 배경 재생 중' : '라이브 배경 일시정지'}</span><button type="button" className="secondary" aria-pressed={current.paused} onClick={() => controller.setPreferences({...current, paused: !current.paused})}>{current.paused ? '재생' : '일시정지'}</button></div>}
    {!current.persistent && <p role="status">배경은 적용했지만 기기에 저장하지 못했어요. 다시 열면 이전 설정으로 돌아갈 수 있어요.</p>}
  </section>;
}
