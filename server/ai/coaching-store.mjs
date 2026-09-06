import { CoachingError } from './coaching.mjs';

export function createCoachingStore({ env = process.env, token, fetchImpl = fetch, signal }) {
  const base = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) throw new CoachingError(503, '코칭 연결을 준비하고 있어요.');
  const headers = { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  async function request(path, options = {}) {
    let response;
    try { response = await fetchImpl(`${base.replace(/\/$/, '')}${path}`, { ...options, headers, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000), redirect: 'error' }); }
    catch { throw new CoachingError(503, '기록에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    if (!response.ok) throw new CoachingError(path === '/auth/v1/user' ? 401 : 503, path === '/auth/v1/user' ? '다시 로그인해 주세요.' : '기록을 불러오거나 저장하지 못했어요.');
    return response.json();
  }
  async function rows(table, query) {
    const result = await request(`/rest/v1/${table}?${new URLSearchParams(query)}`);
    if (!Array.isArray(result)) throw new CoachingError(503, '기록을 확인하지 못했어요.');
    // Do not make confident summaries of silently truncated histories.
    if (result.length >= 1000) throw new CoachingError(503, '기록이 많아 코칭 요약을 준비하지 못했어요.');
    return result;
  }
  return {
    async authenticate() {
      const user = await request('/auth/v1/user');
      if (!user?.id || user.is_anonymous === true) throw new CoachingError(401, '다시 로그인해 주세요.');
      return user.id;
    },
    async load(userId, todoId, now) {
      const scoped = { user_id: `eq.${userId}`, limit: '1000' };
      const profiles = await rows('profiles', { ...scoped, select: 'time_zone' });
      let today;
      try { today = new Intl.DateTimeFormat('en-CA', { timeZone: profiles[0]?.time_zone || 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now)); }
      catch { throw new CoachingError(503, '시간대 설정을 확인해 주세요.'); }
      const firstDay = new Date(Date.parse(`${today}T00:00:00Z`) - 27 * 86400000).toISOString().slice(0, 10);
      const dateRange = `and(local_date.gte.${firstDay},local_date.lte.${today})`;
      const [selected, sessions, todos, reflections] = await Promise.all([
        rows('study_todos', { ...scoped, select: 'id,title,is_completed', id: `eq.${todoId}`, local_date: `lte.${today}` }),
        rows('study_sessions', { ...scoped, select: 'id,local_date,status', or: `(${dateRange})` }),
        rows('study_todos', { ...scoped, select: 'is_completed', or: `(${dateRange})` }),
        rows('study_session_reflections', { ...scoped, select: 'session_id,study_sessions!inner(local_date)', 'study_sessions.and': `(local_date.gte.${firstDay},local_date.lte.${today})`, created_at: `lte.${now}` }),
      ]);
      const completedIds = new Set(sessions.filter((s) => s.status === 'completed').map((s) => s.id));
      return { todo: selected[0], sessions, todos, reflections: reflections.filter((r) => completedIds.has(r.session_id)) };
    },
    mutate(payload) { return request('/rest/v1/rpc/study_coaching_mutate', { method: 'POST', body: JSON.stringify({ p_input: payload }) }); },
  };
}
