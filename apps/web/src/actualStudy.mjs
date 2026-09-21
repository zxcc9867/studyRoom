const seconds = value => Math.max(0, Math.floor(Number(value) || 0));

export function firstStartDelayMinutes(todo) {
  if (!todo.evaluation_eligible || todo.unknown_allocation || !todo.first_started_at || !todo.original_start_at) return null;
  return Math.max(0, Math.floor((Date.parse(todo.first_started_at) - Date.parse(todo.original_start_at)) / 60000));
}

export function formatActualDuration(value) {
  const total = seconds(value);
  return [total >= 3600 ? `${Math.floor(total / 3600)}시간` : '', total >= 60 ? `${Math.floor(total % 3600 / 60)}분` : '', `${total % 60}초`].filter(Boolean).join(' ');
}

export function formatActualInterval(interval) {
  return `${interval.local_date.replaceAll('-', '.')} ${interval.start_time.slice(0, 5)} → ${interval.end_date.replaceAll('-', '.')} ${interval.end_time.slice(0, 5)}`;
}

export function resolveCurrentTodo(ids, currentId) {
  if (ids.length === 1) return ids[0];
  return currentId && ids.includes(currentId) ? currentId : null;
}

export function getActualProgress(todo, tracking, nowMs, cameraTotal = 0, leaseExpiresAt = null) {
  const elapsed = seconds((nowMs - (tracking.received_at_ms ?? Date.parse(tracking.server_now))) / 1000);
  const leaseRemaining = leaseExpiresAt ? seconds((Date.parse(leaseExpiresAt) - Date.parse(tracking.server_now)) / 1000) : Infinity;
  const live = todo.open_started_at ? Math.min(elapsed, leaseRemaining) : 0;
  const pending = todo.open_started_at ? Math.max(0, seconds(cameraTotal) - seconds(tracking.excluded_seconds)) : 0;
  const known = Math.max(0, seconds(todo.known_seconds) + live - pending);
  return { known, remaining: todo.target_seconds === null ? null : Math.max(0, seconds(todo.target_seconds) - known) };
}

export function reconcileCameraCounter(carried, localPresence, serverTotal, firstHydration = false) {
  if (firstHydration) return Math.max(seconds(carried), seconds(serverTotal));
  return Math.max(seconds(carried) + seconds(localPresence), seconds(serverTotal)) - seconds(localPresence);
}

export function actualStudyErrorMessage(error) {
  const message = typeof error === 'string' ? error : error?.message || '공부 상태를 확인하지 못했어요.';
  if (message.includes('UNREPRESENTABLE_SCHEDULE')) return '이 일정은 현재 시간표에 정확히 표시할 수 없어요. 날짜 경계나 일광절약시간 전환을 확인하고 계획 시간을 조정해 주세요. 변경된 내용은 없어요.';
  if (message.includes('CASCADE_LIMIT')) return '이동할 일정이 너무 많아 전체 변경을 확인하지 못했어요. 계획을 나눈 뒤 다시 시도해 주세요.';
  if (message.includes('RECOVERY_REQUIRED') || message.includes('Recovery routine required')) return '회복 루틴을 제출한 뒤 공부를 시작해 주세요.';
  if (message.includes('CURRENT_TODO') || message.includes('INVALID_SELECTION')) return '먼저 집중할 할 일 하나를 선택해 주세요.';
  if (message.includes('LEASE_EXPIRED')) return '세션 유지 시간이 지났어요. 학습 정보를 새로 불러와 주세요.';
  return message;
}

// The intent owns its UUID and immutable preview through uncertain transport retries.
// A refreshed proposal always returns to the UI for an explicit new confirmation.
export function createActualStudyFlow({ rpc, now = Date.now, uuid = () => crypto.randomUUID() }) {
  async function prepare(input) {
    const preview = await rpc('preview_actual_study_action', {
      p_action: input.action, p_todo_ids: input.todoIds, p_current_todo_id: input.currentTodoId,
      p_session_id: input.sessionId ?? null, p_excluded_seconds: seconds(input.excludedSeconds),
    });
    if (preview.blocking_error || !preview.cascade_complete) throw new Error(actualStudyErrorMessage(preview.blocking_error || '전체 일정 변경을 확인하지 못했어요.'));
    return { input: { ...input }, preview, requestId: uuid(), uncertain: false };
  }
  async function confirm(intent, cameraTotal) {
    const refresh = async () => ({ kind: 'review', intent: await prepare({ ...intent.input, excludedSeconds: cameraTotal }) });
    if (!intent.uncertain && (now() >= Date.parse(intent.preview.expires_at) || seconds(cameraTotal) !== intent.preview.excluded_seconds)) return refresh();
    try {
      const result = await rpc('confirm_actual_study_action', { p_preview: intent.preview, p_request_id: intent.requestId });
      return { kind: 'committed', result };
    } catch (error) {
      if (String(error?.message).includes('ACTUAL_STUDY_STALE_PREVIEW')) { intent.uncertain = false; return refresh(); }
      // PostgREST SQL errors are definitive; network failures and bounded timeouts are not.
      intent.uncertain = !error?.code;
      throw error;
    }
  }
  return { prepare, confirm };
}

export async function loadPlanningAdherence(client, range, signal) {
  const { data, error } = await client.rpc('get_actual_study_report', { p_start_date: range.startDate, p_end_date: range.endDate }).abortSignal(signal);
  if (error) throw error;
  if (!data || !Array.isArray(data.plans)) throw new Error('Invalid planning report');
  return data;
}
