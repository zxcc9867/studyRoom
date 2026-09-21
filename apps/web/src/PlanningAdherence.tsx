import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadPlanningAdherence, type PlanningReport } from './actualStudy.mjs';
import { createStudyReportRequest, getStudyReportState, type StudyReportState } from './studyReportData.mjs';
import type { StudyReportRange } from './studyReports.mjs';

export default function PlanningAdherence({client,userId,range,revision}:{client:SupabaseClient;userId:string;range:StudyReportRange;revision:string}) {
  const [retry,setRetry]=useState(0);
  const [state,setState]=useState<StudyReportState<PlanningReport>|null>(null);
  const request=useMemo(()=>createStudyReportRequest<PlanningReport>(),[]);
  const key=JSON.stringify([userId,range,revision,retry]);
  useEffect(()=>{void request.run(key,signal=>loadPlanningAdherence(client,range,signal),setState);return request.cancel;},[request,key,client,range]);
  const current=getStudyReportState(state,key);
  return <section className="planning-adherence" aria-label="계획 준수"><h4>계획과 실제 시작</h4><p>공부 성과와 별도로 돌아봐요. 공부시간·출석·숲 보상에는 감점이 없어요.</p>
    {current.status==='loading'?<p role="status">계획 기록을 확인하고 있어요.</p>:current.status==='error'?<div role="alert"><p>계획 기록을 불러오지 못했어요. 기존 공부 성과는 그대로 볼 수 있어요.</p><button type="button" className="secondary" onClick={()=>setRetry(value=>value+1)}>계획 기록 다시 확인</button></div>:current.status==='ready'?<>
      <dl><div><dt>계획대로 시작</dt><dd>{current.data.on_time_ratio===null?'평가 없음':`${Math.round(current.data.on_time_ratio*100)}%`}</dd></div><div><dt>일정 조정</dt><dd>{current.data.adjustment_count}회</dd></div><div><dt>시작하지 못한 계획</dt><dd>{current.data.unstarted_count}개</dd></div></dl>
      <p>시작한 시간 지정 할 일 {current.data.started_count}개 기준 비율이에요. 시간 미지정·측정 도입 전·과거 배분 미확인 기록은 평가하지 않아요. 지연은 최초 시작만 비교하며 재개는 다시 평가하지 않아요.</p>
      <details><summary>할 일별 최초 시작 지연</summary><ul>{current.data.plans.map(plan=><li key={plan.todo_id}>{plan.title} · {plan.is_unstarted?'아직 시작하지 않음':plan.delay_minutes===null?'평가 없음':plan.delay_minutes===0?'계획대로 시작':`최초 ${plan.delay_minutes}분 지연`}</li>)}</ul></details>
    </>:null}
  </section>;
}
