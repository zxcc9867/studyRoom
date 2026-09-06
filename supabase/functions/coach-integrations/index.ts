import { createClient } from 'jsr:@supabase/supabase-js@2.57.4';
import { connection, googleToken, githubRepositories, githubHeaders } from '../_shared/coach-integrations.ts';
import { seal, requestJson, googlePages, unwrap, fail } from '../_shared/coach-integrations-core.mjs';
import { eligible, loadPilotUsers } from '../_shared/coach-store.ts';
const env = (name: string) => Deno.env.get(name);
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'POST,GET,OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const configured = (provider: string) => (provider === 'google' ? ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'COACH_ENCRYPTION_KEY'] : ['GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY', 'GITHUB_APP_SLUG', 'GITHUB_APP_CLIENT_ID', 'GITHUB_APP_CLIENT_SECRET', 'COACH_ENCRYPTION_KEY']).every(k => !!env(k));
const callback = (provider: string) => `${env('SUPABASE_URL')}/functions/v1/coach-integrations?provider=${provider}`;
Deno.serve(async (request) => {
    if (request.method === 'OPTIONS')
        return new Response(null, { status: 204, headers });
    const admin = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    try {
        const signal = AbortSignal.timeout(50000);
        await loadPilotUsers(admin);
        if (request.method === 'GET') {
            const url = new URL(request.url), state = url.searchParams.get('state') || '', provider = url.searchParams.get('provider');
            if (!['google', 'github'].includes(provider || '') || !state)
                return json({ error: 'invalid_oauth_state' }, 400);
            // Keep the claimed row until finalization. Disconnect can revoke a callback
            // that is currently awaiting the provider's token exchange.
            const claimId = crypto.randomUUID();
            const saved = unwrap(await admin.from('coach_oauth_states').update({ config: { claim_id: claimId } }).eq('id', state).eq('provider', provider).eq('config', '{}').gt('expires_at', new Date().toISOString()).select().maybeSingle());
            if (!saved || url.searchParams.has('error'))
                fail('invalid_oauth_state');
            if (!eligible(saved.user_id))
                return json({ error: 'coach_disabled' }, 403);
            let token, config;
            if (provider === 'google') {
                token = await requestJson('https://oauth2.googleapis.com/token', { signal, method: 'POST', body: new URLSearchParams({ client_id: env('GOOGLE_CLIENT_ID')!, client_secret: env('GOOGLE_CLIENT_SECRET')!, code: url.searchParams.get('code') || '', redirect_uri: callback('google'), grant_type: 'authorization_code' }) });
                if (!token.refresh_token || !token.access_token)
                    fail('offline_access_required');
                config = { calendar_ids: [], authorization_version: crypto.randomUUID() };
                token.expires_at = Date.now() + Number(token.expires_in) * 1000;
            }
            else {
                token = await requestJson('https://github.com/login/oauth/access_token', { signal, method: 'POST', headers: { Accept: 'application/json' }, body: new URLSearchParams({ client_id: env('GITHUB_APP_CLIENT_ID')!, client_secret: env('GITHUB_APP_CLIENT_SECRET')!, code: url.searchParams.get('code') || '', redirect_uri: callback('github') }) });
                if (!token.access_token)
                    fail('github_authorization_required');
                const installationId = Number(url.searchParams.get('installation_id') || saved.config?.installation_id);
                const installations = await requestJson('https://api.github.com/user/installations?per_page=100', { headers: githubHeaders(token.access_token), signal });
                const verified = installations.installations.find((i: any) => i.id === installationId && String(i.app_id) === env('GITHUB_APP_ID'));
                if (!verified)
                    fail('github_installation_not_authorized');
                config = { installation_id: verified.id, authorization_version: crypto.randomUUID() };
                if (token.expires_in)
                    token.expires_at = Date.now() + Number(token.expires_in) * 1000;
            }
            const encrypted_credentials = await seal(token, env('COACH_ENCRYPTION_KEY'), `${saved.user_id}:${provider}`);
            if (!eligible(saved.user_id))
                fail('coach_disabled');
            const completed = unwrap(await admin.rpc('coach_complete_connection', { p_state_id: state, p_claim_id: claimId, p_provider: provider, p_config: config, p_encrypted_credentials: encrypted_credentials }));
            if (!completed)
                fail('connection_cancelled');
            return Response.redirect(`${env('SITE_URL') || 'https://study-room-attendance.vercel.app'}/#me`, 303);
        }
        if (request.method !== 'POST')
            return json({ error: 'method_not_allowed' }, 405);
        const jwt = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
        const { data: { user }, error } = await admin.auth.getUser(jwt);
        if (error || !user || user.is_anonymous)
            return json({ error: 'Unauthorized' }, 401);
        const raw = await request.text();
        if (raw.length > 16000)
            return json({ error: 'request_too_large' }, 413);
        const body = JSON.parse(raw), provider = body.provider;
        if (body.action === 'status') {
            const rows = unwrap(await admin.from('coach_connections').select('id,provider,status,config,last_synced_at,last_error').eq('user_id', user.id));
            return json({ integrations: rows, configured: { google: configured('google'), github: configured('github') } });
        }
        if (!['google', 'github'].includes(provider))
            return json({ error: 'invalid_provider' }, 400);
        if (body.action !== 'disconnect' && !eligible(user.id))
            return json({ error: 'coach_disabled' }, 403);
        if (body.action === 'disconnect') {
            unwrap(await admin.rpc('coach_disconnect', { p_user_id: user.id, p_provider: provider }));
            return json({ ok: true });
        }
        if (!configured(provider))
            return json({ error: '외부 서비스 연결 설정이 아직 준비되지 않았습니다.', configured: false }, 503);
        if (body.action === 'connect') {
            const state = crypto.randomUUID() + crypto.randomUUID();
            unwrap(await admin.from('coach_oauth_states').insert({ id: state, user_id: user.id, provider, expires_at: new Date(Date.now() + 600000).toISOString(), config: {} }));
            const url = new URL(provider === 'google' ? 'https://accounts.google.com/o/oauth2/v2/auth' : `https://github.com/apps/${env('GITHUB_APP_SLUG')}/installations/new`);
            url.searchParams.set('state', state);
            if (provider === 'google')
                for (const [key, value] of Object.entries({ client_id: env('GOOGLE_CLIENT_ID')!, redirect_uri: callback('google'), response_type: 'code', access_type: 'offline', prompt: 'consent', scope: 'https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events.readonly' }))
                    url.searchParams.set(key, value);
            // GitHub App must enable Request user authorization during installation.
            return json({ url: url.toString() });
        }
        const row = await connection(admin, user.id, provider);
        if (body.action === 'calendars' && provider === 'google')
            return json({ calendars: (await googlePages('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250', await googleToken(admin, row, env, signal), fetch, { signal })).map((c: any) => ({ id: c.id, title: c.summary, summary: c.summary, time_zone: c.timeZone, selected: row.config?.calendar_ids?.includes(c.id) || false })) });
        if (body.action === 'select_calendars' && provider === 'google') {
            const available = await googlePages('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250', await googleToken(admin, row, env, signal), fetch, { signal });
            if (!Array.isArray(body.calendar_ids) || body.calendar_ids.length > 10 || body.calendar_ids.some((id: any) => !available.some((c: any) => c.id === id)))
                return json({ error: 'invalid_calendars' }, 400);
            signal.throwIfAborted();
            const selected = unwrap(await admin.from('coach_connections').update({ config: { ...row.config, calendar_ids: [...new Set(body.calendar_ids)] }, last_synced_at: null }).eq('id', row.id).eq('status', 'connected').eq('config', JSON.stringify(row.config)).select('id').maybeSingle());
            if (!selected)
                throw new Error('connection_changed');
        }
        else if (body.action === 'repositories' && provider === 'github') {
            const selected = unwrap(await admin.from('coach_repositories').select('owner,name,ai_enabled').eq('user_id', user.id));
            return json({ repositories: (await githubRepositories(row, env, admin, signal)).map((r: any) => ({ owner: r.owner.login, name: r.name, private: r.private, selected: selected.some((s: any) => s.owner === r.owner.login && s.name === r.name), ai_enabled: selected.find((s: any) => s.owner === r.owner.login && s.name === r.name)?.ai_enabled || false })) });
        }
        else if (body.action === 'select_repository' && provider === 'github') {
            if(body.selected===false) {
                if(typeof body.owner!=='string'||typeof body.name!=='string'||!/^[A-Za-z0-9-]{1,39}$/.test(body.owner)||!/^[A-Za-z0-9_.-]{1,100}$/.test(body.name))return json({error:'invalid_repository'},400);
                const removed=unwrap(await admin.rpc('coach_select_repository',{p_user_id:user.id,p_connection_id:row.id,p_expected_config:row.config,p_repository:{owner:body.owner,name:body.name},p_selected:false}));
                if(removed!==true)throw new Error('connection_changed');
                return json({ok:true});
            }
            const repo = (await githubRepositories(row, env, admin, signal)).find((r: any) => r.owner.login === body.owner && r.name === body.name);
            if (!repo)
                return json({ error: 'repository_not_authorized' }, 403);
            signal.throwIfAborted();
            const selected = unwrap(await admin.rpc('coach_select_repository', { p_user_id: user.id, p_connection_id: row.id, p_expected_config: row.config, p_repository: { owner: repo.owner.login, name: repo.name, private: repo.private, ai_enabled: body.ai_enabled === true }, p_selected: body.selected !== false }));
            if (selected !== true)
                throw new Error('connection_changed');
            if (body.selected === false)
                return json({ ok: true });
        }
        else if (body.action !== 'sync')
            return json({ error: 'invalid_action' }, 400);
        unwrap(await admin.rpc('coach_enqueue', { p_user_id: user.id, p_kind: provider === 'google' ? 'google_sync' : 'github_analysis', p_payload: {}, p_run_after: new Date().toISOString() }));
        return json({ ok: true });
    }
    catch {
        return json({ error: '연결 요청을 완료하지 못했습니다. 연결 상태를 확인하고 다시 시도하세요.' }, 400);
    }
});
