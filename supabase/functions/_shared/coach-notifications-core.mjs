export function localParts(now,zone) {
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
}
export function quiet(time,start,end) { start=start.slice(0,5);end=end.slice(0,5);return start===end?false:start<end?time>=start&&time<end:time>=start||time<end; }
export function dueKind(settings,recommendation,now,zone) {
  if(!settings?.enabled||Date.parse(settings.muted_until)>now.getTime()) return null;
  const {date,time}=localParts(now,zone);
  if(quiet(time,settings.quiet_start,settings.quiet_end)||recommendation.local_date!==date||recommendation.status!=='pending') return null;
  const start=Date.parse(recommendation.start_at),diff=(start-now.getTime())/60000;
  if(diff>=0&&diff<=10) return 'opportunity';
  const minutes=(s)=>Number(s.slice(0,2))*60+Number(s.slice(3,5));
  const after=minutes(time)-minutes(settings.summary_time);
  return after>=0&&after<15?'summary':null;
}
export function eligibleTargets(settings,targets,profile) {
  if(!settings?.enabled) return [];
  return targets.filter(t=>t.enabled&&settings.channels?.[t.kind]===true&&['slack','web_push','email'].includes(t.kind)&&(t.kind==='web_push'?!!t.subscription:t.kind==='email'?!!t.destination&&profile.email_reminders_enabled===true:!!t.destination));
}
export function overlapsEvent(event,start,end,zone) {
  if(event.all_day) {const a=localParts(new Date(start),zone).date,b=localParts(new Date(end-1),zone).date;return event.start_date<=b&&event.end_date>a;}
  return Date.parse(event.start_at)<end&&Date.parse(event.end_at)>start;
}
export function pushEndpointAllowed(subscription) {
  try {const url=new URL(subscription?.endpoint);return url.protocol==='https:'&&(/(^|\.)push\.services\.mozilla\.com$|(^|\.)notify\.windows\.com$|(^|\.)push\.apple\.com$/.test(url.hostname)||url.hostname==='fcm.googleapis.com');} catch{return false;}
}

