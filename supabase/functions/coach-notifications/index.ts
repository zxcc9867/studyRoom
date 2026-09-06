import { createClient } from 'jsr:@supabase/supabase-js@2.57.4';
import { dispatchCoaching, sendCoachTarget } from '../_shared/coach-notifications.ts';
import { eligibleTargets, configureEmailTarget } from '../_shared/coach-notifications-core.mjs';
import { unwrap } from '../_shared/coach-integrations-core.mjs';
import { eligible, loadPilotUsers } from '../_shared/coach-store.ts';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info,x-cron-secret', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
Deno.serve(async (request) => {
    if (request.method === 'OPTIONS')
        return new Response(null, { status: 204, headers });
    if (request.method !== 'POST')
        return json({ error: 'method_not_allowed' }, 405);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    try {
        await loadPilotUsers(admin);
        const secret = Deno.env.get('CRON_SECRET');
        if (secret && request.headers.get('x-cron-secret') === secret)
            return json(await dispatchCoaching(admin));
        const { data: { user }, error } = await admin.auth.getUser((request.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
        if (error || !user || user.is_anonymous)
            return json({ error: 'Unauthorized' }, 401);
        const body = await request.json();
        // Disconnect remains available after the pilot is disabled.
        if (body.action === 'disconnect_email')
            return json(await configureEmailTarget(admin, user, false));
        if (!eligible(user.id))
            return json({ error: 'coach_disabled' }, 403);
        if (body.action === 'connect_email') {
            if (!user.email_confirmed_at)
                return json({ error: '이메일 인증을 완료한 후 연결해 주세요.' }, 400);
            return json(await configureEmailTarget(admin, user, true));
        }
        if (body.action !== 'test')
            return json({ error: 'invalid_action' }, 400);
        const settings = unwrap(await admin.from('coach_settings').select('*').eq('user_id', user.id).single());
        const profile = unwrap(await admin.from('profiles').select('email_reminders_enabled').eq('user_id', user.id).single());
        const targets = unwrap(await admin.from('notification_targets').select('*').eq('user_id', user.id).eq('enabled', true).eq('kind', body.channel));
        const target = eligibleTargets(settings, targets, profile)[0];
        if (!target)
            return json({ error: '연결하고 활성화한 알림 채널이 필요합니다.' }, 400);
        await sendCoachTarget(target, { title: '스터디룸 코칭 알림 테스트', duration_minutes: 15 }, crypto.randomUUID());
        return json({ ok: true });
    }
    catch {
        return json({ error: '알림을 완료하지 못했습니다. 연결 설정을 확인하세요.' }, 503);
    }
});
