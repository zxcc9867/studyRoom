export function parseStudyCoaching(data) {
  const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  if (!data || !text(data.id, 100) || !['ai', 'rules'].includes(data.source)
    || !text(data.title, 200) || !text(data.firstAction, 500) || !text(data.reason, 1000)
    || !Array.isArray(data.evidence) || data.evidence.length > 8
    || !data.evidence.every(item => text(item, 500))
    || !text(data.createdAt, 100) || !Number.isFinite(Date.parse(data.createdAt))
    || ![null, 'helpful', 'difficult'].includes(data.feedback)) {
    throw new Error('코칭 응답을 확인하지 못했어요. 다시 시도해 주세요.');
  }
  return { id: data.id, source: data.source, title: data.title, firstAction: data.firstAction,
    reason: data.reason, evidence: [...data.evidence], createdAt: data.createdAt, feedback: data.feedback };
}

export async function requestStudyCoaching({ supabase, userId, payload, signal, fetchImpl = fetch }) {
  const { data, error } = await supabase.auth.getSession();
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (error || data.session?.user.id !== userId || !data.session?.access_token) {
    throw new Error('로그인 상태를 확인한 뒤 다시 시도해 주세요.');
  }
  const response = await fetchImpl('/api/study-coaching', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify(payload), signal,
  });
  if (!response.ok) {
    // Do not render arbitrary proxy/provider error bodies to the user.
    if (response.status === 401) throw new Error('로그인 상태를 확인한 뒤 다시 시도해 주세요.');
    if (response.status === 429) throw new Error('오늘의 코칭 요청 한도에 도달했어요. 잠시 쉬었다가 다시 시도해 주세요.');
    if (response.status === 404) throw new Error('선택한 기록을 찾지 못했어요. 화면을 새로고침해 주세요.');
    throw new Error('코칭 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
  let result;
  try { result = await response.json(); } catch { throw new Error('코칭 응답을 확인하지 못했어요. 다시 시도해 주세요.'); }
  if (payload.action === 'feedback') {
    if (result?.ok !== true) throw new Error('피드백을 저장하지 못했어요. 다시 시도해 주세요.');
    return result;
  }
  return parseStudyCoaching(result);
}
