export function canonicalTopic(value){
 if(typeof value!=='string'||/[\p{Cc}\p{Cf}]/u.test(value))throw Error('invalid_input');
 const prompt=value.normalize('NFKC').replace(/\s+/gu,' ').trim();
 if([...prompt].length<3||[...prompt].length>300||/@|(?:https?|ftp):|www\.|\bAKIA[A-Z0-9]{16}\b|\b[a-z0-9-]+\.[a-z]{2,63}\/|\b[a-z0-9-]+\.(?:com|org|net|io|dev|ai|co|kr|uk)(?:\b|\/)|(?:sk|tvly|ghp|github_pat|AKIA)[-_][a-z0-9_-]{12,}|\bBearer\s|[a-zA-Z0-9_-]{40,}/i.test(prompt))throw Error('invalid_input');
 return{prompt,canonical:prompt.toLowerCase()};
}
export function feedAccess(user,env){return env.TECH_FEED_ACCESS_MODE==='self_service'||String(env.TECH_FEED_PILOT_USER_IDS||'').split(',').map(x=>x.trim()).includes(user);}
export function searchState(state,env){
 const previous=state.search_status||{state:'waiting',last_success_at:null};
 return{...previous,state:env.TECH_FEED_ENABLED!=='true'||!state.preferences?.receiving?'paused':!env.TAVILY_API_KEY?.trim()?'not_configured':previous.state};
}
export function classifyArticle(item){
 const text=(item.title+' '+item.excerpt).toLowerCase(),interests=[];
 if(/\bai\b|\bllm\b|machine learning|인공지능|hugging face|gpt|claude|모델/.test(text))interests.push('ai');
 if(/react|frontend|css|javascript|browser|프론트/.test(text))interests.push('frontend');
 if(/backend|database|postgres|api\b|백엔드|데이터베이스/.test(text))interests.push('backend');
 if(/aws|cloud|kubernetes|클라우드|azure/.test(text))interests.push('cloud');
 if(/github|tool|editor|cli\b|도구/.test(text))interests.push('tools');
 return{...item,interests};
}
