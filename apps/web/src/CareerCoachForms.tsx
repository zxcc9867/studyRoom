import { useState } from 'react';
import type { Career, CoachEvent, CoachSettings, Skill } from './careerCoachTypes';
import { localParts, shiftDate, wallTimeToInstant } from './coachTime.mjs';

export type RunAction = (payload:Record<string,unknown>)=>Promise<boolean>;
const days = ['일', '월', '화', '수', '목', '금', '토'];
const blankCareer:Career = {title:'',experience:'',target_date:'',interests:[],skills:[],confirmed:false};

export function CareerForm({ career, busy, onSave }: {career:Career|null;busy:boolean;onSave:RunAction}) {
  const [draft, setDraft] = useState<Career>(career ?? blankCareer);
  const [interests, setInterests] = useState(draft.interests.join(', '));
  const [consent, setConsent] = useState(Boolean(career));
  function updateSkill(id:string, patch:Partial<Skill>) { setDraft(current => ({...current,skills:current.skills.map(skill => skill.id === id ? {...skill,...patch} : skill)})); }
  return <form className="coach-form" onSubmit={event => { event.preventDefault(); void onSave({action:'save_career',career:{...draft,interests:interests.split(',').map(s=>s.trim()).filter(Boolean),skills:draft.skills.map((skill,index)=>({...skill,prerequisites:skill.prerequisites.filter(id=>draft.skills.slice(0,index).some(previous=>previous.id===id))}))}}); }}>
    <h3>{career ? '나의 커리어 로드맵' : '어떤 커리어를 만들고 싶나요?'}</h3>
    <fieldset disabled={busy}>
      <label>희망 직무<input required maxLength={160} value={draft.title} placeholder="예: 안정적인 서비스를 만드는 백엔드 개발자" onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
      <label>현재 경험<textarea maxLength={2000} value={draft.experience} placeholder="지금까지 해본 공부와 프로젝트를 적어주세요." onChange={e=>setDraft({...draft,experience:e.target.value})}/></label>
      <div className="coach-grid"><label>목표 날짜<input type="date" required value={draft.target_date ?? ''} onChange={e=>setDraft({...draft,target_date:e.target.value})}/></label><label>관심 기술 (쉼표로 구분)<input maxLength={500} value={interests} placeholder="TypeScript, API, 테스트" onChange={e=>setInterests(e.target.value)}/></label></div>
      {!career && <><p>로드맵 작성을 위해 입력한 커리어·경험·관심 기술을 OpenRouter 무료 AI로 전달합니다. 이용이 어려우면 기본 로드맵을 제공합니다.</p><label className="coach-check"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/>AI 연결 설명을 확인했습니다.</label></>}
      {!draft.skills.length && <p>저장하면 로드맵 초안을 준비합니다. 초안을 검토하고 확정해 주세요.</p>}
      {draft.skills.map((skill,index)=><section key={skill.id} className="coach-skill">
        <div className="coach-row"><h4>스킬 {index+1}</h4><button type="button" className="plain" aria-label={`${skill.title || `스킬 ${index+1}`} 삭제`} onClick={()=>setDraft({...draft,skills:draft.skills.filter(s=>s.id!==skill.id).map(s=>({...s,prerequisites:s.prerequisites.filter(id=>id!==skill.id)}))})}>삭제</button></div>
        <label>스킬 이름<input required maxLength={160} value={skill.title} onChange={e=>updateSkill(skill.id,{title:e.target.value})}/></label>
        <fieldset><legend>먼저 익힐 스킬</legend>{index===0?<p>첫 단계입니다. 먼저 완료해야 할 스킬이 없습니다.</p>:draft.skills.slice(0,index).map(previous=><label className="coach-check" key={previous.id}><input type="checkbox" checked={skill.prerequisites.includes(previous.id)} onChange={e=>updateSkill(skill.id,{prerequisites:e.target.checked?[...skill.prerequisites,previous.id]:skill.prerequisites.filter(id=>id!==previous.id)})}/>{previous.title||'이름 없는 스킬'}</label>)}</fieldset>
        <label>실습 과제<textarea required maxLength={1000} value={skill.task} onChange={e=>updateSkill(skill.id,{task:e.target.value})}/></label>
        <label>완료 기준<textarea required maxLength={1000} value={skill.acceptance} onChange={e=>updateSkill(skill.id,{acceptance:e.target.value})}/></label>
        <label>진행 상태<select value={skill.status} onChange={e=>updateSkill(skill.id,{status:e.target.value as Skill['status']})}><option value="todo">시작 전</option><option value="doing">진행 중</option><option value="done">완료 확인</option></select></label>
      </section>)}
      <button type="button" className="secondary" onClick={()=>setDraft({...draft,skills:[...draft.skills,{id:crypto.randomUUID(),title:'',prerequisites:[],task:'',acceptance:'',status:'todo'}]})}>스킬 직접 추가</button>
      <label className="coach-check"><input type="checkbox" checked={draft.confirmed} disabled={!draft.skills.length} onChange={e=>setDraft({...draft,confirmed:e.target.checked})}/>로드맵을 검토했으며 이 계획으로 추천받겠습니다.</label>
      <button className="primary" type="submit">{busy ? '저장 중…' : '커리어 저장'}</button>
    </fieldset>
  </form>;
}

