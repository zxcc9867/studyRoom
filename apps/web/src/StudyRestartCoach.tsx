import { useEffect, useId, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requestStudyCoaching, type CoachingFeedback, type StudyCoaching } from './studyCoaching.mjs';
import './studyRestartCoach.css';

type Props = {
  supabase: SupabaseClient;
  userId: string;
  todos: { id: string; title: string; is_completed: boolean; local_date: string }[];
  onPlanAction: (action: string) => void;
  onAddTodo: () => void;
};

export default function StudyRestartCoach({ supabase, userId, todos, onPlanAction, onAddTodo }: Props) {
  const choices = todos.filter(todo => !todo.is_completed);
  const [selectedId, setSelectedId] = useState('');
  const [coaching, setCoaching] = useState<StudyCoaching | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requestRef = useRef<{ controller: AbortController; timer: ReturnType<typeof setTimeout> } | null>(null);
  const selectId = useId();
  const disclosureId = useId();
  const selected = choices.find(todo => todo.id === selectedId);

  function cancelRequest() {
    if (requestRef.current) {
      clearTimeout(requestRef.current.timer);
      requestRef.current.controller.abort();
      requestRef.current = null;
    }
  }
  useEffect(() => () => cancelRequest(), [userId]);
  useEffect(() => {
    if (selectedId && !selected) {
      cancelRequest();
      setSelectedId(''); setCoaching(null); setBusy(false); setFeedbackBusy(false);
      setNotice('할 일 상태가 바뀌었어요. 다시 선택해 주세요.');
    }
  }, [selectedId, selected]);

  async function submit(feedback?: CoachingFeedback) {
    if (requestRef.current || !selected || (feedback && !coaching)) return;
    const controller = new AbortController();
    const request = { controller, timer: setTimeout(() => {
      if (requestRef.current?.controller !== controller) return;
      controller.abort(); requestRef.current = null;
      setBusy(false); setFeedbackBusy(false);
      setError('응답 시간이 길어졌어요. 잠시 후 다시 시도해 주세요.');
    }, 65000) };
    requestRef.current = request;
    setError(''); setNotice('');
    if (feedback) setFeedbackBusy(true); else { setBusy(true); setCoaching(null); }
    try {
      const result = await requestStudyCoaching({ supabase, userId, signal: controller.signal,
        payload: feedback && coaching ? { action: 'feedback', coachingId: coaching.id, feedback } : { action: 'generate', todoId: selected.id },
      });
      if (requestRef.current !== request) return;
      if (feedback) {
        setCoaching(current => current ? { ...current, feedback } : current);
        setNotice('피드백을 저장했어요.');
      } else if ('firstAction' in result) setCoaching(result);
    } catch (failure) {
      if (requestRef.current !== request) return;
      setError(controller.signal.aborted ? '응답 시간이 길어졌어요. 잠시 후 다시 시도해 주세요.'
        : failure instanceof Error ? failure.message : '요청을 처리하지 못했어요. 다시 시도해 주세요.');
    } finally {
      clearTimeout(request.timer);
      if (requestRef.current === request) { requestRef.current = null; setBusy(false); setFeedbackBusy(false); }
    }
  }

  return <div className="study-restart-coach" aria-label="10분 재시작 코치">
    <div><p className="eyebrow">작게 시작하는 공부</p><h3>10분 재시작 코치</h3>
      <p>시작이 막막할 때, 남아 있는 할 일 하나를 작은 첫 행동으로 바꿔보세요.</p></div>
    {choices.length === 0 ? <div>
      <p>오늘까지의 미완료 할 일이 없어요. 공부할 일을 먼저 적어주세요.</p>
      <button type="button" className="secondary" onClick={onAddTodo}>할 일 추가하기</button>
    </div> : <>
      <label htmlFor={selectId}>다시 시작할 할 일</label>
      <select id={selectId} value={selectedId} aria-describedby={disclosureId} onChange={event => {
        cancelRequest(); setSelectedId(event.target.value); setCoaching(null); setError(''); setNotice(''); setBusy(false); setFeedbackBusy(false);
      }}>
        <option value="">할 일을 선택해 주세요</option>
        {choices.map(todo => <option key={todo.id} value={todo.id}>{todo.local_date} · {todo.title}</option>)}
      </select>
      <p id={disclosureId} className="coach-disclosure">선택한 할 일 제목과 최근 28일 학습 요약이 외부 AI로 전달됩니다. 무료 모델만 사용합니다. AI를 사용할 수 없으면 기본 조언을 제공합니다.</p>
      <div className="coach-actions">
        <button type="button" className="secondary" disabled={!selected || busy || feedbackBusy} onClick={() => void submit()}>{busy ? '시작 행동을 찾고 있어요…' : '10분 시작 행동 받기'}</button>
        {(busy || feedbackBusy) && <button type="button" className="plain" onClick={() => { cancelRequest(); setBusy(false); setFeedbackBusy(false); setNotice('요청을 취소했어요.'); }}>취소</button>}
      </div>
    </>}
    {error && <p className="coach-error" role="alert">{error}</p>}
    <p className="coach-status" role="status">{busy ? '코칭을 준비하고 있어요.' : feedbackBusy ? '피드백을 저장하고 있어요.' : notice}</p>
    {coaching && <article className="coach-result" aria-label="추천 시작 행동">
      <span className="coach-source">{coaching.source === 'ai' ? '무료 AI 제안' : '기록 기반 기본 조언'}</span>
      <h4>{coaching.title}</h4><p className="coach-first-action">{coaching.firstAction}</p><p>{coaching.reason}</p>
      {coaching.evidence.length > 0 && <details><summary>제안에 사용한 기록</summary><ul>{coaching.evidence.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}
      <button type="button" className="secondary" onClick={() => onPlanAction(coaching.firstAction)}>계획에 넣기</button>
      <p className="coach-disclosure">할 일 입력창에서 수정하고 저장할 수 있어요. 기존 할 일은 그대로 유지됩니다.</p>
      <div className="coach-feedback" role="group" aria-label="코칭 피드백">
        <span>시도해 본 뒤 알려주세요</span>
        <button type="button" className="plain" disabled={feedbackBusy || busy} aria-pressed={coaching.feedback === 'helpful'} onClick={() => void submit('helpful')}>도움 됐어요</button>
        <button type="button" className="plain" disabled={feedbackBusy || busy} aria-pressed={coaching.feedback === 'difficult'} onClick={() => void submit('difficult')}>어려웠어요</button>
      </div>
    </article>}
  </div>;
}
