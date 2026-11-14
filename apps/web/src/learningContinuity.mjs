const REQUEST_TIMEOUT_MS = 15_000;
const REASONS = new Set(['none', 'phone', 'environment', 'fatigue', 'schedule', 'other']);
const invalid = () => new Error('Invalid learning continuity data');
function object(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value; }
function uuid(value) { if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw invalid(); return value; }
function text(value, max, nullable = false) { if (nullable && value == null) return ''; if (typeof value !== 'string' || [...value].length > max) throw invalid(); return value.trim(); }
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalid();
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) throw invalid();
  return value;
}
function stamp(value) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) throw invalid(); return value; }
function clock(value) { if (value !== null && (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?$/.test(value))) throw invalid(); return value; }
function score(value) { if (value !== null && (!Number.isInteger(value) || value < 1 || value > 5)) throw invalid(); return value; }
function reason(value) { if (value !== null && !REASONS.has(value)) throw invalid(); return value; }
export function validateLearningResourceUrl(value) {
  const raw = text(value,2048,true);
  if (!raw) return '';
  if (!/^https?:\/\/[^/@\s\\?#]+([/?#][^\s\\]*)?$/i.test(raw) || /[\u0000-\u001f\u007f]/.test(raw)) throw invalid();
  let url; try { url = new URL(raw); } catch { throw invalid(); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw invalid();
  return raw;
}
export function normalizeLearningReflection(value) {
  object(value);
  return { focusScore: score(value.focusScore ?? null), energyScore: score(value.energyScore ?? null),
    interruptionReason: reason(value.interruptionReason ?? null), note: text(value.note,500,true), nextAction: text(value.nextAction,160,true),
    contextTodoId: value.contextTodoId == null ? null : uuid(value.contextTodoId), resourceUrl: validateLearningResourceUrl(value.resourceUrl), resourcePosition: text(value.resourcePosition,160,true) };
}
function wireReflection(value) {
  const r = normalizeLearningReflection(value);
  return {focus_score:r.focusScore,energy_score:r.energyScore,interruption_reason:r.interruptionReason,note:r.note,next_action:r.nextAction,
    context_todo_id:r.contextTodoId,resource_url:r.resourceUrl,resource_position:r.resourcePosition};
}
function result(value) {
  object(value); uuid(value.reflectionId); uuid(value.sessionId); if (value.todoId !== null) uuid(value.todoId);
  if (value.todoTitle !== null && typeof value.todoTitle !== 'string') throw invalid();
  date(value.localDate); stamp(value.startedAt); stamp(value.endedAt); stamp(value.updatedAt);
  text(value.note,500); text(value.nextAction,160); validateLearningResourceUrl(text(value.resourceUrl,2048)); text(value.resourcePosition,160);
  score(value.focusScore); score(value.energyScore); reason(value.interruptionReason);
  return value;
}
function bookmark(value) {
  object(value); uuid(value.reflectionId); uuid(value.sessionId); uuid(value.todoId);
  if (typeof value.todoTitle !== 'string') throw invalid();
  date(value.localDate); clock(value.startTime); clock(value.endTime); stamp(value.todoUpdatedAt); stamp(value.updatedAt);
  text(value.nextAction,160); validateLearningResourceUrl(text(value.resourceUrl,2048)); text(value.resourcePosition,160);
  if (!value.nextAction.trim() && !value.resourceUrl.trim() && !value.resourcePosition.trim()) throw invalid();
  return value;
}
async function request(client, name, args, {signal} = {}) {
  if (signal?.aborted) throw new DOMException('Request aborted','AbortError');
  const controller = new AbortController();
  const abort = () => controller.abort(new DOMException('Request aborted','AbortError'));
  signal?.addEventListener('abort',abort,{once:true});
  let onAbort;
  const cancelled = new Promise((_,reject) => { onAbort = () => reject(controller.signal.reason); controller.signal.addEventListener('abort',onAbort,{once:true}); });
  const timeout = setTimeout(() => controller.abort(new Error('Learning continuity request timed out; committed state is unknown')),REQUEST_TIMEOUT_MS);
  try {
    if (!client || typeof client.rpc !== 'function') throw new Error('Learning continuity unavailable');
    const query = client.rpc(name,args);
    if (!query || typeof query.abortSignal !== 'function') throw new Error('Learning continuity unavailable: abort-aware transport required');
    const response = await Promise.race([query.abortSignal(controller.signal),cancelled]);
    if (controller.signal.aborted) throw controller.signal.reason;
    if (!response || response.error) {
      const error = new Error('Learning continuity unavailable: request failed');
      if (response?.error?.code) error.code = response.error.code;
      throw error;
    }
    return response.data;
  } finally {
    clearTimeout(timeout); signal?.removeEventListener('abort',abort); controller.signal.removeEventListener('abort',onAbort);
  }
}
export async function loadLearningContinuity(client, studyDate, options = {}) {
  const data = object(await request(client,'learning_continuity_snapshot',{p_study_date:date(studyDate)},options));
  if (data.version !== 1 || !Array.isArray(data.bookmarks) || !Array.isArray(data.results)) throw invalid();
  data.bookmarks.forEach(bookmark); data.results.forEach(row => { result(row); if (row.localDate !== studyDate || !row.note.trim()) throw invalid(); });
  return data;
}
export async function completeLearningSession(client, {sessionId, excludedSeconds, completedTodoIds, reflection}, options = {}) {
  uuid(sessionId);
  if (!Number.isInteger(excludedSeconds) || excludedSeconds<0 || !Array.isArray(completedTodoIds)) throw invalid();
  completedTodoIds.forEach(uuid);
  const data = object(await request(client,'complete_learning_session',{p_session_id:sessionId,p_excluded_seconds:excludedSeconds,p_completed_todo_ids:completedTodoIds,p_reflection:wireReflection(reflection)},options));
  const session = object(data.session); result(data.reflection);
  if (data.version !== 1 || session.id !== sessionId || session.status !== 'completed' || data.reflection.sessionId !== sessionId || !Number.isInteger(session.duration_seconds) || session.duration_seconds<0) throw invalid();
  uuid(session.user_id); date(session.local_date); stamp(session.started_at); stamp(session.ended_at); stamp(session.created_at); stamp(session.updated_at);
  if (!Number.isInteger(session.paused_seconds) || session.paused_seconds<0) throw invalid();
  for (const field of ['paused_at','lease_expires_at','lease_warning_sent_at']) if (session[field] !== null) stamp(session[field]);
  if (session.local_date !== data.reflection.localDate || Date.parse(session.ended_at) < Date.parse(session.started_at)) throw invalid();
  return data;
}
export async function saveLearningReflection(client, {sessionId, reflection, expectedUpdatedAt = null}, options = {}) {
  uuid(sessionId); if (expectedUpdatedAt !== null) stamp(expectedUpdatedAt);
  const data = result(await request(client,'save_learning_reflection',{p_session_id:sessionId,p_reflection:wireReflection(reflection),p_expected_updated_at:expectedUpdatedAt},options));
  if (data.sessionId !== sessionId) throw invalid();
  return data;
}
export async function updateLearningBookmark(client, {reflectionId, expectedUpdatedAt, nextAction, resourceUrl, resourcePosition}, options = {}) {
  const data = result(await request(client,'update_learning_bookmark',{p_reflection_id:uuid(reflectionId),p_expected_updated_at:stamp(expectedUpdatedAt),p_next_action:text(nextAction,160,true),p_resource_url:validateLearningResourceUrl(resourceUrl),p_resource_position:text(resourcePosition,160,true)},options));
  if (data.reflectionId !== reflectionId) throw invalid();
  return data;
}
export async function prepareLearningTodo(client, {todoId, expectedLocalDate, expectedUpdatedAt}, options = {}) {
  const data = object(await request(client,'prepare_learning_todo',{p_todo_id:uuid(todoId),p_expected_local_date:date(expectedLocalDate),p_expected_updated_at:stamp(expectedUpdatedAt)},options));
  if (data.version !== 1 || data.todoId !== todoId) throw invalid();
  date(data.localDate); stamp(data.updatedAt); clock(data.startTime); clock(data.endTime);
  return data;
}