export function CoachSettingsForm({settings,busy,onSave,onManageNotifications}:{settings:CoachSettings;busy:boolean;onSave:RunAction;onManageNotifications:()=>void}) {
  const [draft,setDraft]=useState(settings);
  const [consent,setConsent]=useState(settings.enabled);
  return <form className="coach-form" onSubmit={e=>{e.preventDefault();void onSave({action:'settings',settings:draft});}}>
    <h3>공부 리듬과 알림</h3><fieldset disabled={busy}>
      <label className="coach-check"><input type="checkbox" checked={draft.enabled} onChange={e=>setDraft({...draft,enabled:e.target.checked})}/>커리어 코치 사용</label>
      <details><summary>AI 연결과 추천 방식</summary><p>커리어, 선택한 과제와 익명 학습 요약을 OpenRouter 무료 모델로 분석합니다. 일정 제목·참석자·인증정보는 전달하지 않습니다. 비공개 코드는 저장소별 허용 시에만 분석합니다. 모델을 사용할 수 없으면 저장한 로드맵으로 추천합니다.</p><p>기본 라우터: openrouter/free · 유료 모델 전환 없음. 실제 응답 모델은 추천 상세에서 확인할 수 있습니다.</p></details>
      {!settings.enabled && <label className="coach-check"><input type="checkbox" checked={consent} required={draft.enabled} onChange={e=>setConsent(e.target.checked)}/>AI 연결 설명을 확인하고 코치를 활성화합니다.</label>}
      <h4>반복 공부 가능 시간</h4><p>비워 둔 요일에는 공부 시간을 제안하지 않습니다. 휴식 시간은 아래 공부 가능 구간에서 제외해 주세요.</p>
      {draft.availability.map((window,index)=><div className="coach-availability" key={index}>
        <label>요일<select value={window.weekday} onChange={e=>setDraft({...draft,availability:draft.availability.map((w,i)=>i===index?{...w,weekday:Number(e.target.value)}:w)})}>{days.map((day,i)=><option key={day} value={i}>{day}요일</option>)}</select></label>
        <label>시작<input type="time" required value={window.start} onChange={e=>setDraft({...draft,availability:draft.availability.map((w,i)=>i===index?{...w,start:e.target.value}:w)})}/></label>
        <label>종료<input type="time" required value={window.end} onChange={e=>setDraft({...draft,availability:draft.availability.map((w,i)=>i===index?{...w,end:e.target.value}:w)})}/></label>
        <button type="button" className="plain" aria-label={`${days[window.weekday]}요일 공부 가능 시간 삭제`} onClick={()=>setDraft({...draft,availability:draft.availability.filter((_,i)=>i!==index)})}>삭제</button>
      </div>)}
      <button type="button" className="secondary" onClick={()=>setDraft({...draft,availability:[...draft.availability,{weekday:1,start:'20:00',end:'21:00'}]})}>공부 가능 시간 추가</button>
      <div className="coach-grid"><label>일정 전후 여유 (분)<input required type="number" min={0} max={60} value={draft.buffer_minutes} onChange={e=>setDraft({...draft,buffer_minutes:Number(e.target.value)})}/></label><label>최소 공부 시간 (분)<input required type="number" min={15} max={180} value={draft.min_slot_minutes} onChange={e=>setDraft({...draft,min_slot_minutes:Number(e.target.value)})}/></label></div>
      <div className="coach-grid"><label>하루 요약 시간<input required type="time" value={draft.summary_time.slice(0,5)} onChange={e=>setDraft({...draft,summary_time:e.target.value})}/></label><label>조용한 시간 시작<input required type="time" value={draft.quiet_start.slice(0,5)} onChange={e=>setDraft({...draft,quiet_start:e.target.value})}/></label><label>조용한 시간 종료<input required type="time" value={draft.quiet_end.slice(0,5)} onChange={e=>setDraft({...draft,quiet_end:e.target.value})}/></label></div>
      <h4>코칭을 받을 채널</h4><p>연결된 채널 중 켠 곳에만 보냅니다. 모두 끄면 앱에서만 추천을 확인합니다.</p>
      {([['slack','Slack'],['web_push','Web Push'],['email','이메일']] as const).map(([key,label])=><label key={key} className="coach-check"><input type="checkbox" checked={draft.channels[key]} onChange={e=>setDraft({...draft,channels:{...draft.channels,[key]:e.target.checked}})}/>{label} 코칭 알림</label>)}
      <button type="button" className="secondary" onClick={onManageNotifications}>알림 채널 연결·테스트</button>
      <button type="submit" className="primary" disabled={draft.enabled&&!consent}>{busy?'저장 중…':'코치 설정 저장'}</button>
    </fieldset>
  </form>;
}

