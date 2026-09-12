import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {createTechFeedHandler} from './tech-feed-api.mjs';
import {createTavilySearch} from './tech-feed-search.mjs';
import {runSearchWorker} from './tech-feed-search-worker.mjs';
const owner='00000000-0000-4000-8000-000000000101',other='00000000-0000-4000-8000-000000000102';
let db;
before(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema coaching_private;create table auth.users(id uuid primary key);
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
 create function auth.jwt()returns jsonb language sql stable as $$select jsonb_build_object('role',current_setting('role',true),'sub',auth.uid(),'is_anonymous',false)$$;
 create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;
 grant usage on schema auth,public,coaching_private to anon,authenticated,service_role;
 create table profiles(user_id uuid primary key references auth.users,time_zone text);
 create table study_goals(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users);
 create table study_todos(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users,local_date date not null,title text not null,start_time time,end_time time,goal_id uuid references study_goals);
 grant all on profiles,study_todos,study_goals to service_role;
 insert into auth.users values('${owner}'),('${other}');insert into profiles values('${owner}','Asia/Seoul'),('${other}','Asia/Seoul');`);
 await db.exec(readFileSync('supabase/migrations/20260906083030_studyroom_v2_coach.sql','utf8'));
 for(const name of readdirSync('supabase/migrations').filter(n=>/_tech_feed(?:_web_search)?\.sql$/.test(n)).sort())await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
});
after(async()=>await db?.close());
async function tx(run){await db.exec('begin');try{await run();}finally{await db.exec('rollback');}}
async function rpc(name,...args){return(await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value;}
async function config(user=owner,prompt='AWS Lambda',revision=0,receiving=true){return rpc('tech_feed_configure',user,prompt,prompt.toLowerCase(),receiving,revision);}
async function claim(){return rpc('tech_feed_search_claim');}
async function seedSearch(){await config();const job=await claim();await rpc('tech_feed_search_reserve',job.id,job.lease,900);await rpc('tech_feed_search_finish',job.id,job.lease,[{title:'AWS launch',url:'https://example.com/search',excerpt:'AWS Lambda public evidence '.repeat(15),published_at:null}],null);return(await db.query("select * from tech_feed_articles where url='https://example.com/search'")).rows[0];}
function apiCall(action,data={},user=owner,env={TECH_FEED_ACCESS_MODE:'self_service',TECH_FEED_ENABLED:'false'}){
 const handler=createTechFeedHandler({env:()=>env,authenticate:async()=>({id:user,store:{
  state:()=>rpc('tech_feed_state',user),configure:(value)=>rpc('tech_feed_configure',user,value.prompt,value.canonical,value.receiving,value.expected_revision),
  receiving:(value)=>rpc('tech_feed_receiving',user,value.receiving,value.expected_revision),
  list:(...args)=>rpc('tech_feed_list',user,...args),mutate:(action,value)=>rpc('tech_feed_mutate',user,action,value),
 }}),transport:async()=>{throw Error('unexpected network');}});
 return handler(new Request('https://example.com/tech-feed',{method:'POST',body:JSON.stringify({action,...data})}));
}
test('real API saves interests while paused and rejects stale revisions with 409',async()=>tx(async()=>{
 const first=await apiCall('topics_save',{prompt:'  AWS   Lambda ',receiving:true,expected_revision:0});assert.equal(first.status,200);assert.deepEqual((await first.json()).preferences,{prompt:'AWS Lambda',receiving:true,revision:1});
 await db.exec('savepoint stale');const stale=await apiCall('topics_save',{prompt:'Python',receiving:true,expected_revision:0});assert.equal(stale.status,409);await db.exec('rollback to stale');
 const state=await(await apiCall('state')).json();assert.equal(state.service_available,false);assert.equal(state.search_status.state,'paused');assert.equal(state.preferences.prompt,'AWS Lambda');
 assert.equal((await apiCall('receiving',{receiving:false,expected_revision:1})).status,200);
}));
test('equivalent topics share cache without sharing private preferences or manual subscriptions',async()=>tx(async()=>{
 await db.exec("update tech_feed_sources set permission_status='approved' where name in('GeekNews','Hacker News')");
 const sid=(await db.query("select id from tech_feed_sources where name='GeekNews'")).rows[0].id;
 await rpc('tech_feed_mutate',owner,'subscribe',{source_id:sid,subscribed:false});await config();await config(other,'aws lambda');
 assert.equal((await db.query('select count(*)::int n from tech_feed_search_topics')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from tech_feed_subscriptions where user_id=$1 and subscribed',[owner])).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from tech_feed_subscriptions where user_id=$1 and subscribed',[other])).rows[0].n,2);
 await db.exec(`set local role authenticated;select set_config('request.uid','${other}',true)`);
 assert.equal((await db.query('select * from tech_feed_preferences')).rows.length,1);
 assert.equal((await db.query('select * from tech_feed_topic_memberships')).rows.length,1);
 await db.exec('savepoint internal');await assert.rejects(db.query('select * from tech_feed_search_topics'),/permission denied/);await db.exec('rollback to internal');
 await db.exec('savepoint write');await assert.rejects(db.query("update tech_feed_preferences set prompt='stolen'"),/permission denied/);await db.exec('rollback to write');
 assert.equal((await db.query("select has_function_privilege('authenticated','tech_feed_configure(uuid,text,text,boolean,integer)','execute') ok")).rows[0].ok,false);
}));
test('search article RLS/list/save/todo remain owner-safe after pause and topic change',async()=>tx(async()=>{
 const article=await seedSearch();let data=await rpc('tech_feed_list',owner,'latest',null,null,null);assert.equal(data.items[0].origin,'web_search');assert.deepEqual(data.items[0].matched_topics,['AWS Lambda']);assert.equal(data.items[0].excerpt_provenance,'search_snippet');
 assert.equal((await rpc('tech_feed_list',other,'latest',null,null,null)).items.length,0);
 await db.exec(`set local role authenticated;select set_config('request.uid','${other}',true)`);assert.equal((await db.query('select * from tech_feed_articles')).rows.length,0);await db.exec('reset role');
 await rpc('tech_feed_mutate',owner,'save',{article_id:article.id,saved:true});await rpc('tech_feed_receiving',owner,false,1);await config(owner,'Python',2,false);
 data=await rpc('tech_feed_list',owner,'saved','frontend',other,null);assert.equal(data.items.length,1);assert.deepEqual(data.items[0].matched_topics,[]);
 const input={article_id:article.id,title:'Read',local_date:'2026-09-13'};assert.equal((await rpc('tech_feed_mutate',owner,'add_todo',input)).todo_id,(await rpc('tech_feed_mutate',owner,'add_todo',input)).todo_id);
 await db.exec('savepoint denied');await assert.rejects(rpc('tech_feed_mutate',other,'save',{article_id:article.id,saved:true}),/not_found/);await db.exec('rollback to denied');
}));
test('provider lease and monthly reservation serialize last credit and failed requests never refund',async()=>tx(async()=>{
 await config();await config(other,'Python');const job=await claim();assert.ok(job.lease);assert.equal(await claim(),null);
 await db.query("insert into tech_feed_search_budget(month,attempts)values(date_trunc('month',now())::date,899)");
 const [a,b]=await Promise.all([rpc('tech_feed_search_reserve',job.id,job.lease,900),rpc('tech_feed_search_reserve',job.id,job.lease,900)]);assert.deepEqual([a,b],[true,false]);
 await rpc('tech_feed_search_finish',job.id,job.lease,[],'unavailable');assert.equal(await claim(),null);await db.exec("update tech_feed_search_provider set run_after=now()");const next=await claim();assert.ok(next);assert.equal(await rpc('tech_feed_search_reserve',next.id,next.lease,900),false);
 assert.equal((await db.query('select attempts from tech_feed_search_budget')).rows[0].attempts,900);assert.equal((await db.query('select failures from tech_feed_search_topics where id=$1',[job.id])).rows[0].failures,1);
 await rpc('tech_feed_search_finish',next.id,next.lease,[],'quota_exhausted');
 assert.equal((await db.query('select count(*)::int n from tech_feed_articles')).rows[0].n,0);
}));
test('topic hour TTL, stale leases and failed refresh retain cached success',async()=>tx(async()=>{
 const article=await seedSearch();assert.equal(await claim(),null);
 await db.exec("update tech_feed_search_topics set run_after=now()-interval '1 second'");const next=await claim();
 assert.equal(await rpc('tech_feed_search_finish',next.id,other,[],null),false);
 await rpc('tech_feed_search_reserve',next.id,next.lease,900);await rpc('tech_feed_search_finish',next.id,next.lease,[],'unavailable');
 assert.equal((await rpc('tech_feed_list',owner,'latest',null,null,null)).items[0].id,article.id);assert.ok((await rpc('tech_feed_state',owner)).search_status.last_success_at);
}));
test('search snippet summary uses shared six-call quota and pause cannot sponsor a call',async()=>tx(async()=>{
 const article=await seedSearch();await db.exec('set local role service_role');const claims=(await db.query('select * from tech_feed_claim_summaries($1)',[[owner]])).rows;assert.equal(claims[0].article.id,article.id);
 await rpc('tech_feed_receiving',owner,false,1);assert.equal(await rpc('tech_feed_begin_summary_attempt',[article.id],[claims[0].lease],owner),false);
 await rpc('tech_feed_receiving',owner,true,2);assert.equal(await rpc('tech_feed_begin_summary_attempt',[article.id],[claims[0].lease],owner),true);
 assert.equal(await rpc('tech_feed_begin_summary_attempt',[article.id],[claims[0].lease],owner),false);
 assert.equal(await rpc('tech_feed_finish_summary',article.id,claims[0].lease,owner,null,'failed',null),true);
 assert.equal((await db.query('select attempts from coach_ai_usage where user_id=$1',[owner])).rows[0].attempts,1);
}));




test('no permitted RSS or configured search is honestly unavailable and invalid topics never mutate',async()=>tx(async()=>{
 await config();const state=await(await apiCall('state',{},owner,{TECH_FEED_ACCESS_MODE:'self_service',TECH_FEED_ENABLED:'true'})).json();
 assert.equal(state.search_status.state,'not_configured');assert.equal(state.service_available,false);
 const response=await apiCall('topics_save',{prompt:'person@example.com',receiving:true,expected_revision:1});assert.equal(response.status,400);
 assert.equal((await rpc('tech_feed_state',owner)).preferences.revision,1);
}));
test('pagination filters matched search articles before limit and preserves chronological URL-dedup union',async()=>tx(async()=>{
 const article=await seedSearch();const topic=(await db.query('select id from tech_feed_search_topics')).rows[0].id;
 await db.exec("insert into tech_feed_articles(title,url)select 'Unrelated','https://example.org/'||n from generate_series(1,25)n");
 await db.query("insert into tech_feed_articles(title,url,origin,interests,discovered_at)select 'Matched','https://example.com/page/'||n,'web_search',array['cloud'],now()-interval '1 minute' from generate_series(1,24)n");
 await db.query("insert into tech_feed_topic_articles(topic_id,article_id,snippet)select $1,id,'Evidence'from tech_feed_articles where url like 'https://example.com/page/%'",[topic]);
 const a=await rpc('tech_feed_list',owner,'latest','cloud',null,null),b=await rpc('tech_feed_list',owner,'latest','cloud',null,a.next_cursor);
 assert.equal(a.items.length,20);assert.equal(b.items.length,4);assert.equal(b.next_cursor,null);assert.equal(new Set([...a.items,...b.items].map(x=>x.id)).size,24);
 assert.ok(!a.items.some(x=>x.id===article.id));
}));
test('search cannot overwrite stronger RSS evidence and empty result is a cached success',async()=>tx(async()=>{
 const sid=(await db.query("insert into tech_feed_sources(name,url,permission_status)values('RSS','https://example.com/rss','approved')returning id")).rows[0].id;
 const old=(await db.query("insert into tech_feed_articles(title,url,excerpt,excerpt_source_id)values('Original','https://example.com/search','Strong RSS evidence',$1)returning *",[sid])).rows[0];
 await seedSearch();const row=(await db.query('select * from tech_feed_articles where id=$1',[old.id])).rows[0];assert.equal(row.excerpt,'Strong RSS evidence');assert.equal(row.origin,'rss');assert.equal(row.excerpt_source_id,sid);
 await config(other,'Python');const job=await claim();assert.equal(await rpc('tech_feed_search_reserve',job.id,job.lease,900),true);assert.equal(await rpc('tech_feed_search_finish',job.id,job.lease,[],null),true);
 assert.equal((await rpc('tech_feed_state',other)).search_status.state,'ready');assert.equal((await rpc('tech_feed_list',other,'latest',null,null,null)).items.length,0);assert.equal(await claim(),null);
}));
test('prior month does not consume current month and zero cap cannot reserve',async()=>tx(async()=>{
 await config();await db.exec("insert into tech_feed_search_budget(month,attempts)values((date_trunc('month',now())-interval '1 month')::date,900)");
 const job=await claim();assert.equal(await rpc('tech_feed_search_reserve',job.id,job.lease,0),false);assert.equal(await rpc('tech_feed_search_reserve',job.id,job.lease,99999),true);
 assert.equal((await db.query("select attempts from tech_feed_search_budget where month=date_trunc('month',now())::date")).rows[0].attempts,1);
}));



test('explicitly paused topic receiver cannot sponsor RSS collection',async()=>tx(async()=>{
 await db.exec("update tech_feed_sources set permission_status='approved'where name='Hacker News'");await config();await rpc('tech_feed_receiving',owner,false,1);
 assert.equal((await db.query('select * from tech_feed_claim_sources($1,2)',[[owner]])).rows.length,0);
 await rpc('tech_feed_receiving',owner,true,2);assert.equal((await db.query('select * from tech_feed_claim_sources($1,2)',[[owner]])).rows.length,1);
}));
test('search summaries cannot exceed shared six total AI calls including failures',async()=>tx(async()=>{
 const article=await seedSearch();await db.exec('set local role service_role');
 for(let i=0;i<5;i++)assert.equal(await rpc('coach_reserve_ai',owner),true);
 let claims=(await db.query('select * from tech_feed_claim_summaries($1)',[[owner]])).rows;assert.equal(claims.length,1);
 assert.equal(await rpc('tech_feed_begin_summary_attempt',[article.id],[claims[0].lease],owner),true);
 assert.equal(await rpc('tech_feed_finish_summary',article.id,claims[0].lease,owner,null,'failed',null),true);
 await db.exec("update tech_feed_articles set summary_retry_at=now()");claims=(await db.query('select * from tech_feed_claim_summaries($1)',[[owner]])).rows;assert.equal(claims.length,0);
 assert.equal(await rpc('coach_reserve_ai',owner),false);assert.equal((await db.query('select attempts from coach_ai_usage where user_id=$1',[owner])).rows[0].attempts,6);
}));
async function ingestProviderResults(results){
 const search=createTavilySearch({env:{TAVILY_API_KEY:'synthetic'},fetchImpl:async(url)=>Response.json(url.endsWith('/usage')?{key:{usage:0,limit:1000},account:{current_plan:'Free',plan_usage:0,plan_limit:1000,paygo_usage:0,paygo_limit:0}}:{results})});
 return runSearchWorker({search,store:{claimSearch:()=>claim(),reserveSearch:(id,lease)=>rpc('tech_feed_search_reserve',id,lease,900),finishSearch:(id,lease,items,error)=>rpc('tech_feed_search_finish',id,lease,items,error)}});
}
async function dueAgain(){await db.exec("update tech_feed_search_topics set run_after=now()");}
test('provider result through search worker persists interests and appears in cloud-filtered list',async()=>tx(async()=>{
 await config(owner,'Python database');const result=await ingestProviderResults([{title:'AWS Lambda release',url:'https://example.com/classified',content:'AWS cloud release details.'}]);
 assert.equal(result.state,'ready');const page=await rpc('tech_feed_list',owner,'latest','cloud',null,null);
 assert.equal(page.items.length,1);assert.equal(page.items[0].url,'https://example.com/classified');assert.deepEqual(page.items[0].interests,['cloud']);
}));
test('same URL short-to-substantive refresh updates list and AI eligibility without redating',async()=>tx(async()=>{
 await config();const initial={title:'AWS Lambda release',url:'https://example.com/refresh',content:'Brief'};
 assert.equal((await ingestProviderResults([initial])).state,'ready');
 const before=(await rpc('tech_feed_list',owner,'latest',null,null,null)).items[0];assert.equal(before.summary_status,'insufficient');
 const evidence='AWS Lambda now supports the new public feature described in this search result. '.repeat(4);
 await dueAgain();assert.equal((await ingestProviderResults([{...initial,content:evidence}])).state,'ready');
 const after=(await rpc('tech_feed_list',owner,'latest',null,null,null)).items[0];
 assert.equal(after.id,before.id);assert.equal(after.discovered_at,before.discovered_at);assert.equal(after.published_at,before.published_at);
 assert.equal(after.excerpt,evidence.trim());assert.equal(after.summary_status,'pending');
 const claims=(await db.query('select * from tech_feed_claim_summaries($1)',[[owner]])).rows;
 assert.equal(claims.length,1);assert.equal(claims[0].article.excerpt,evidence.trim());
}));
test('changed search evidence invalidates in-flight and cached summaries while unchanged evidence preserves cache',async()=>tx(async()=>{
 await config();const initial={title:'AWS Lambda release',url:'https://example.com/evidence',content:'AWS Lambda public feature description. '.repeat(8)};
 await ingestProviderResults([initial]);await db.exec('set local role service_role');
 let claim=(await db.query('select * from tech_feed_claim_summaries($1)',[[owner]])).rows[0];
 assert.equal(await rpc('tech_feed_begin_summary_attempt',[claim.article.id],[claim.lease],owner),true);
 const changed={...initial,content:'AWS Lambda updated public feature description and its limitations. '.repeat(6)};
 await dueAgain();await ingestProviderResults([changed]);
 const summary={technology:'AWS Lambda',change:'Changed feature',usage:'Cloud services'};
 assert.equal(await rpc('tech_feed_finish_summary',claim.article.id,claim.lease,owner,summary,'ready','news'),false);
 claim=(await db.query('select * from tech_feed_claim_summaries($1)',[[owner]])).rows[0];
 assert.equal(await rpc('tech_feed_begin_summary_attempt',[claim.article.id],[claim.lease],owner),true);
 assert.equal(await rpc('tech_feed_finish_summary',claim.article.id,claim.lease,owner,summary,'ready','news'),true);
 await dueAgain();await ingestProviderResults([changed]);let article=(await rpc('tech_feed_list',owner,'latest',null,null,null)).items[0];
 assert.deepEqual(article.summary,summary);assert.equal(article.summary_status,'ready');
 await dueAgain();await ingestProviderResults([{...changed,content:'AWS Lambda different public evidence. '.repeat(8)}]);article=(await rpc('tech_feed_list',owner,'latest',null,null,null)).items[0];
 assert.equal(article.summary,null);assert.equal(article.summary_status,'pending');assert.equal(article.category,null);
}));
async function attachRssEvidence(url,excerpt){
 const source=(await db.query("insert into tech_feed_sources(name,url,permission_status,summary_allowed)values('Hybrid RSS','https://example.com/hybrid-rss','approved',true)returning *")).rows[0];
 await db.query('insert into tech_feed_subscriptions(user_id,source_id)values($1,$2)',[owner,source.id]);
 const lease=(await db.query('select * from tech_feed_claim_sources($1,2)',[[owner]])).rows.find(x=>x.id===source.id);
 assert.ok(lease);assert.equal(await rpc('tech_feed_finish_source',source.id,lease.lease,[{guid:'hybrid-entry',url,title:'RSS article attribution',excerpt,published_at:'2020-01-01T00:00:00Z',interests:['cloud']}],null,null,null),true);
 return source;
}
async function publishCurrentSummary(){
 const claim=(await db.query('select * from tech_feed_claim_summaries($1)',[[owner]])).rows[0];assert.ok(claim);
 assert.equal(await rpc('tech_feed_begin_summary_attempt',[claim.article.id],[claim.lease],owner),true);
 const summary={technology:'Cloud technology',change:'Public feature',usage:'Cloud application'};
 assert.equal(await rpc('tech_feed_finish_summary',claim.article.id,claim.lease,owner,summary,'ready','news'),true);return summary;
}
test('RSS attribution without excerpt adoption does not prevent refreshing search-owned evidence',async()=>tx(async()=>{
 await config();const item={title:'AWS release',url:'https://example.com/hybrid-search',content:'Search-owned AWS evidence for a public feature. '.repeat(7)};
 await ingestProviderResults([item]);await db.exec('set local role service_role');const summary=await publishCurrentSummary();
 const before=(await db.query('select * from tech_feed_articles where url=$1',[item.url])).rows[0];
 const source=await attachRssEvidence(item.url,'RSS attribution has another excerpt. '.repeat(10));
 let row=(await db.query('select * from tech_feed_articles where id=$1',[before.id])).rows[0];
 assert.equal(row.origin,'web_search');assert.equal(row.excerpt_source_id,null);assert.equal(row.excerpt,before.excerpt);assert.deepEqual(row.summary,summary);
 assert.equal((await db.query('select count(*)::int n from tech_feed_article_sources where article_id=$1 and source_id=$2',[before.id,source.id])).rows[0].n,1);
 const changed={...item,content:'Refreshed AWS search-owned evidence with new limitations. '.repeat(7)};
 await dueAgain();assert.equal((await ingestProviderResults([changed])).state,'ready');
 row=(await db.query('select * from tech_feed_articles where id=$1',[before.id])).rows[0];
 assert.equal(row.excerpt,changed.content.trim());assert.equal(row.excerpt_source_id,null);assert.equal(row.origin,'web_search');
 assert.equal(row.summary,null);assert.equal(row.summary_status,'pending');assert.equal(row.published_at,before.published_at);assert.equal(row.discovered_at.toISOString(),before.discovered_at.toISOString());
}));
test('actual RSS excerpt adoption protects RSS evidence dates and summaries from later search refresh',async()=>tx(async()=>{
 await config();const item={title:'AWS release',url:'https://example.com/hybrid-rss-owned',content:'Brief search snippet'};
 await ingestProviderResults([item]);await db.exec('set local role service_role');
 const rssExcerpt='Actual RSS public evidence adopted from an approved source. '.repeat(7);const source=await attachRssEvidence(item.url,rssExcerpt);
 const summary=await publishCurrentSummary();const before=(await db.query('select * from tech_feed_articles where url=$1',[item.url])).rows[0];
 assert.equal(before.excerpt_source_id,source.id);assert.equal(before.excerpt,rssExcerpt);
 await dueAgain();assert.equal((await ingestProviderResults([{...item,content:'Different later search snippet. '.repeat(10)}])).state,'ready');
 const after=(await db.query('select * from tech_feed_articles where id=$1',[before.id])).rows[0];
 assert.equal(after.excerpt,rssExcerpt);assert.equal(after.excerpt_source_id,source.id);assert.deepEqual(after.summary,summary);assert.equal(after.summary_status,'ready');assert.equal(after.category,'news');
 assert.equal(after.published_at,before.published_at);assert.equal(after.discovered_at.toISOString(),before.discovered_at.toISOString());
 const listed=(await rpc('tech_feed_list',owner,'latest',null,null,null)).items[0];assert.equal(listed.origin,'rss');assert.equal(listed.excerpt_provenance,'source_excerpt');
}));
