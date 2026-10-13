import test from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {mkdir,readFile} from 'node:fs/promises';import {fileURLToPath,pathToFileURL} from 'node:url';import {build} from 'esbuild';
let chromium;try{({chromium}=await import(process.env.FEED_BROWSER_MODULE?pathToFileURL(process.env.FEED_BROWSER_MODULE).href:'playwright'));}catch{}
const mounted=(name,run)=>test(name,{skip:!chromium&&'Enable FEED_BROWSER_MODULE and FEED_BROWSER_EXECUTABLE'},run);
const token='a'.repeat(64);
const existing=(await readFile(new URL('./actualStudyMounted.test.mjs',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
const boundaryStart=existing.indexOf('const backend = `'),boundaryEnd=existing.indexOf('\n`;\n',boundaryStart);
assert.ok(boundaryStart>=0&&boundaryEnd>boundaryStart,'Existing mounted personal boundary delimiters must be present');
const personalBoundary=existing.slice(boundaryStart+17,boundaryEnd);
const teamBoundary=`
state.team={tag:null,team:null,members:[],invitations:[],invite_links:[],round:null,connection:null,forest:{accepted_seconds:0,pending_sessions:0,trees:0,progress_seconds:0},server_now:now};
if(mode==='active-team-unavailable')state.teamError=true;
if(mode==='lease')state.focusError=true;
state.currentAuth=authSession;
supabase.auth.getSession=async()=>({data:{session:state.currentAuth},error:null});
supabase.auth.exchangeCodeForSession=async()=>({data:{session:state.currentAuth},error:null});
state.login=()=>{state.currentAuth={access_token:'test-only',user:{id:'owner',is_anonymous:false}};authCallback('SIGNED_IN',state.currentAuth);};
state.changeOwner=()=>{state.currentAuth={access_token:'test-only',user:{id:'other',is_anonymous:false}};state.sessions=[];state.team={...state.team,team:null,members:[]};authCallback('SIGNED_IN',state.currentAuth);};
let signal,status;
supabase.channel=()=>({on(type,filter,cb){signal=cb;return this;},subscribe(cb){status=cb;cb('SUBSCRIBED');return this;}});
supabase.removeChannel=async()=>{state.removed=(state.removed||0)+1;};
state.signal=()=>signal?.({new:{revision:2}});
const originalRpc=supabase.rpc;
supabase.rpc=(name,args)=>{
 if(name==='complete_study_session'){
  state.calls.push({name,args});state.sessions=state.sessions.map(s=>s.id===args.p_session_id?{...s,status:'completed',ended_at:new Date().toISOString(),duration_seconds:1740}:s);
  state.team.connection=null;state.team.members=state.team.members.map(m=>m.user_id==='owner'?{...m,state:'ready',title:null}:m);
  return Promise.resolve({data:state.sessions[0],error:null});
 }
 if(name==='extend_study_session_lease'){state.calls.push({name,args});const current=state.sessions[0],deadline=Math.min(Math.max(Date.parse(current.lease_expires_at),Date.now())+3600000,Date.now()+7200000);state.sessions[0]={...current,lease_expires_at:new Date(deadline).toISOString()};return Promise.resolve({data:state.sessions[0],error:null});}
 if(!name.startsWith('team_study_'))return originalRpc(name,args);
 return (async()=>{
 state.calls.push({name,args});
 if(state.teamError)return {data:null,error:{message:'PRIVATE_RAW_EXCEPTION'}};
 if(name==='team_study_snapshot'){state.team.server_now=new Date().toISOString();if(state.holdTeam){const saved=structuredClone(state.team);return new Promise(resolve=>state.releaseTeam=()=>resolve({data:saved,error:null}));}return {data:state.team,error:null};}
 const p=args.p_payload;
 if(state.actionError)return {data:{ok:false,error:state.actionError},error:null};
 if(state.holdAction)return new Promise(resolve=>{state.releaseAction=()=>resolve({data:{ok:true},error:null});});
 const preview={ok:true,team:{id:p.token==='${token}'?'invited':'second',name:p.token==='${token}'?'초대받은 책방':'두 번째 책방',member_count:2},expires_at:'2026-09-28T00:00:00Z'};
 switch(args.p_action){
 case 'preview_invite':if(state.holdPreview)return new Promise(resolve=>{state.releasePreview=()=>resolve({data:preview,error:null});});return {data:preview,error:null};
 case 'respond_invite':state.team.invitations=state.team.invitations.filter(i=>i.id!==p.invite_id);if(!p.accept)break;
 case 'create_team':case 'accept_invite':state.team.team={id:'team',name:p.name||'초대받은 책방',owner_id:'owner',member_count:1,time_zone:'Asia/Tokyo'};state.team.members=[{user_id:'owner',display_name:'내 태그',state:'studying',title:null,share_title:false,goal:null,share_goal:false,started_at:row.started_at,paused_seconds:0,paused_at:null}];break;
 case 'set_tag':state.team.tag=p.tag;break;
 case 'lookup_tag':return {data:{ok:true,tag:p.tag,display_name:'검색한 친구'},error:null};
 case 'create_invite':state.team.invite_links=[{id:'link',expires_at:'2026-09-28T00:00:00Z'}];return {data:{ok:true,token:'${token}',invite_id:'link',expires_at:'2026-09-28T00:00:00Z'},error:null};
 case 'revoke_invite':state.team.invite_links=[];break;
 case 'set_share_title':state.team.members[0].share_title=p.share;state.team.members[0].title=p.share?'집중 독서':null;break;
 case 'set_goal':state.team.members[0].goal=p.goal.trim()||null;state.team.members[0].share_goal=p.share;break;
 case 'propose_round':state.team.round={id:'round',duration_minutes:p.duration_minutes,proposed_by:'owner',started_at:null,ends_at:null,joined:false};break;
 case 'connect':state.team.connection={id:'connection',session_id:p.session_id};if(state.team.round){const started=Date.now();state.team.round={...state.team.round,started_at:new Date(started).toISOString(),ends_at:state.team.round.duration_minutes===null?null:new Date(started+state.team.round.duration_minutes*60000).toISOString(),joined:true};}break;
 case 'disconnect':state.team.connection=null;break;
 case 'cancel_round':state.team.round=null;break;
 case 'leave_team':state.team.team=null;state.team.members=[];state.team.connection=null;break;
 }
 return {data:{ok:true},error:null};})();
};
`;
async function withDashboard(width,mode,hash,run){
 const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/main.tsx',import.meta.url))],bundle:true,write:false,outdir:'fixture',platform:'browser',format:'iife',jsx:'automatic',logLevel:'silent',define:{'import.meta.env':'{}'},plugins:[{name:'safe-boundary',setup(b){b.onResolve({filter:/^\.\/supabase$/},()=>({path:'backend',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:personalBoundary+'\n'+teamBoundary,loader:'js'}));b.onLoad({filter:/bodyPresenceDetection\.mjs$/},()=>({contents:'export async function createUpperBodyPresenceDetector(){return {detect:()=>true,close(){}}}',loader:'js'}));}}]});
 const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text,css=bundle.outputFiles.find(f=>f.path.endsWith('.css'))?.text||'';
 const server=createServer((req,res)=>{res.setHeader('Content-Type',(req.url==='/app.js'?'text/javascript':req.url==='/app.css'?'text/css':'text/html')+'; charset=utf-8');res.end(req.url==='/app.js'?js:req.url==='/app.css'?css:'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({headless:true,executablePath:process.env.FEED_BROWSER_EXECUTABLE,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});const page=await browser.newPage({viewport:{width,height:960}});page.setDefaultTimeout(6000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-09-21T14:30:00Z')});if(mode==='lease')await page.route('https://fixture.invalid/functions/v1/camera-presence-warning',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'테스트 카메라 경고 전송 오류'})}));await page.goto('http://127.0.0.1:'+server.address().port+'/?mode='+mode+hash);await page.waitForLoadState('networkidle');
 if(mode.startsWith('active')||mode==='lease'){const camera=page.getByRole('dialog',{name:'카메라 인증 필요'});if(await camera.count()){await camera.waitFor();await page.keyboard.press('Escape');}}
 await run(page);assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
}
async function capture(page,name,width){await mkdir('output/team-study',{recursive:true});await page.evaluate(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));await page.screenshot({path:`output/team-study/${name}-${width}.png`,fullPage:true});}
async function readableTeamText(page,selectors,width){
 const pairs=await page.evaluate(selectors=>{
  const rgba=value=>value.match(/[\d.]+/g).map(Number);
  const over=(front,back)=>{const a=front[3]??1;return front.slice(0,3).map((v,i)=>v*a+back[i]*(1-a));};
  const luminance=color=>color.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  return selectors.map(selector=>{
   const el=document.querySelector(selector);if(!el)throw new Error('Missing contrast target '+selector);
   const style=getComputedStyle(el),layers=[];let gradient=null;
   for(let node=el;node;node=node.parentElement){const current=getComputedStyle(node);layers.push(rgba(current.backgroundColor));if(current.backgroundImage!=='none')gradient=current.backgroundImage;}
   let background=[255,255,255];for(const layer of layers.reverse())background=over(layer,background);
   const foreground=rgba(style.color);let candidates=[background];
   if(gradient)candidates=gradient.match(/rgba?\([^)]+\)/g).map(color=>over(rgba(color),background));
   const contrasts=candidates.map(surface=>ratio(over(foreground,surface),surface));
   return {selector,color:style.color,background:gradient??background,ratio:Math.min(...contrasts)};
  });
 },selectors);
 console.log('Team computed contrast '+width+'px '+JSON.stringify(pairs));
 for(const pair of pairs)assert.ok(pair.ratio>=4.5,pair.selector+' contrast '+pair.ratio);
}
for(const width of [375,1440])mounted(`team focus options ${width}: unlimited/custom, completion notice and private goal`,()=>withDashboard(width,'active','#together',async page=>{
 const panel=page.locator('#together');await panel.getByLabel('팀 이름',{exact:true}).fill('꾸준한 공부방');
 await panel.getByRole('button',{name:'팀 만들기',exact:true}).click();
 await panel.getByRole('heading',{name:'꾸준한 공부방',exact:true}).waitFor();
 await panel.getByLabel('함께 집중 시간',{exact:true}).selectOption('unlimited');
 await panel.getByRole('button',{name:'집중 제안',exact:true}).click();
 assert.equal(await page.evaluate(()=>fixture.calls.find(c=>c.args?.p_action==='propose_round').args.p_payload.duration_minutes),null);
 await panel.getByRole('button',{name:'현재 공부를 팀에 연결',exact:true}).click();await panel.getByText('시간 제한 없이 함께 공부 중',{exact:true}).waitFor();
 await panel.getByRole('button',{name:'함께 집중 마치기',exact:true}).click();
 assert.equal(await page.evaluate(()=>fixture.sessions[0].ended_at),null);assert.ok(await page.evaluate(()=>fixture.team.connection));
 await panel.getByLabel('함께 집중 시간',{exact:true}).selectOption('custom');
 const minutes=panel.getByLabel('집중 시간 (분)',{exact:true});await minutes.fill('0');
 const before=await page.evaluate(()=>fixture.calls.filter(c=>c.args?.p_action==='propose_round').length);
 await panel.getByRole('button',{name:'집중 제안',exact:true}).click();assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.args?.p_action==='propose_round').length),before);
 await minutes.fill('37');await panel.getByRole('button',{name:'집중 제안',exact:true}).click();
 assert.equal(await page.evaluate(()=>fixture.team.round.duration_minutes),37);
 await panel.getByRole('button',{name:'이 공부로 함께 집중 참여',exact:true}).click();
 await page.evaluate(()=>{fixture.team.round.ends_at=new Date(Date.now()+1000).toISOString();fixture.signal();});await page.clock.runFor(1250);
 await panel.getByRole('status').filter({hasText:'집중 시간이 끝났어요'}).waitFor();
 assert.equal(await page.evaluate(()=>fixture.sessions[0].ended_at),null);assert.ok(await page.evaluate(()=>fixture.team.team));
 await panel.getByRole('button',{name:'상태 다시 확인',exact:true}).click();await panel.getByRole('status').filter({hasText:'집중 시간이 끝났어요'}).waitFor();
 await panel.getByLabel('팀에 보여 줄 목표',{exact:true}).fill('백엔드 개발자로 성장');
 await panel.getByRole('button',{name:'목표 저장',exact:true}).click();await panel.getByText('목표를 저장했어요.',{exact:true}).waitFor();
 assert.equal(await panel.locator('.team-desk').getByText('백엔드 개발자로 성장',{exact:true}).count(),0);
 await panel.getByRole('checkbox',{name:'목표를 팀에 공유',exact:true}).check();await panel.getByRole('button',{name:'목표 저장',exact:true}).click();
 await panel.locator('.team-desk').getByText('백엔드 개발자로 성장',{exact:true}).waitFor();
 await panel.getByRole('checkbox',{name:'지금 할 일 제목을 팀에 공유'}).check();await panel.locator('.team-desk').getByText('집중 독서',{exact:true}).waitFor();
 assert.equal(await panel.getByRole('button',{name:'오늘 공부 종료',exact:true}).count(),1);
 assert.equal(await panel.getByRole('button',{name:'팀 탈퇴 확인',exact:true}).count(),0);
 await panel.getByRole('button',{name:'팀 관리',exact:true}).click();await panel.getByText('오늘 공부만 마치려면 위의 오늘 공부 종료를 사용하세요.',{exact:true}).waitFor();
 await readableTeamText(page,['.team-round h2','.team-goal label','.team-desk dd','.team-membership p'],width);
 await capture(page,'focus-options',width);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 for(const el of await panel.locator('button,input:not([type=checkbox]),select,a').all()){if(await el.isVisible())assert.ok((await el.boundingBox()).height>=44);}
}));
mounted('today study end uses existing reflection RPC and preserves team without leave action',()=>withDashboard(375,'active','#together',async page=>{
 const panel=page.locator('#together');await panel.getByLabel('팀 이름',{exact:true}).fill('내일도 만나는 팀');
 await panel.getByRole('button',{name:'팀 만들기',exact:true}).click();await panel.getByRole('button',{name:'현재 공부를 팀에 연결',exact:true}).click();
 await panel.getByRole('button',{name:'오늘 공부 종료',exact:true}).click();
 const reflection=page.getByRole('dialog',{name:'오늘의 집중을 짧게 돌아봐요',exact:true});await reflection.waitFor();
 assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c.args?.p_action==='leave_team')),false);
 await reflection.getByRole('button',{name:'계속 공부하기',exact:true}).click();assert.equal(await page.evaluate(()=>fixture.sessions[0].ended_at),null);
 await panel.getByRole('button',{name:'오늘 공부 종료',exact:true}).click();await reflection.getByRole('button',{name:'회고 저장하고 종료',exact:true}).click();await reflection.waitFor({state:'detached'});
 await panel.getByRole('button',{name:'개인 공부 시작',exact:true}).waitFor();
 await panel.getByRole('button',{name:'상태 다시 확인',exact:true}).click();await panel.getByRole('heading',{name:'내일도 만나는 팀',exact:true}).waitFor();
 assert.ok(await page.evaluate(()=>fixture.sessions[0].ended_at));assert.equal(await panel.locator('.team-desk').count(),1);
 assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.name==='complete_study_session').length),1);
 assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c.args?.p_action==='leave_team')),false);
}));
for(const width of [375,1440])mounted(`team mounted Dashboard ${width}: teamless/create/desks/round/forest/invites preserve personal authority`,()=>withDashboard(width,'active','#together',async page=>{
 const panel=page.locator('#together');await panel.getByRole('heading',{name:'함께 공부방',exact:true}).waitFor();await capture(page,'teamless',width);
 const nav=page.locator(width===375?'.mobile-navigation':'.desktop-navigation');assert.equal(await nav.locator('a[href="#today"]').getAttribute('aria-current'),'page');if(width===375)assert.equal(await nav.getByRole('link').count(),5);
 await panel.getByLabel('팀 이름', {exact:true}).fill('느긋한 저녁 책방');await panel.getByRole('button',{name:'팀 만들기',exact:true}).click();await panel.getByRole('heading',{name:'느긋한 저녁 책방',exact:true}).waitFor();
 assert.equal(await panel.locator('.team-desk').count(),1);await capture(page,'team1',width);
 await panel.getByRole('button',{name:'25분 제안',exact:true}).click();await panel.getByText(/첫 공부 연결 후/).waitFor();assert.equal(await page.evaluate(()=>fixture.team.round.started_at),null);
 await panel.getByRole('button',{name:'현재 공부를 팀에 연결',exact:true}).click();await panel.getByRole('button',{name:'잠시 쉬기',exact:true}).waitFor();assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.name==='team_study_action'&&c.args.p_action==='connect').length),1);assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c.name==='start_study_session')),false);
 await panel.getByRole('checkbox',{name:'지금 할 일 제목을 팀에 공유'}).check();await panel.locator('.team-desk').getByText('집중 독서',{exact:true}).waitFor();
 await page.evaluate(()=>{fixture.team.members.push({user_id:'friend',display_name:'친구#독서',state:'resting',title:null,share_title:false,started_at:null,paused_seconds:0,paused_at:null});fixture.team.team.member_count=2;fixture.signal();});await page.clock.runFor(250);await panel.getByText('친구#독서',{exact:true}).waitFor();assert.match(await panel.textContent(),/휴식 중/);await capture(page,'desks',width);
 await readableTeamText(page,['#together h1','.team-heading>div>p:last-child','.team-eyebrow','.team-personal .primary','.team-heading .secondary','.team-policy'],width);
 await panel.getByRole('button',{name:'팀 숲',exact:true}).click();await panel.getByRole('heading',{name:'함께 키우는 숲',exact:true}).waitFor();await capture(page,'forest-empty',width);
 await readableTeamText(page,['.team-forest-scene h3','.team-forest-scene p'],width);
 await page.evaluate(()=>{fixture.team.forest={accepted_seconds:7800,pending_sessions:1,trees:1,progress_seconds:600};fixture.signal();});await page.clock.runFor(250);await panel.getByText('1그루',{exact:true}).waitFor();assert.match(await panel.textContent(),/정산 대기 1/);await capture(page,'forest',width);
 await panel.getByRole('button',{name:'공부방',exact:true}).click();await panel.getByRole('button',{name:'친구 초대',exact:true}).click();assert.equal(await panel.getByLabel('공개 사용자 태그',{exact:true}).count(),0);await panel.getByLabel('초대할 전체 태그',{exact:true}).fill('친구#독서');await panel.getByRole('button',{name:'친구 확인',exact:true}).click();await panel.getByRole('button',{name:'이 친구에게 초대 보내기',exact:true}).click();
 await panel.getByRole('button',{name:'초대 링크 만들기',exact:true}).click();await panel.getByLabel('발급한 초대 링크',{exact:true}).waitFor();await capture(page,'invite',width);await panel.getByRole('button',{name:'링크 철회',exact:true}).click();assert.equal(await panel.getByLabel('발급한 초대 링크',{exact:true}).count(),0);
 await page.evaluate(()=>fixture.teamError=true);await panel.getByRole('button',{name:'상태 다시 확인',exact:true}).click();await panel.getByRole('alert').first().waitFor();assert.doesNotMatch(await panel.textContent(),/PRIVATE_RAW_EXCEPTION/);
 assert.equal(await panel.getByRole('button',{name:'잠시 쉬기',exact:true}).isDisabled(),false);assert.equal(await panel.getByRole('button',{name:'오늘 공부 종료',exact:true}).isDisabled(),false);
 await readableTeamText(page,['.team-error p'],width);
 await page.evaluate(()=>fixture.teamError=false);await panel.getByRole('button',{name:'상태 다시 확인',exact:true}).click();
 for(const el of await panel.locator('button,input:not([type=checkbox]),a').all()){if(await el.isVisible()){const box=await el.boundingBox();assert.ok(box.height>=44,await el.textContent());}}
 await page.evaluate(()=>{for(const el of document.querySelectorAll('#together h1,#together h2,#together p,#together label,#together button,#together strong,#together span'))el.style.fontSize=parseFloat(getComputedStyle(el).fontSize)*2+'px';});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await nav.locator('a[href="#today"]').click();await page.getByRole('heading',{name:'오늘의 공부',exact:true}).waitFor();assert.equal(await page.evaluate(()=>fixture.sessions[0].ended_at),null);assert.ok(await page.evaluate(()=>fixture.removed>=1));assert.equal(await page.getByRole('link',{name:'팀 공부',exact:true}).count(),1);
}));
mounted('team full Dashboard login preserves invite and explicit join clears it without auto-join',()=>withDashboard(375,'login','#together?invite='+token,async page=>{
 await page.getByText('함께 공부방 초대가 도착했어요.',{exact:true}).waitFor();assert.doesNotMatch(await page.locator('.login-panel').textContent(),new RegExp(token));assert.equal(await page.evaluate(()=>location.hash),'#together');
 await page.reload();await page.getByText('함께 공부방 초대가 도착했어요.',{exact:true}).waitFor();await page.evaluate(()=>{fixture.sessions=[];fixture.login();});
 const panel=page.locator('#together');await panel.getByRole('button',{name:'초대 내용 확인',exact:true}).click();await panel.getByRole('heading',{name:'초대받은 책방',exact:true}).waitFor();assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c.name==='team_study_action'&&c.args.p_action==='accept_invite')),false);
 await panel.getByRole('button',{name:'이 팀에 참여',exact:true}).click();await panel.getByRole('heading',{name:'초대받은 책방',exact:true}).waitFor();assert.equal(await page.evaluate(()=>sessionStorage.getItem('study-room:team-invite')),null);
}));
mounted('team Dashboard received invitations can be rejected; solo owner explicitly closes without ending study',()=>withDashboard(375,'active','#together',async page=>{
 const panel=page.locator('#together');await panel.getByLabel('팀 이름',{exact:true}).waitFor();await page.evaluate(()=>fixture.team.invitations=[{id:'received',team_name:'친구들의 책방',member_count:3,expires_at:'2026-09-28T00:00:00Z'}]);await page.clock.runFor(15000);await panel.getByRole('heading',{name:'친구들의 책방',exact:true}).waitFor();assert.equal(await page.evaluate(()=>fixture.team.team),null);await panel.getByRole('button',{name:'초대 거절',exact:true}).click();await panel.getByRole('heading',{name:'친구들의 책방',exact:true}).waitFor({state:'detached'});
 await panel.getByLabel('팀 이름',{exact:true}).fill('한 사람 책방');await panel.getByRole('button',{name:'팀 만들기',exact:true}).click();await panel.getByRole('button',{name:'팀 관리',exact:true}).click();assert.equal(await panel.getByRole('button',{name:'팀 탈퇴 확인',exact:true}).isDisabled(),true);await panel.getByRole('checkbox',{name:'팀을 해산하고 모든 팀 연결을 해제',exact:true}).check();await panel.getByRole('button',{name:'팀 해산 확인',exact:true}).click();await panel.getByRole('heading',{name:'함께 공부방',exact:true}).waitFor();assert.equal(await page.evaluate(()=>fixture.sessions[0].ended_at),null);assert.equal(await page.evaluate(()=>fixture.calls.some(c=>/pause_actual|confirm_actual|complete_study/.test(c.name))),false);
}));
mounted('team Dashboard keyboard cancellation, invalid token and explicit logout clear invitation safely',()=>withDashboard(375,'login','#together?invite='+token,async page=>{
 const cancel=page.getByRole('button',{name:'초대 취소',exact:true});await cancel.focus();assert.equal(await cancel.evaluate(el=>getComputedStyle(el).outlineStyle!=='none'),true);await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>sessionStorage.getItem('study-room:team-invite')),null);
 await page.evaluate(()=>{location.hash='#together?invite=malformed';window.dispatchEvent(new HashChangeEvent('hashchange'));});await page.waitForFunction(()=>location.hash==='#together');assert.equal(await page.getByText('함께 공부방 초대가 도착했어요.',{exact:true}).count(),0);assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c.name==='team_study_action')),false);
 await page.evaluate(token=>{location.hash='#together?invite='+token;window.dispatchEvent(new HashChangeEvent('hashchange'));fixture.sessions=[];},token);await page.getByText('함께 공부방 초대가 도착했어요.',{exact:true}).waitFor();await page.evaluate(()=>fixture.login());await page.locator('.mobile-navigation a[href="#settings"]').click();await page.getByRole('button',{name:'로그아웃',exact:true}).click();assert.equal(await page.evaluate(()=>sessionStorage.getItem('study-room:team-invite')),null);
}));
mounted('team Dashboard OAuth callback keeps pending invitation and returns to explicit team preview',()=>withDashboard(375,'login','#together?invite='+token,async page=>{
 await page.getByText('함께 공부방 초대가 도착했어요.',{exact:true}).waitFor();await page.goto(new URL('/auth/callback?mode=start&code=test-fixture',page.url()).href);await page.waitForLoadState('networkidle');await page.locator('#together').getByRole('button',{name:'초대 내용 확인',exact:true}).waitFor();assert.equal(await page.evaluate(()=>location.hash),'#together');assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c.name==='team_study_action')),false);assert.ok(await page.evaluate(()=>sessionStorage.getItem('study-room:team-invite')));
}));
mounted('team Dashboard invalid/revoked invitation shows Korean retry state and never joins',()=>withDashboard(375,'start','#together?invite='+token,async page=>{
 const panel=page.locator('#together');await panel.getByRole('button',{name:'초대 내용 확인',exact:true}).waitFor();await page.evaluate(()=>fixture.actionError='INVITE_INVALID');await panel.getByRole('button',{name:'초대 내용 확인',exact:true}).click();await panel.getByRole('alert').getByText(/유효하지 않거나 만료/).waitFor();assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c.name==='team_study_action'&&c.args.p_action==='accept_invite')),false);await capture(page,'invite-error',375);
}));
mounted('team full Dashboard shared round expiry never pauses or ends personal study',()=>withDashboard(375,'active','#together',async page=>{
 await page.clock.pauseAt(new Date('2026-09-21T14:30:30Z'));
 const panel=page.locator('#together');await panel.getByLabel('팀 이름',{exact:true}).fill('함께 집중');await panel.getByRole('button',{name:'팀 만들기',exact:true}).click();await panel.getByRole('button',{name:'25분 제안',exact:true}).click();await panel.getByRole('button',{name:'현재 공부를 팀에 연결',exact:true}).click();await panel.getByText(/남은 시간 25:00/).waitFor();
 await page.clock.runFor(2100);await panel.getByText(/남은 시간 24:58/).waitFor();await panel.getByRole('button',{name:'팀 숲',exact:true}).click();await page.clock.fastForward(26*60000);await panel.getByRole('status').filter({hasText:'집중 시간이 끝났어요. 공부는 계속됩니다.'}).waitFor();assert.equal(await page.evaluate(()=>fixture.sessions[0].ended_at),null);assert.equal(await page.evaluate(()=>fixture.calls.some(c=>/pause_actual|confirm_actual|complete_study/.test(c.name))),false);await panel.getByRole('button',{name:'공부방',exact:true}).click();await panel.getByRole('button',{name:'완료 알림 닫기',exact:true}).click();await panel.getByRole('status').filter({hasText:'집중 시간이 끝났어요. 공부는 계속됩니다.'}).waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>fixture.sessions[0].ended_at),null);assert.equal(await page.evaluate(()=>fixture.team.team.id),'team');
}));
mounted('team full Dashboard start uses camera gate; cancelling never queues connect or starts study',()=>withDashboard(375,'start','#together',async page=>{
 const panel=page.locator('#together');await panel.getByLabel('팀 이름',{exact:true}).fill('책방');await panel.getByRole('button',{name:'팀 만들기',exact:true}).click();await panel.getByRole('button',{name:'개인 공부 시작',exact:true}).click();await page.getByRole('dialog',{name:'카메라 인증 필요'}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>fixture.sessions.length),0);assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c.name==='team_study_action'&&c.args.p_action==='connect')),false);assert.match(await panel.textContent(),/팀에 영상은 전송하지/);
}));
mounted('team full Dashboard identity swap cannot display a late old-team snapshot',()=>withDashboard(1440,'active','#together',async page=>{
 const panel=page.locator('#together');await panel.getByLabel('팀 이름',{exact:true}).fill('이전 계정 책방');await panel.getByRole('button',{name:'팀 만들기',exact:true}).click();await panel.getByRole('heading',{name:'이전 계정 책방',exact:true}).waitFor();await page.evaluate(()=>fixture.holdTeam=true);await panel.getByRole('button',{name:'상태 다시 확인',exact:true}).click();await page.waitForFunction(()=>!!fixture.releaseTeam);await page.evaluate(()=>{fixture.holdTeam=false;fixture.changeOwner();fixture.releaseTeam();});await panel.getByRole('heading',{name:'함께 공부방',exact:true}).waitFor();assert.doesNotMatch(await panel.textContent(),/이전 계정 책방/);
}));
mounted('team full Dashboard keeps private live camera node through Today and team navigation',()=>withDashboard(375,'active','#today',async page=>{
 const entry=page.getByRole('link',{name:'팀 공부',exact:true});await entry.waitFor();const entryBox=await entry.boundingBox();console.log('Today Team entry first-load touch box '+JSON.stringify(entryBox));assert.ok(entryBox.height>=44&&entryBox.width>=44);
 const tools=page.locator('.focus-tools');await tools.locator('summary').click();await tools.getByRole('button',{name:'카메라 감시 켜기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('video')?.srcObject?.getVideoTracks()[0]?.readyState==='live');
 await page.evaluate(()=>window.initialVideo=document.querySelector('video'));await page.getByRole('link',{name:'팀 공부',exact:true}).click();await page.locator('#together h1').waitFor();
 assert.equal(await page.evaluate(()=>document.querySelector('video')===window.initialVideo),true);assert.equal(await page.evaluate(()=>document.querySelector('video')?.srcObject?.getVideoTracks()[0]?.readyState),'live');assert.equal(await tools.isVisible(),true);assert.equal(await tools.locator('.focus-control').isVisible(),false);assert.equal(await page.locator('video').isVisible(),false);
 await page.waitForFunction(()=>document.querySelector('video')?.videoWidth>0);await page.clock.runFor(3000);assert.equal(await page.evaluate(()=>document.querySelector('video')?.srcObject?.getVideoTracks()[0]?.readyState),'live');
 await page.locator('.mobile-navigation a[href="#today"]').click();assert.equal(await tools.isVisible(),true);assert.equal(await page.evaluate(()=>document.querySelector('video')===window.initialVideo),true);assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c.name==='pause_actual_study_session')),false);
}));
mounted('team full Dashboard direct team start completes personal gates before explicit connect',()=>withDashboard(375,'start','#together',async page=>{
 const panel=page.locator('#together');await panel.getByLabel('팀 이름',{exact:true}).fill('준비하는 책방');await panel.getByRole('button',{name:'팀 만들기',exact:true}).click();await page.evaluate(()=>fixture.collision=false);await panel.getByRole('button',{name:'개인 공부 시작',exact:true}).click();await page.getByRole('button',{name:'카메라 켜고 시작',exact:true}).click();
 await page.getByRole('dialog',{name:'이번 세션에서 할 일 선택'}).getByRole('button',{name:'선택한 할 일로 시작',exact:true}).click();await panel.getByRole('button',{name:'현재 공부를 팀에 연결',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.querySelector('video')?.srcObject?.getVideoTracks()[0]?.readyState),'live');assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c.name==='team_study_action'&&c.args.p_action==='connect')),false);
 await panel.getByRole('button',{name:'현재 공부를 팀에 연결',exact:true}).click();await panel.getByRole('button',{name:'잠시 쉬기',exact:true}).waitFor();assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.name==='confirm_actual_study_action').length),1);
 await panel.getByRole('button',{name:'잠시 쉬기',exact:true}).click();await panel.getByRole('button',{name:'공부 계속하기',exact:true}).waitFor();assert.ok(await page.evaluate(()=>fixture.sessions[0].paused_at));await panel.getByRole('button',{name:'공부 계속하기',exact:true}).click();await page.getByRole('button',{name:'카메라 켜고 공부 계속하기',exact:true}).click();await panel.getByRole('button',{name:'잠시 쉬기',exact:true}).waitFor();assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.name==='team_study_action'&&c.args.p_action==='connect').length),1);
}));
for(const scenario of ['stalled-connected','disconnected-error','unjoined-error','missing-snapshot'])mounted(`team personal actions remain independent: ${scenario}`,()=>withDashboard(375,scenario==='missing-snapshot'?'active-team-unavailable':'active','#together',async page=>{
 const panel=page.locator('#together');
 if(scenario!=='missing-snapshot'){
  await panel.getByLabel('팀 이름',{exact:true}).fill('개인 공부는 그대로');await panel.getByRole('button',{name:'팀 만들기',exact:true}).click();await panel.getByRole('heading',{name:'개인 공부는 그대로',exact:true}).waitFor();
  if(scenario!=='disconnected-error'){await panel.getByRole('button',{name:'현재 공부를 팀에 연결',exact:true}).click();await panel.getByRole('button',{name:'잠시 쉬기',exact:true}).waitFor();}
  if(scenario==='stalled-connected'){await page.evaluate(()=>fixture.holdAction=true);await panel.getByRole('button',{name:'25분 제안',exact:true}).click();await page.waitForFunction(()=>!!fixture.releaseAction);}
  else {if(scenario==='unjoined-error'){await panel.getByRole('button',{name:'25분 제안',exact:true}).click();await panel.getByRole('button',{name:'이 공부로 함께 집중 참여',exact:true}).waitFor();}await page.evaluate(()=>fixture.teamError=true);await panel.getByRole('button',{name:'상태 다시 확인',exact:true}).click();await panel.getByRole('alert').waitFor();}
 }else await panel.getByRole('alert').waitFor();
 const pause=panel.getByRole('button',{name:'잠시 쉬기',exact:true}),end=panel.getByRole('button',{name:'오늘 공부 종료',exact:true});await pause.waitFor();assert.equal(await pause.isDisabled(),false);assert.equal(await end.isDisabled(),false);await pause.click();await panel.getByRole('button',{name:'공부 계속하기',exact:true}).waitFor();assert.ok(await page.evaluate(()=>fixture.sessions[0].paused_at));assert.equal(await end.isDisabled(),false);assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.name==='pause_actual_study_session').length),1);
 if(scenario==='stalled-connected')await page.evaluate(()=>{fixture.holdAction=false;fixture.releaseAction();});
}));
for(const delayed of [false,true])mounted(`team invitation preview is token-bound during replacement delayed=${delayed}`,()=>withDashboard(375,'start','#together?invite='+token,async page=>{
 const panel=page.locator('#together'),b='b'.repeat(64);await panel.getByRole('button',{name:'초대 내용 확인',exact:true}).waitFor();
 if(delayed)await page.evaluate(()=>fixture.holdPreview=true);await panel.getByRole('button',{name:'초대 내용 확인',exact:true}).click();if(delayed)await page.waitForFunction(()=>!!fixture.releasePreview);else await panel.getByRole('heading',{name:'초대받은 책방',exact:true}).waitFor();
 await page.evaluate(token=>{location.hash='#together?invite='+token;window.dispatchEvent(new HashChangeEvent('hashchange'));},b);
 assert.equal(await panel.getByRole('button',{name:'이 팀에 참여',exact:true}).count(),0);assert.equal(await panel.getByRole('heading',{name:'초대받은 책방',exact:true}).count(),0);
 if(delayed){await page.evaluate(()=>{fixture.holdPreview=false;fixture.releasePreview();});await panel.getByRole('button',{name:'초대 내용 확인',exact:true}).waitFor();assert.equal(await panel.getByRole('heading',{name:'초대받은 책방',exact:true}).count(),0);}
 await panel.getByRole('button',{name:'초대 내용 확인',exact:true}).click();await panel.getByRole('heading',{name:'두 번째 책방',exact:true}).waitFor();await panel.getByRole('button',{name:'이 팀에 참여',exact:true}).click();await page.waitForFunction(()=>fixture.calls.some(c=>c.name==='team_study_action'&&c.args.p_action==='accept_invite'));assert.deepEqual(await page.evaluate(()=>fixture.calls.find(c=>c.name==='team_study_action'&&c.args.p_action==='accept_invite').args.p_payload),{token:b});
}));
for(const width of [375,1440])mounted(`team Today entry preserves first-screen personal hierarchy at ${width}px`,()=>withDashboard(width,'active','#today',async page=>{
 const entry=page.getByRole('link',{name:'팀 공부',exact:true}),timer=page.getByRole('timer',{name:'이번 세션 공부시간',exact:true});await timer.waitFor();
 const entryBox=await entry.boundingBox(),timerBox=await timer.boundingBox();console.log('Today hierarchy '+width+'px '+JSON.stringify({entryBox,timerBox}));
 assert.ok(entryBox.width>=44&&entryBox.height>=44);assert.ok(timerBox.y<700,'personal timer stays on the first screen');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await capture(page,'today-entry',width);
}));
for(const width of [375,1440])mounted(`team operational lease and DND warnings remain visible without private camera at ${width}px`,()=>withDashboard(width,'lease','#together',async page=>{
 const warning=page.locator('.focus-status-warning');await warning.getByText(/세션 유지 시간이/).waitFor();assert.equal(await warning.isVisible(),true);await warning.getByText('휴대폰 집중 모드 · 휴대폰 연결 테스트 오류',{exact:true}).waitFor();await warning.getByText('테스트 카메라 경고 전송 오류',{exact:true}).waitFor();
 assert.equal(await page.locator('video').isVisible(),false);const before=await page.evaluate(()=>fixture.sessions[0].lease_expires_at);await capture(page,'lease-warning',width);
 await warning.getByRole('button',{name:'+1시간 연장',exact:true}).click();await page.waitForFunction(before=>fixture.sessions[0].lease_expires_at!==before,before);await warning.getByText(/세션 유지 시간이/).waitFor({state:'detached'});
 const lease=page.locator('.session-lease');await lease.waitFor();assert.equal(await lease.isVisible(),true);assert.equal(await lease.getByRole('button',{name:'+1시간 연장',exact:true}).isEnabled(),true);
 assert.deepEqual(await page.evaluate(()=>fixture.calls.filter(c=>c.name==='extend_study_session_lease').map(c=>c.args)),[{p_session_id:'session',p_extension_minutes:60}]);assert.equal(await page.evaluate(()=>fixture.sessions[0].ended_at),null);assert.deepEqual(await page.evaluate(()=>fixture.calls.filter(c=>['pause_actual_study_session','confirm_actual_study_action','end_study_session','complete_study_session'].includes(c.name)).map(c=>c.name)),[]);
 await warning.getByText('휴대폰 집중 모드 · 휴대폰 연결 테스트 오류',{exact:true}).waitFor();await capture(page,'lease-extended',width);
}));

