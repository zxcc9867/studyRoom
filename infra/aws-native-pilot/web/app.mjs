import { finishAuthorization, makeAuthorization, tokenSubject } from './oauth.mjs';
import { subscribeToStudy } from './realtime.mjs';

const $ = id => document.getElementById(id);
const pendingKey = 'studyroom-pilot-oauth';
const callback = new URL(location.href);
const isCallback = ['code','state','error'].some(key => callback.searchParams.has(key));
if (isCallback) history.replaceState(null, '', '/');
const redirectUri = location.origin + '/';
let config, access, sub, timer, jobId;
let currentRefresh;

const say = message => { $('message').textContent = message; };
function logout() {
  access = undefined;
  sub?.close();
  clearInterval(timer);
  const url = new URL('/logout', config.cognitoDomain);
  url.search = new URLSearchParams({client_id:config.clientId, logout_uri:redirectUri});
  location.assign(url);
}

async function request(path, payload) {
  const response = await fetch(config.apiUrl + path, {
    method:payload ? 'POST' : 'GET',
    headers:{authorization:'Bearer ' + access, ...(payload ? {'content-type':'application/json'} : {})},
    ...(payload ? {body:JSON.stringify(payload)} : {}),
    cache:'no-store', credentials:'omit', redirect:'error', signal:AbortSignal.timeout(10_000)
  });
  if (response.status === 401) {
    access = undefined;
    sub?.close();
    clearInterval(timer);
    $('dashboard').hidden = true;
    $('login').hidden = false;
    say('로그인이 만료됐어요. 다시 로그인해 주세요.');
  }
  if (!response.ok) throw new Error('Pilot API unavailable');
  return response.json();
}

async function refresh() {
  if (currentRefresh) return currentRefresh;
  currentRefresh = (async () => {
    if (!access) return;
    const {records} = await request('/records');
    $('records').replaceChildren(...records.map(row => {
      const li = document.createElement('li');
      li.textContent = '시험 공부 ' + row.minutes + '분';
      return li;
    }));
    if (!records.length) $('records').textContent = '아직 시험 기록이 없어요.';
    if (jobId) {
      const job = await request('/coaching/' + encodeURIComponent(jobId));
      $('coach-status').textContent = job.status === 'done' ? job.result :
        job.status === 'failed' ? '시험 코칭에 실패했어요.' : '시험 코칭을 처리 중이에요.';
      if (['done','failed'].includes(job.status)) {
        jobId = undefined;
        $('coach').disabled = false;
      }
    }
  })().finally(() => { currentRefresh = undefined; });
  return currentRefresh;
}

function refreshSoon() {
  void refresh().catch(() => { if (access) say('시험 데이터를 읽지 못했어요. 잠시 뒤 다시 확인합니다.'); });
}

function showDashboard() {
  $('login').hidden = true;
  $('dashboard').hidden = false;
  say('시험 계정으로 로그인했어요.');
  const offline = () => { $('connection').textContent = '실시간 연결 끊김 · 15초마다 다시 조회'; };
  try {
    sub = subscribeToStudy({
      httpUrl:config.appSyncHttpUrl, realtimeUrl:config.appSyncRealtimeUrl,
      token:access, subject:tokenSubject(access), onEvent:refreshSoon,
      onStatus:status => {
        if (status === 'connected') {
          $('connection').textContent = '실시간 연결됨';
          refreshSoon();
        } else offline();
      }
    });
    void sub.ready.catch(offline);
  } catch { offline(); }
  timer = setInterval(refreshSoon, 15_000);
  refreshSoon();
}

$('login').addEventListener('click', async () => {
  $('login').disabled = true;
  try {
    const {url, pending} = await makeAuthorization(config, redirectUri);
    sessionStorage.setItem(pendingKey, JSON.stringify(pending));
    location.assign(url);
  } catch {
    say('로그인을 열지 못했어요. 다시 시도해 주세요.');
    $('login').disabled = false;
  }
});
$('logout').addEventListener('click', logout);
$('record-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    await request('/records', {minutes:Number($('minutes').value)});
    if (currentRefresh) await currentRefresh.catch(() => {});
    refreshSoon();
    say('시험 기록을 저장했어요.');
  } catch {
    if (access) say('시험 기록을 저장하지 못했어요.');
  } finally { button.disabled = false; }
});
$('coach').addEventListener('click', async () => {
  $('coach').disabled = true;
  try {
    ({id:jobId} = await request('/coaching', {}));
    $('coach-status').textContent = '시험 코칭을 처리 중이에요.';
    refreshSoon();
  } catch {
    if (access) $('coach-status').textContent = '요청하지 못했어요. 시험 호출 한도 또는 연결 상태를 확인해 주세요.';
    $('coach').disabled = false;
  }
});
window.addEventListener('pagehide', () => {
  access = undefined;
  sub?.close();
  clearInterval(timer);
});
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });

try {
  const response = await fetch('/config.json', {cache:'no-store', redirect:'error'});
  if (!response.ok) throw new Error('Missing public pilot config');
  config = await response.json();
  for (const key of ['apiUrl','cognitoDomain','appSyncHttpUrl','appSyncRealtimeUrl']) {
    const url = new URL(config[key]);
    if (url.protocol !== (key === 'appSyncRealtimeUrl' ? 'wss:' : 'https:') || url.username || url.password) {
      throw new Error('Invalid public pilot config');
    }
  }
  $('login').hidden = false;
  say('계정은 시험 환경 운영자에게 발급받을 수 있어요.');
  if (isCallback) {
    try {
      const pending = sessionStorage.getItem(pendingKey);
      sessionStorage.removeItem(pendingKey);
      access = await finishAuthorization(config, callback, JSON.parse(pending));
      showDashboard();
    } catch { say('로그인을 완료하지 못했어요. 새로 로그인해 주세요.'); }
  }
} catch { say('시험 환경을 불러올 수 없어요. 배포 설정을 확인해 주세요.'); }
