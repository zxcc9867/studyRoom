import { isTeamInviteToken } from './teamStudyInvite.mjs';
import { teamStudyErrorMessage } from './teamStudyPresentation.mjs';
const pick = (value, keys) => Object.fromEntries(keys.map(key => [key, value?.[key] ?? null]));
class TeamError extends Error {
}
const failure = code => new TeamError(teamStudyErrorMessage(code));
function safeSnapshot(data, userId) {
    if (!data || !Array.isArray(data.members) || !data.forest)
        throw failure();
    return { tag: data.tag ?? null, team: data.team ? pick(data.team, ['id', 'name', 'owner_id', 'time_zone', 'member_count']) : null,
        members: data.members.map(row => ({ ...pick(row, ['user_id', 'display_name', 'state', 'share_title', 'share_goal', 'started_at', 'paused_seconds', 'paused_at']), title: row.share_title === true ? row.title ?? null : null, goal: row.user_id === userId || row.share_goal === true ? row.goal ?? null : null })),
        invitations: (data.invitations ?? []).map(row => pick(row, ['id', 'team_name', 'member_count', 'expires_at'])), invite_links: (data.invite_links ?? []).map(row => pick(row, ['id', 'expires_at'])),
        round: data.round ? pick(data.round, ['id', 'duration_minutes', 'proposed_by', 'started_at', 'ends_at', 'joined']) : null, connection: data.connection ? pick(data.connection, ['id', 'session_id']) : null,
        forest: pick(data.forest, ['accepted_seconds', 'pending_sessions', 'trees', 'progress_seconds']), server_now: data.server_now };
}
export function createTeamStudyController(api, userId, { onState = () => { } } = {}) {
    let disposed = false, request = 0, channel = null, teamId = null, debounce = null, poll = null, started = false, actionBusy = false, healthyPoll = 0, inFlight = 0;
    let state = { snapshot: null, loading: false, error: '', transport: 'checking', syncedAt: Date.now() };
    const emit = patch => { if (!disposed) {
        state = { ...state, ...patch };
        onState(state);
    } };
    const clearChannel = () => { if (channel) {
        void api.removeChannel(channel);
        channel = null;
    } teamId = null; };
    const isCurrent = async () => { const { data, error } = await api.auth.getSession(); return !error && !disposed && data?.session?.user?.id === userId && data.session.user.is_anonymous !== true; };
    async function guard() { if (!await isCurrent()) {
        clearChannel();
        emit({ snapshot: null, error: teamStudyErrorMessage('ACCOUNT_REQUIRED'), loading: false });
        throw failure('ACCOUNT_REQUIRED');
    } }
    function subscribe(id) {
        if (teamId === id)
            return;
        clearChannel();
        if (!id) {
            emit({ transport: 'polling' });
            return;
        }
        teamId = id;
        channel = api.channel('team-study:' + id).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'team_study_signals', filter: 'team_id=eq.' + id }, invalidate).subscribe(status => { emit({ transport: status === 'SUBSCRIBED' ? 'connected' : 'retrying' }); if (status === 'SUBSCRIBED')
            invalidate(); });
    }
    async function refresh() {
        const revision = ++request;
        inFlight++;
        emit({ loading: !state.snapshot });
        try {
            await guard();
            const { data, error } = await api.rpc('team_study_snapshot');
            if (disposed || revision !== request)
                return;
            const current = await isCurrent();
            if (disposed || revision !== request)
                return;
            if (!current) {
                clearChannel();
                emit({ snapshot: null, error: teamStudyErrorMessage('ACCOUNT_REQUIRED'), loading: false });
                return;
            }
            if (error || data?.ok === false) {
                if (data?.error === 'TEAM_REQUIRED' || data?.error === 'ACCOUNT_REQUIRED') {
                    clearChannel();
                    emit({ snapshot: null });
                }
                throw failure(data?.error);
            }
            const snapshot = safeSnapshot(data, userId);
            emit({ snapshot, loading: false, error: '', syncedAt: Date.now() });
            subscribe(snapshot.team?.id ?? null);
        }
        catch (error) {
            if (!disposed && revision === request)
                emit({ loading: false, error: error instanceof TeamError ? error.message : teamStudyErrorMessage(), transport: 'retrying' });
        }
        finally {
            inFlight--;
        }
    }
    function invalidate() { if (disposed || debounce)
        return; debounce = setTimeout(() => { debounce = null; void refresh(); }, 200); debounce.unref?.(); }
    function start() { if (started || disposed)
        return; started = true; void refresh(); poll = setInterval(() => { if (typeof document !== 'undefined' && document.visibilityState === 'hidden')
        return; if (inFlight)
        return; if (state.transport === 'connected' && ++healthyPoll < 2)
        return; healthyPoll = 0; void refresh(); }, 15000); poll.unref?.(); }
    async function action(name, payload = {}) {
        if (['preview_invite', 'accept_invite'].includes(name) && !isTeamInviteToken(payload.token))
            throw failure('INVITE_INVALID');
        if (actionBusy)
            throw new TeamError('처리 중인 요청을 기다려 주세요.');
        actionBusy = true;
        try {
            await guard();
            const { data, error } = await api.rpc('team_study_action', { p_action: name, p_payload: payload });
            await guard();
            if (error || !data?.ok)
                throw failure(data?.error);
            if (name !== 'preview_invite' && name !== 'lookup_tag')
                await refresh();
            return data;
        }
        catch (error) {
            if (error instanceof TeamError)
                throw error;
            throw failure();
        }
        finally {
            actionBusy = false;
        }
    }
    function dispose() { disposed = true; request++; clearChannel(); clearTimeout(debounce); clearInterval(poll); }
    return { start, refresh, invalidate, action, dispose };
}