for(const width of [375,1440])mounted(`personal-first study tabs and account-only tag editing at ${width}px`,()=>withDashboard(width,'active','',async page=>{
 const modes=page.getByRole('navigation',{name:'공부 방식'});
 await page.getByRole('timer',{name:'이번 세션 공부시간',exact:true}).waitFor();
 assert.equal(await modes.getByRole('link',{name:'내 공부',exact:true}).getAttribute('aria-current'),'page');
 assert.equal(await page.getByLabel('공개 사용자 태그',{exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c.name.startsWith('team_study_'))),false);
 await modes.getByRole('link',{name:'팀 공부',exact:true}).click();
 const panel=page.locator('#together');await panel.getByLabel('팀 이름',{exact:true}).waitFor();
 assert.equal(await modes.getByRole('link',{name:'팀 공부',exact:true}).getAttribute('aria-current'),'page');
 await readableTeamText(page,['.study-mode-tabs a'],width);
 assert.equal(await panel.getByLabel('공개 사용자 태그',{exact:true}).count(),0);
 assert.equal(await panel.getByRole('button',{name:'개인 공부 시작',exact:true}).count(),0);
 await capture(page,'settings-navigation-teamless',width);
 await page.evaluate(()=>fixture.team.tag='기존이름#독서');
 await panel.getByRole('link',{name:'공개 태그 설정하기',exact:true}).click();
 const account=page.getByRole('region',{name:'계정',exact:true});
 const tag=account.getByLabel('공개 사용자 태그',{exact:true});await page.waitForFunction(()=>document.querySelector('#settings-public-tag')?.value==='기존이름#독서');
 assert.equal(await tag.inputValue(),'기존이름#독서');
 await tag.fill(' A스타#지니 ');await account.getByRole('button',{name:'태그 저장',exact:true}).click();
 await account.getByText('공개 태그를 저장했어요.',{exact:true}).waitFor();
 assert.equal(await tag.inputValue(),'a스타#지니');
 assert.deepEqual(await page.evaluate(()=>fixture.calls.filter(c=>c.name==='team_study_action').map(c=>[c.args.p_action,c.args.p_payload])),[['set_tag',{tag:'a스타#지니'}]]);
 await capture(page,'settings-public-tag',width);
 for(const el of await account.locator('button,input,a').all()){const box=await el.boundingBox();assert.ok(box.height>=44);}
 await readableTeamText(page,['.public-tag-settings label','.public-tag-settings p'],width);
 await tag.focus();await page.keyboard.press('Tab');assert.equal(await account.getByRole('button',{name:'태그 저장',exact:true}).evaluate(el=>el===document.activeElement),true);
 const nav=page.locator(width===375?'.mobile-navigation':'.desktop-navigation');await nav.locator('a[href="#today"]').click();
 await modes.getByRole('link',{name:'팀 공부',exact:true}).click();await panel.getByLabel('팀 이름',{exact:true}).waitFor();
 await panel.getByLabel('팀 이름',{exact:true}).fill('함께하는 책방');await panel.getByRole('button',{name:'팀 만들기',exact:true}).click();
 await panel.getByRole('button',{name:'친구 초대',exact:true}).click();
 await panel.getByLabel('초대할 전체 태그',{exact:true}).waitFor();assert.equal(await panel.getByLabel('공개 사용자 태그',{exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>fixture.sessions[0].ended_at),null);assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c.name==='pause_actual_study_session')),false);
}));

