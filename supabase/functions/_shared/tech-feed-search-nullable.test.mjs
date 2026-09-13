import test from 'node:test';
import assert from 'node:assert/strict';
import {createTavilySearch} from './tech-feed-search.mjs';
import {runSearchWorker} from './tech-feed-search-worker.mjs';

const usage = () => ({key:{usage:0,limit:null},account:{current_plan:'Researcher',plan_usage:0,plan_limit:1000,paygo_usage:0,paygo_limit:null}});
const client = data => createTavilySearch({env:{TAVILY_API_KEY:'synthetic'},fetchImpl:async()=>Response.json(data)});

test('nullable free-account caps use the remaining plan credits, not an invented unlimited budget', async()=>{
  const data=usage();data.account.plan_usage=120;
  assert.deepEqual(await client(data).checkUsage(),{remaining:880});
  data.key.limit=150;data.key.usage=100;
  assert.deepEqual(await client(data).checkUsage(),{remaining:50});
});

test('nullable caps still stop on exhausted plan or key credits',async()=>{
  for(const data of [
    {...usage(),account:{...usage().account,plan_usage:1000}},
    {...usage(),account:{...usage().account,plan_usage:999.5}},
    {...usage(),key:{usage:10,limit:10}},
  ])await assert.rejects(client(data).checkUsage(),/quota_exhausted/);
});

test('nullable free caps never accept missing fields, paid plans, paid usage or malformed limits',async()=>{
  const variants=[
    {...usage(),account:{...usage().account,current_plan:'Bootstrap'}},
    {...usage(),account:{...usage().account,paygo_usage:1}},
    {...usage(),account:{...usage().account,paygo_limit:1}},
    {...usage(),account:{...usage().account,paygo_limit:undefined}},
    {...usage(),account:{...usage().account,paygo_limit:'0'}},
    {...usage(),account:{...usage().account,plan_limit:1001}},
    {...usage(),account:{...usage().account,plan_usage:null}},
    {...usage(),key:{usage:0}},
    {...usage(),key:{usage:0,limit:'1000'}},
    {...usage(),key:{usage:0,limit:1001}},
    {...usage(),key:{usage:0,limit:-1}},
    {...usage(),key:{usage:null,limit:null}},
  ];
  for(const data of variants)await assert.rejects(client(data).checkUsage(),/unavailable/);
});

test('nullable free caps do not bypass the atomic application budget before a search POST',async()=>{
  let posts=0,reservations=0;
  const search=createTavilySearch({env:{TAVILY_API_KEY:'synthetic'},fetchImpl:async(_url,init)=>{
    if(init.method==='POST')posts++;
    return Response.json(usage());
  }});
  const result=await runSearchWorker({search,store:{
    claimSearch:async()=>({id:'topic',lease:'lease',canonical:'AWS Lambda'}),
    reserveSearch:async()=>{reservations++;return false;},finishSearch:async()=>true,
  }});
  assert.equal(result.state,'quota_exhausted');assert.equal(reservations,1);assert.equal(posts,0);
});