export function CoachEventForm({timeZone,busy,onSave}:{timeZone:string;busy:boolean;onSave:RunAction}) {
  const today=localParts(new Date(),timeZone).slice(0,10);
  const [title,setTitle]=useState('');const [allDay,setAllDay]=useState(false);
  const [start,setStart]=useState(`${today}T18:00`);const [end,setEnd]=useState(`${today}T19:00`);
  const [date,setDate]=useState(today);const [endDate,setEndDate]=useState(today);
  const [repeat,setRepeat]=useState<number[]>([]);const [until,setUntil]=useState('');const [error,setError]=useState('');
  return <form className="coach-form" onSubmit={async e=>{e.preventDefault();setError('');try{
    const times=allDay?{start_date:date,end_date:shiftDate(endDate,1)}:{start_at:wallTimeToInstant(start,timeZone),end_at:wallTimeToInstant(end,timeZone)};
    if ((allDay&&endDate<date)||(!allDay&&end<=start)) throw new Error('종료는 시작보다 뒤여야 합니다.');
    if(await onSave({action:'save_event',event:{title,...times,all_day:allDay,repeat_weekdays:repeat,repeat_until:until||null,time_zone:timeZone}}))setTitle('');
  }catch(failure){setError(failure instanceof Error?failure.message:'일정 입력을 확인해 주세요.');}}}>
    <h3>생활 일정 추가</h3><p>{timeZone} 기준 · Google 일정은 연결한 캘린더에서 수정합니다.</p><fieldset disabled={busy}>
      <label>일정 이름<input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder="약속, 업무, 휴식"/></label>
      <label className="coach-check"><input type="checkbox" checked={allDay} onChange={e=>setAllDay(e.target.checked)}/>종일 일정</label>
      <div className="coach-grid">{allDay?<><label>시작 날짜<input type="date" required value={date} onChange={e=>{setDate(e.target.value);if(endDate<e.target.value)setEndDate(e.target.value);}}/></label><label>마지막 날짜<input type="date" required min={date} value={endDate} onChange={e=>setEndDate(e.target.value)}/></label></>:<><label>시작<input type="datetime-local" required value={start} onChange={e=>setStart(e.target.value)}/></label><label>종료<input type="datetime-local" required value={end} onChange={e=>setEnd(e.target.value)}/></label></>}</div>
      <fieldset><legend>반복 요일 (선택하지 않으면 한 번)</legend><div className="coach-days">{days.map((day,i)=><label key={day} className="coach-check"><input type="checkbox" checked={repeat.includes(i)} onChange={e=>setRepeat(e.target.checked?[...repeat,i]:repeat.filter(d=>d!==i))}/>{day}</label>)}</div></fieldset>
      {repeat.length>0&&<label>반복 마지막 날짜<input type="date" required min={allDay?date:start.slice(0,10)} value={until} onChange={e=>setUntil(e.target.value)}/></label>}
      <button type="submit" className="primary">일정 저장</button></fieldset>{error&&<p className="coach-error" role="alert">{error}</p>}
  </form>;
}

export function CoachEventList({events,timeZone,busy,onDelete}:{events:CoachEvent[];timeZone:string;busy:boolean;onDelete:(id:string)=>void}) {
  return <div className="coach-event-list">{!events.length&&<p>등록된 생활 일정이 없습니다.</p>}{events.map(event=><article key={event.id} className="coach-event"><div><small>{event.source==='google'?'Google':'생활 일정'}{event.repeat_weekdays.length?' · 반복':''}</small><strong>{event.title}</strong><span>{event.all_day?`${event.start_date} ~ ${shiftDate(event.end_date!, -1)} · 종일`:`${localParts(event.start_at!,timeZone).replace('T',' ')} ~ ${localParts(event.end_at!,timeZone).replace('T',' ')}`}</span></div>{event.source==='internal'&&<button className="plain" disabled={busy} type="button" aria-label={`${event.title} 삭제`} onClick={()=>onDelete(event.id)}>삭제</button>}</article>)}</div>;
}
