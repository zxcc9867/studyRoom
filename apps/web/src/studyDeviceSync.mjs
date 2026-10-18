const millis = value => typeof value === 'string' ? Date.parse(value) : Number.NaN;
const count = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;

export function getSharedCameraView(snapshot, clientId, nowMs = Date.now()) {
  const active = snapshot?.active_session;
  const camera = active && snapshot?.camera?.session_id === active.id ? snapshot.camera : null;
  const received = Number(snapshot?.received_at_ms);
  const serverNow = millis(snapshot?.server_now);
  const clock = Number.isFinite(serverNow) && Number.isFinite(received) ? serverNow + Math.max(0, nowMs - received) : nowMs;
  const expires = millis(camera?.expires_at);
  const paused = Boolean(active?.paused_at);
  const liveSession = Boolean(active && !active.ended_at && active.status === 'active' && !paused && millis(active.lease_expires_at) > clock);
  const fresh = Boolean(camera && Number.isFinite(expires) && expires > clock);
  const isOwner = Boolean(camera && camera.owner_client_id === clientId && camera.is_owner !== false);
  const status = paused ? 'paused' : !active ? 'idle' : !camera ? 'unknown' : !fresh ? 'stale' : camera.status;
  const base = Math.max(count(snapshot?.tracking?.excluded_seconds), count(camera?.excluded_seconds));
  const autoPaused = camera?.status === 'auto_paused' || Boolean(camera?.auto_paused_at);
  const pauseStarted = millis(camera?.auto_paused_at);
  const projectionStarted = Math.max(millis(camera?.last_seen_at), Number.isFinite(pauseStarted) ? pauseStarted : 0);
  const elapsed = autoPaused && active && !active.ended_at && !paused && Number.isFinite(millis(camera?.last_seen_at))
    ? Math.max(0, Math.floor((Math.min(clock, expires, millis(active.lease_expires_at)) - projectionStarted) / 1000)) : 0;
  const device = camera?.device_type === 'android' ? '휴대폰' : '다른 기기';
  const labels = {idle:'카메라 꺼짐',paused:'휴식 중',unknown:'감시 상태 확인 필요',stale:'감시 기기 연결 확인 필요',watching:`${device}에서 감시 중`,present:`${device}에서 감시 중`,absent:`${device}에서 자리 비움 감지`,auto_paused:'자리 비움 · 공부시간 멈춤',off:`${device} 카메라 꺼짐`,error:`${device} 카메라 연결 확인 필요`,ended:'공부 종료'};
  return {isOwner,canPublish:isOwner && fresh && liveSession,cameraRequired:isOwner && fresh && liveSession && ['off','error'].includes(status),remote:Boolean(active && !isOwner),fresh,status,label:labels[status] ?? labels.unknown,excludedSeconds:base+elapsed,generation:camera?.generation ?? null,clockMs:clock};
}