mounted('public tag settings validate input and preserve draft after save failure',()=>withDashboard(375,'active','#settings',async page=>{
 const account=page.getByRole('region',{name:'계정',exact:true}),tag=account.getByLabel('공개 사용자 태그',{exact:true});await tag.waitFor();
 await tag.fill('잘못된태그');await account.getByRole('button',{name:'태그 저장',exact:true}).click();
 await account.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c.name==='team_study_action')),false);
 await tag.fill('내이름#독서');await page.evaluate(()=>fixture.actionError='TAG_TAKEN');await account.getByRole('button',{name:'태그 저장',exact:true}).click();
 await account.getByRole('alert').waitFor();assert.equal(await tag.inputValue(),'내이름#독서');assert.equal(await account.getByText('공개 태그를 저장했어요.',{exact:true}).count(),0);
 await page.evaluate(()=>fixture.actionError=null);await account.getByRole('button',{name:'태그 저장',exact:true}).click();await account.getByText('공개 태그를 저장했어요.',{exact:true}).waitFor();
}));

mounted('public tag settings loading failure retries without changing study or exposing raw errors',()=>withDashboard(375,'active','#today',async page=>{
 await page.getByRole('timer',{name:'이번 세션 공부시간',exact:true}).waitFor();await page.evaluate(()=>fixture.teamError=true);
 await page.locator('.mobile-navigation a[href="#settings"]').click();const account=page.getByRole('region',{name:'계정',exact:true});
 await account.getByRole('alert').waitFor();assert.doesNotMatch(await account.textContent(),/PRIVATE_RAW_EXCEPTION/);
 assert.equal(await account.getByRole('button',{name:'태그 저장',exact:true}).isDisabled(),true);
 await page.evaluate(()=>{fixture.teamError=false;fixture.team.tag='읽기성공#독서';});await account.getByRole('button',{name:'태그 다시 확인',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#settings-public-tag')?.value==='읽기성공#독서');
 assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c.name==='team_study_action')),false);assert.equal(await page.evaluate(()=>fixture.sessions[0].ended_at),null);
}));

mounted('public tag settings late save is discarded on account switch',()=>withDashboard(375,'active','#settings',async page=>{
 const account=page.getByRole('region',{name:'계정',exact:true}),tag=account.getByLabel('공개 사용자 태그',{exact:true});await tag.fill('이전계정#독서');
 await page.evaluate(()=>fixture.holdAction=true);await account.getByRole('button',{name:'태그 저장',exact:true}).click();await page.waitForFunction(()=>!!fixture.releaseAction);
 await page.evaluate(()=>{fixture.currentAuth={...fixture.currentAuth,user:{...fixture.currentAuth.user,id:'other'}};fixture.holdAction=false;fixture.changeOwner();fixture.releaseAction();});
 await page.waitForFunction(()=>document.querySelector('#settings-public-tag')&&!document.querySelector('#settings-public-tag').disabled);
 assert.equal(await tag.inputValue(),'');assert.equal(await account.getByText('공개 태그를 저장했어요.',{exact:true}).count(),0);
}));
