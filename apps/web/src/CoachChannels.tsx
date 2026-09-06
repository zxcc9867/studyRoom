import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CoachRequest } from './CareerCoach';
import type { CoachSettings } from './careerCoachTypes';
import { registerWebPushTarget } from './webPush';

export default function CoachChannels({supabase,userId,settings,request,onManage,onChanged}:{supabase:SupabaseClient;userId:string;settings:CoachSettings;request:CoachRequest;onManage:()=>void;onChanged:()=>void}) {
  const [connected,setConnected]=useState({slack:false,web_push:false,email:false});const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');const live=useRef(true);const lock=useRef(false);
  const load=useCallback(async()=>{
    const [targets,profile]=await Promise.all([supabase.from('notification_targets').select('kind,enabled').eq('user_id',userId),supabase.from('profiles').select('email,email_reminders_enabled').eq('user_id',userId).maybeSingle()]);
    if(targets.error||profile.error)throw new Error('알림 연결 상태를 확인하지 못했어요.');
    if(live.current)setConnected({slack:targets.data?.some(t=>t.kind==='slack'&&t.enabled)??false,web_push:targets.data?.some(t=>t.kind==='web_push'&&t.enabled)??false,email:Boolean(profile.data?.email&&profile.data.email_reminders_enabled)});
  },[supabase,userId]);
  useEffect(()=>{live.current=true;void load().catch(failure=>{if(live.current)setError(failure.message);});return()=>{live.current=false;};},[load]);
  async function run(task:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');try{await task();if(live.current){await load();onChanged();setMessage('요청을 처리했어요. 테스트 알림은 연결한 채널에서 확인해 주세요.');}}catch(failure){if(live.current)setError(failure instanceof Error?failure.message:'알림 설정을 처리하지 못했어요.');}finally{lock.current=false;if(live.current)setBusy(false);}}
  return <section className="coach-connection"><h3>알림 채널 연결</h3><p>연결 후 공부·알림 설정에서 원하는 코칭 채널을 켜 주세요.</p>{error&&<p role="alert" className="coach-error">{error}</p>}<p role="status">{busy?'처리 중…':message}</p>
    {([['slack','Slack'],['web_push','Web Push'],['email','이메일']] as const).map(([channel,label])=><article className="coach-repository" key={channel}><div className="coach-row"><strong>{label}</strong><span>{connected[channel]?'연결됨':'연결 안 됨'} · 코칭 {settings.channels[channel]?'켜짐':'꺼짐'}</span></div>
      {channel==='web_push'&&<p>현재 기기에서 알림을 허용하세요. iPhone·iPad는 홈 화면에 추가한 웹앱에서 연결할 수 있습니다.</p>}
      <div className="coach-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>{if(channel==='slack'){onManage();return;}void run(async()=>{if(channel==='web_push')await registerWebPushTarget(userId);else{const result=await supabase.from('profiles').update({email_reminders_enabled:true}).eq('user_id',userId);if(result.error)throw new Error('이메일 연결을 저장하지 못했어요.');}});}}>{channel==='web_push'?'이 기기 연결':connected[channel]?'연결 관리':'연결하기'}</button>
      <button type="button" className="secondary" disabled={busy||!connected[channel]||!settings.channels[channel]} onClick={()=>void run(async()=>{await request('coach-notifications',{action:'test',channel});setMessage('테스트 알림을 요청했어요. 연결한 채널에서 확인해 주세요.');})}>테스트 발송</button>
      <button type="button" className="plain" disabled={busy||!connected[channel]} onClick={()=>void run(async()=>{
        const result=channel==='email'?await supabase.from('profiles').update({email_reminders_enabled:false}).eq('user_id',userId):await supabase.from('notification_targets').update({enabled:false}).eq('user_id',userId).eq('kind',channel);
        if(result.error)throw new Error('연결을 해제하지 못했어요.');
      })}>연결 해제</button></div>{channel==='web_push'&&<small>연결 해제는 계정에 등록된 모든 웹 푸시 기기의 발송을 중단합니다.</small>}
    </article>)}
  </section>;
}