// One account/document owns this controller. Only current server snapshots can grant
// publishing responsibility; merely opening a second client is always read-only.
export function createStudyDeviceSync({client,userId,clientId,onSnapshot,onError=()=>{},canRefresh=()=>true,readRevision=()=>0,host=globalThis,now=()=>Date.now(),request}) {
  let disposed=false,revision=0,current=null,inFlight=null,trailing=false,interval=null,channel=null;
  let reportInFlight=null,queuedReport=null;
  const controllers=new Set();
  const rpc=async(name,args)=>{
    const controller=new AbortController();controllers.add(controller);
    let timeout;
    try {
      const run=async signal=>{
        let query=client.rpc(name,args);
        if(typeof query?.abortSignal==='function')query=query.abortSignal(signal ?? controller.signal);
        const result=await query;
        if(result?.error)throw result.error;
        return result?.data;
      };
      if(request)return await request(run,controller.signal);
      return await Promise.race([run(controller.signal),new Promise((_,reject)=>{timeout=setTimeout(()=>{controller.abort();reject(new Error('공부 상태 연결 시간이 초과됐어요.'));},12000);})]);
    } finally {clearTimeout(timeout);controllers.delete(controller);}
  };
  const accept=(data,expectedRevision,externalRevision)=>{
    if(disposed || expectedRevision!==revision || externalRevision!==readRevision())return null;
    if(!data || typeof data!=='object' || Array.isArray(data) || typeof data.server_now!=='string'
      || (data.session && data.session.user_id!==userId) || (data.active_session && data.active_session.user_id!==userId))throw new Error('공부 상태 응답을 확인하지 못했어요.');
    if(current && (millis(data.server_now)<millis(current.server_now)
      || (data.camera?.session_id===current.camera?.session_id && data.camera?.generation<current.camera?.generation)))return null;
    current={...data,received_at_ms:now()};onSnapshot(current);return current;
  };
  function refresh() {
    if(disposed || !canRefresh())return Promise.resolve(null);
    if(inFlight){trailing=true;return inFlight;}
    const expected=revision;
    const external=readRevision();
    inFlight=rpc('study_device_snapshot',{p_client_id:clientId}).then(data=>accept(data,expected,external)).catch(error=>{if(!disposed)onError(error);return null;}).finally(()=>{
      inFlight=null;
      if(trailing && !disposed){trailing=false;void refresh();}
    });
    return inFlight;
  }
  async function action(name,sessionId,options) {
    if(disposed)return null;
    const expected=++revision;
    const external=readRevision();
    try {
      const data=await rpc('study_camera_action',{p_action:name,p_client_id:clientId,p_session_id:sessionId,...options});
      return accept(data,expected,external);
    } catch(error){if(!disposed)onError(error);throw error;}
  }
  const visible=()=>!host.document || host.document.visibilityState==='visible';
  const refreshVisible=()=>{if(visible())void refresh();};
  const owns=(sessionId,generation)=>!disposed && current?.camera?.owner_client_id===clientId && current.camera.session_id===sessionId && current.camera.generation===generation;
  function sendReport(sessionId,generation,options) {
    if(!owns(sessionId,generation))return Promise.resolve(null);
    reportInFlight=action('report',sessionId,{p_generation:generation,p_status:options.status,p_excluded_seconds:count(options.excludedSeconds)}).finally(()=>{
      reportInFlight=null;
      const next=queuedReport;queuedReport=null;
      if(next)void sendReport(next.sessionId,next.generation,next.options).then(next.resolve,next.reject);
    });
    return reportInFlight;
  }
  return {
    clientId,read:()=>current,refresh,
    claim(sessionId,{takeover=false,deviceType='browser'}={}) {return action('claim',sessionId,{p_takeover:takeover,p_device_type:deviceType});},
    report(sessionId,generation,{status,excludedSeconds}) {
      if(!owns(sessionId,generation))return Promise.resolve(null);
      if(!reportInFlight)return sendReport(sessionId,generation,{status,excludedSeconds});
      if(queuedReport){Object.assign(queuedReport,{sessionId,generation,options:{status,excludedSeconds}});return queuedReport.promise;}
      let resolve,reject;
      const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
      queuedReport={sessionId,generation,options:{status,excludedSeconds},promise,resolve,reject};
      return promise;
    },
    start() {
      if(disposed || interval!==null)return;
      refreshVisible();interval=host.setInterval(refreshVisible,15000);
      host.addEventListener?.('focus',refreshVisible);host.document?.addEventListener('visibilitychange',refreshVisible);
      if(typeof client.channel==='function') {
        channel=client.channel(`study-device:${userId}:${clientId}`);
        for(const table of ['study_sessions','study_actual_sessions','study_camera_sessions'])channel=channel.on('postgres_changes',{event:'*',schema:'public',table,filter:`user_id=eq.${userId}`},refreshVisible);
        channel.subscribe(status=>{if(status==='SUBSCRIBED')refreshVisible();});
      }
    },
    dispose() {
      disposed=true;revision++;trailing=false;
      if(interval!==null)host.clearInterval(interval);
      host.removeEventListener?.('focus',refreshVisible);host.document?.removeEventListener('visibilitychange',refreshVisible);
      if(channel)void client.removeChannel?.(channel);
      for(const controller of controllers)controller.abort();
      if(queuedReport){queuedReport.resolve(null);queuedReport=null;}
    },
  };
}
