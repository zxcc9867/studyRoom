import {useEffect, useRef, useState} from 'react';
import {atmosphereThemes, type AtmosphereBackground} from './atmosphere.mjs';
import {runBoundedRequest} from './dashboardData';
import {supabase} from './supabase';

type Scope = {owner: string | undefined; sessionId: string | undefined};
const table = 'study_session_scenery';

export async function seedStudySessionScenery(sessionId: string, theme: AtmosphereBackground, stillOwner: () => boolean) {
  // A delayed seed from the starting device must not overwrite a later choice.
  for (let attempt = 0; attempt < 2 && stillOwner(); attempt++) {
    try {
      const {error, status} = await runBoundedRequest(signal => supabase.from(table).upsert(
        {session_id:sessionId, theme_id:theme}, {onConflict:'session_id', ignoreDuplicates:true}
      ).abortSignal(signal));
      if (!error || status >= 400 && status < 500 && status !== 429) return;
    } catch {
      // A transient failure may be retried once, but never blocks studying.
    }
  }
}

export function useStudySessionScenery(owner: Scope['owner'], sessionId: Scope['sessionId'], visible: boolean) {
  const [shared, setShared] = useState<(Scope & {theme: AtmosphereBackground | null}) | null>(null);
  const [feedback, setFeedback] = useState<(Scope & {text: string}) | null>(null);
  const [saving, setSaving] = useState(false);
  const scope = useRef<Scope>({owner, sessionId});
  scope.current = {owner, sessionId};
  const activeWrite = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const matches = (value: Scope) => scope.current.owner === value.owner && scope.current.sessionId === value.sessionId;

  useEffect(() => {
    setSaving(false);
    return () => {
      activeWrite.current?.abort();
      activeWrite.current = null;
      revision.current++;
    };
  }, [owner, sessionId]);

  useEffect(() => {
    if (!owner || !sessionId || !visible) return;
    const target = {owner, sessionId};
    let read: AbortController | null = null;
    let unavailable = false;
    async function refresh() {
      if (read || unavailable || activeWrite.current || document.visibilityState === 'hidden') return;
      const request = new AbortController();
      const version = revision.current;
      read = request;
      try {
        const {data, error} = await runBoundedRequest(signal => supabase.from(table).select('theme_id').eq('session_id', target.sessionId).abortSignal(signal).maybeSingle(), {signal:request.signal});
        if (request.signal.aborted || version !== revision.current || !matches(target)) return;
        if (error) {
          // Older deployments can still render the device-local default.
          unavailable = ['42P01','PGRST205'].includes(error.code);
          return;
        }
        const theme = atmosphereThemes.find(item => item.id === data?.theme_id)?.id ?? null;
        setShared({ ...target, theme });
      } catch {
        // A scenery read never blocks or changes the current study session.
      } finally {
        if (read === request) read = null;
      }
    }
    const tick = () => { void refresh(); };
    tick();
    const interval = window.setInterval(tick, 10000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      read?.abort();
      window.clearInterval(interval);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [owner, sessionId, visible]);

  async function save(theme: AtmosphereBackground) {
    if (!owner || !sessionId || activeWrite.current) return;
    const target = {owner, sessionId};
    const request = new AbortController();
    activeWrite.current = request;
    revision.current++;
    setFeedback(null);
    setSaving(true);
    try {
      const {error} = await runBoundedRequest(signal => supabase.from(table).upsert(
        {session_id:sessionId, theme_id:theme}, {onConflict:'session_id'}
      ).abortSignal(signal), {signal:request.signal});
      if (error) throw error;
      if (!request.signal.aborted && matches(target)) setShared({...target, theme});
    } catch {
      if (!request.signal.aborted && matches(target)) setFeedback({...target, text:'이 세션의 배경을 다른 기기에 적용하지 못했어요. 다시 적용해 주세요.'});
    } finally {
      if (activeWrite.current === request) {
        activeWrite.current = null;
        setSaving(false);
      }
    }
  }

  return {theme: shared && matches(shared) ? shared.theme : null, notice: feedback && matches(feedback) ? feedback.text : '', save, saving};
}
