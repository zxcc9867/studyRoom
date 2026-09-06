import webpush from 'npm:web-push@3.6.7';
import {syncGoogle} from './coach-integrations.ts';
import {unwrap,envDefault} from './coach-integrations-core.mjs';
import {localParts,dueKind,eligibleTargets,overlapsEvent,pushEndpointAllowed,quiet} from './coach-notifications-core.mjs';
type Admin=any;
export async function sendCoachTarget(target:any,recommendation:any,deliveryId:string,env=envDefault) {
  const base=env('SITE_URL')||'https://study-room-attendance.vercel.app';
  const url=`${base}/#today`,title='오늘의 학습 추천',body=`${recommendation.title} · ${recommendation.duration_minutes}분`;
  let response:Response;
  if(target.kind==='slack') {
    const token=env('SLACK_BOT_TOKEN')||env('STUDY_ALERT_SLACK_BOT_TOKEN');if(!token) throw new Error('not_configured');
    response=await fetch('https://slack.com/api/chat.postMessage',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),body:JSON.stringify({channel:target.destination,text:`${title}\n${body}\n${url}`,unfurl_links:false,unfurl_media:false,blocks:[{type:'section',text:{type:'plain_text',text:`${title}\n${body}`}},{type:'actions',elements:[{type:'button',text:{type:'plain_text',text:'계획 확인'},url,action_id:'coach_open'},{type:'button',text:{type:'plain_text',text:'30분 뒤 알림'},action_id:'coach_snooze',value:deliveryId},{type:'button',text:{type:'plain_text',text:'오늘 그만 받기'},action_id:'coach_mute',value:deliveryId}]}]})});
    if(response.ok) { const result=await response.json(); if(!result.ok) throw new Error('provider_rejected'); }
  } else if(target.kind==='email') {
    const key=env('RESEND_API_KEY'),from=env('RESEND_FROM_EMAIL');if(!key||!from) throw new Error('not_configured');
    response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':deliveryId},signal:AbortSignal.timeout(10000),body:JSON.stringify({from,to:target.destination,subject:title,text:`${body}\n${url}\n알림 설정은 앱의 마이페이지에서 변경할 수 있습니다.`})});
  } else {
    if(!pushEndpointAllowed(target.subscription)) throw new Error('invalid_push_target');
    webpush.setVapidDetails(env('WEB_PUSH_SUBJECT')||'mailto:study-room@example.com',env('WEB_PUSH_VAPID_PUBLIC_KEY')!,env('WEB_PUSH_VAPID_PRIVATE_KEY')!);
    await webpush.sendNotification(target.subscription,JSON.stringify({title,body,url:'/#today',tag:deliveryId}),{TTL:600,timeout:10000});return;
  }
  if(!response.ok) throw new Error(response.status>=500?'provider_uncertain':'provider_rejected');
}
export async function dispatchCoaching(admin:Admin,userId?:string) {
  let query=admin.from('coach_settings').select('*').eq('enabled',true);if(userId) query=query.eq('user_id',userId);
  const settings=unwrap(await query.limit(100)); let sent=0;
  for(const initial of settings) {
    const uid=initial.user_id,now=new Date();
    const profile=unwrap(await admin.from('profiles').select('time_zone,email_reminders_enabled').eq('user_id',uid).single());
    const zone=profile.time_zone||'Asia/Seoul',date=localParts(now,zone).date;
    const pending=unwrap(await admin.from('coach_deliveries').select('*').eq('user_id',uid).eq('status','pending').lte('scheduled_at',now.toISOString()).limit(10));
    for(const delivery of pending) {
      const current=unwrap(await admin.from('coach_settings').select('*').eq('user_id',uid).single());
      const rec=unwrap(await admin.from('coach_recommendations').select('*').eq('id',delivery.recommendation_id).eq('user_id',uid).maybeSingle());
      const target=unwrap(await admin.from('notification_targets').select('*').eq('id',delivery.target_id).eq('user_id',uid).maybeSingle());
      const studying=unwrap(await admin.from('study_sessions').select('id').eq('user_id',uid).eq('status','active').limit(1));
      if(!target||!rec||rec.status!=='pending'||delivery.local_date!==date||!eligibleTargets(current,[target],profile).length||Date.parse(current.muted_until)>now.getTime()||quiet(localParts(now,zone).time,current.quiet_start,current.quiet_end)||studying.length) {await admin.from('coach_deliveries').update({status:'cancelled'}).eq('id',delivery.id).eq('status','pending');continue;}
      if(delivery.kind==='opportunity') {
        const connected=unwrap(await admin.from('coach_connections').select('id').eq('user_id',uid).eq('provider','google').neq('status','disconnected'));
        if(connected.length) {try{await syncGoogle(admin,uid);}catch{continue;}}
        const busy=unwrap(await admin.from('coach_events').select('*').eq('user_id',uid).eq('source','google'));
        if(busy.some((e:any)=>overlapsEvent(e,Date.parse(rec.start_at),Date.parse(rec.end_at),zone)))continue;
      }
      const claimed=unwrap(await admin.from('coach_deliveries').update({status:'sending'}).eq('id',delivery.id).eq('status','pending').select().maybeSingle());if(!claimed)continue;
      try{await sendCoachTarget(target,rec,delivery.id);unwrap(await admin.from('coach_deliveries').update({status:'sent',sent_at:new Date().toISOString()}).eq('id',delivery.id));sent++;}
      catch{await admin.from('coach_deliveries').update({status:'unknown'}).eq('id',delivery.id);}
    }
    const recommendations=unwrap(await admin.from('coach_recommendations').select('*').eq('user_id',uid).eq('local_date',date).eq('status','pending').order('start_at').limit(3));
    const rec=recommendations.find((r:any)=>dueKind(initial,r,now,zone));if(!rec) continue;
    const kind=dueKind(initial,rec,now,zone);
    const active=unwrap(await admin.from('study_sessions').select('id').eq('user_id',uid).eq('status','active').limit(1));if(active.length) continue;
    if(kind==='opportunity') {
      const connections=unwrap(await admin.from('coach_connections').select('id,status').eq('user_id',uid).eq('provider','google').neq('status','disconnected'));
      if(connections.length) {try{await syncGoogle(admin,uid);}catch{continue;}}
      const events=unwrap(await admin.from('coach_events').select('*').eq('user_id',uid).eq('source','google'));
      if(events.some((event:any)=>overlapsEvent(event,Date.parse(rec.start_at)-initial.buffer_minutes*60000,Date.parse(rec.end_at)+initial.buffer_minutes*60000,zone))) continue;
      const recent=unwrap(await admin.from('notification_deliveries').select('id').eq('user_id',uid).eq('status','sent').gte('created_at',new Date(now.getTime()-15*60000).toISOString()).limit(1));if(recent.length) continue;
    }
    const targets=unwrap(await admin.from('notification_targets').select('*').eq('user_id',uid).eq('enabled',true));
    for(const target of eligibleTargets(initial,targets,profile)) {
      const inserted=await admin.from('coach_deliveries').insert({user_id:uid,recommendation_id:rec.id,local_date:date,kind,channel:target.kind,target_id:target.id,status:'pending',scheduled_at:now.toISOString()}).select().maybeSingle();
      if(inserted.error?.code==='23505') continue;if(inserted.error) throw new Error('storage_error');const delivery=inserted.data;
      // Recheck settings, recommendation and target immediately before claiming external send.
      const current=unwrap(await admin.from('coach_settings').select('*').eq('user_id',uid).single());
      const currentTarget=unwrap(await admin.from('notification_targets').select('*').eq('id',target.id).eq('user_id',uid).maybeSingle());
      const currentRec=unwrap(await admin.from('coach_recommendations').select('status').eq('id',rec.id).eq('user_id',uid).single());
      if(!currentTarget||!eligibleTargets(current,[currentTarget],profile).length||!dueKind(current,{...rec,...currentRec},new Date(),zone)) {await admin.from('coach_deliveries').update({status:'cancelled'}).eq('id',delivery.id);continue;}
      const claim=unwrap(await admin.from('coach_deliveries').update({status:'sending'}).eq('id',delivery.id).eq('status','pending').select().maybeSingle());if(!claim) continue;
      try {await sendCoachTarget(currentTarget,rec,delivery.id);unwrap(await admin.from('coach_deliveries').update({status:'sent',sent_at:new Date().toISOString()}).eq('id',delivery.id));sent++;}
      catch(error) {const known=['not_configured','invalid_push_target','provider_rejected'].includes((error as Error).message);await admin.from('coach_deliveries').update({status:known?'failed':'unknown'}).eq('id',delivery.id);}
    }
  }
  return {sent};
}
export async function handleCoachSlackAction(admin:Admin,userId:string,actionId:string,value:string) {
  if(!['coach_snooze','coach_mute'].includes(actionId)) return false;
  const delivery=unwrap(await admin.from('coach_deliveries').select('*').eq('id',value).eq('user_id',userId).eq('channel','slack').maybeSingle());if(!delivery) throw new Error('not_authorized');
  if(actionId==='coach_mute') {
    const profile=unwrap(await admin.from('profiles').select('time_zone').eq('user_id',userId).single());const now=new Date(),date=localParts(now,profile.time_zone).date;
    let end=new Date(now.getTime()+60000);while(localParts(end,profile.time_zone).date===date) end=new Date(end.getTime()+60000);
    unwrap(await admin.from('coach_settings').update({muted_until:end.toISOString()}).eq('user_id',userId));
    unwrap(await admin.from('coach_deliveries').update({status:'cancelled'}).eq('user_id',userId).eq('status','pending'));
  } else {
    // User explicitly requests one later delivery; retain the same event identity.
    unwrap(await admin.from('coach_deliveries').update({status:'pending',scheduled_at:new Date(Date.now()+1800000).toISOString()}).eq('id',delivery.id).eq('status','sent'));
  }
  return true;
}
