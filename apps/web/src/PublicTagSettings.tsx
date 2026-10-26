import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createTeamStudyController, type TeamState } from './teamStudyClient.mjs';
import { normalizePublicTag } from './teamStudyPresentation.mjs';
import './PublicTagSettings.css';

export default function PublicTagSettings({ supabase, userId, registered, onPendingChange }: {
  supabase: SupabaseClient;
  userId: string;
  registered: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const controller = useRef<ReturnType<typeof createTeamStudyController> | null>(null);
  const [state, setState] = useState<TeamState>({ snapshot: null, loading: true, error: '', transport: 'checking', syncedAt: 0 });
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const current = createTeamStudyController(supabase, userId, { onState: setState });
    controller.current = current;
    if (registered) void current.refresh();
    return () => {
      current.dispose();
      if (controller.current === current) controller.current = null;
    };
  }, [supabase, userId, registered]);
  useEffect(() => { setDraft(state.snapshot?.tag ?? ''); }, [state.snapshot?.tag]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending || state.loading || state.error || !state.snapshot) return;
    setError('');
    setNotice('');
    const tag = normalizePublicTag(draft);
    if (!tag) {
      setError('이름#식별자 양쪽을 2~20자로 입력해 주세요.');
      return;
    }
    const current = controller.current;
    if (!current) return;
    setPending(true);
    onPendingChange?.(true);
    try {
      await current.action('set_tag', { tag });
      if (controller.current !== current) return;
      setDraft(tag);
      setNotice('공개 태그를 저장했어요.');
    } catch (failure) {
      if (controller.current === current) setError(failure instanceof Error ? failure.message : '태그를 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      onPendingChange?.(false);
      if (controller.current === current) setPending(false);
    }
  }

  return <div className="public-tag-settings" aria-busy={registered && (state.loading || pending)}>
    <h3>내 공개 태그</h3>
    <p>친구가 전체 태그로 나를 찾아 초대할 수 있어요. 이메일과는 별개예요.</p>
    {!registered ? <p>공개 태그는 정식 계정으로 로그인한 뒤 설정할 수 있어요.</p> : <>
      {state.loading && <p role="status">공개 태그를 확인하고 있어요…</p>}
      {(error || state.error) && <p role="alert">{error || state.error}</p>}
      <form onSubmit={save}>
        <label htmlFor="settings-public-tag">공개 사용자 태그</label>
        <input id="settings-public-tag" value={draft} onChange={event => { setDraft(event.target.value); setError(''); setNotice(''); }} maxLength={41} placeholder="A스타#지니" autoComplete="off" aria-describedby="settings-public-tag-help" aria-invalid={Boolean(error)} disabled={state.loading || pending || !state.snapshot} />
        <p id="settings-public-tag-help">이름#식별자 · 양쪽 2~20자, 한글·영문·숫자·밑줄·하이픈</p>
        <div className="settings-actions"><button className="secondary" type="submit" disabled={pending || state.loading || Boolean(state.error) || !state.snapshot || !draft.trim()}>{pending ? '저장 중…' : '태그 저장'}</button>{state.error && <button className="plain" type="button" onClick={() => void controller.current?.refresh()}>태그 다시 확인</button>}</div>
      </form>
      {notice && <p role="status">{notice}</p>}
    </>}
  </div>;
}
