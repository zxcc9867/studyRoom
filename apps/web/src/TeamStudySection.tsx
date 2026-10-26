import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ArrowLeft, BookOpen, Clock, TreePine, Users } from 'lucide-react';
import { createTeamStudyController, type TeamState, type TeamActionResult } from './teamStudyClient.mjs';
import { normalizePublicTag, roundRemainingSeconds, isRoundComplete } from './teamStudyPresentation.mjs';
import { clearTeamInvite, getTeamInviteStorage, isTeamInviteToken } from './teamStudyInvite.mjs';
import { AccessibleDialog } from './AccessibleDialog';
import './TeamStudySection.css';
type Props = {
    supabase: SupabaseClient;
    userId: string;
    registered: boolean;
    inviteToken: string | null;
    onClearInvite: () => void;
    personal: {
        ready: boolean;
        busy: boolean;
        sessionId: string | null;
        paused: boolean;
        canConnect: boolean;
        seconds: number;
        startLabel: string;
    };
    onStart: () => void;
    onResume: () => void;
    onPause: () => void;
    onEnd: () => void;
    onPendingWrite?: () => (() => void);
};
const clock = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
function Desk({ state }: {
    state: string;
}) { return <svg className="team-desk-art" viewBox="0 0 200 125" aria-hidden="true"><ellipse cx="100" cy="113" rx="67" ry="7" className="desk-shadow"/><path d="M76 91c0-28 12-33 24-33s24 5 24 33" className="desk-person"/><circle cx="100" cy="40" r="20" className="desk-face"/><path d="M80 35q1-28 32-17l10 21-12-10-29 11" className="desk-hair"/><path d="M40 89h123v9H40zM48 98v15M153 98v15" className="desk-table"/><path d="m80 81 20 3 20-3v12l-20 3-20-3zM100 84v12" className="desk-book"/><path d="M144 88V63l-14-14m-7 3 12-10 12 14" className="desk-lamp"/>{state === 'studying' && <path d="m135 56 12 1 10 27h-32z" className="desk-light"/>}</svg>; }
export default function TeamStudySection(props: Props) {
    const { supabase, userId, registered, inviteToken, onClearInvite, personal } = props;
    const [state, setState] = useState<TeamState>({ snapshot: null, loading: true, error: '', transport: 'checking', syncedAt: Date.now() });
    const controller = useRef<ReturnType<typeof createTeamStudyController> | null>(null);
    const [pending, setPending] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
    const [tab, setTab] = useState<'room' | 'forest'>('room'), [inviteOpen, setInviteOpen] = useState(false), [name, setName] = useState(''), [searchTag, setSearchTag] = useState('');
    const [friend, setFriend] = useState<TeamActionResult | null>(null), [preview, setPreview] = useState<{
        token: string;
        result: TeamActionResult;
    } | null>(null), [newLink, setNewLink] = useState<{
        id: string;
        url: string;
    } | null>(null);
    const [leaveOpen, setLeaveOpen] = useState(false), [successor, setSuccessor] = useState(''), [closeTeam, setCloseTeam] = useState(false), [tick, setTick] = useState(Date.now());
    const [durationMode, setDurationMode] = useState('unlimited'), [durationMinutes, setDurationMinutes] = useState('25');
    const [goal, setGoal] = useState(''), [goalDirty, setGoalDirty] = useState(false);
    const goalTeam = useRef<string | undefined>(undefined);
    const inviteField = useRef<HTMLInputElement>(null);
    const inviteContext = useRef({ token: inviteToken });
    if (inviteContext.current.token !== inviteToken)
        inviteContext.current = { token: inviteToken };
    const currentPreview = preview?.token === inviteToken ? preview : null;
    useEffect(() => { setPreview(null); setError(''); setNotice(''); }, [inviteToken]);
    useEffect(() => { const current = createTeamStudyController(supabase, userId, { onState: setState }); controller.current = current; if (registered)
        current.start(); return () => { current.dispose(); if (controller.current === current)
        controller.current = null; }; }, [supabase, userId, registered]);
    useEffect(() => { if (inviteOpen)
        inviteField.current?.focus(); }, [inviteOpen]);
    useEffect(() => { const timer = window.setInterval(() => setTick(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
    const snapshot = state.snapshot, team = snapshot?.team, owner = team?.owner_id === userId, myMember = snapshot?.members.find(m => m.user_id === userId);
    useEffect(() => {
        const changedTeam = goalTeam.current !== team?.id;
        if (changedTeam || !goalDirty) {
            goalTeam.current = team?.id;
            setGoal(myMember?.goal ?? '');
            if (changedTeam) setGoalDirty(false);
        }
    }, [team?.id, myMember?.goal, myMember?.share_goal, goalDirty]);
    const blocked = pending || !snapshot || Boolean(state.error), personalBlocked = !personal.ready || personal.busy;
    const serverNow = tick + (Date.parse(snapshot?.server_now ?? '') - state.syncedAt || 0);
    const roundComplete = isRoundComplete(snapshot?.round ?? null, serverNow);
    const clearInvite = () => { clearTeamInvite(getTeamInviteStorage()); onClearInvite(); setPreview(null); };
    async function run(action: string, payload: Record<string, unknown> = {}, success?: (result: TeamActionResult) => void) { const release=props.onPendingWrite?.(); setError(''); setNotice(''); setPending(true); try {
        if (!controller.current)
            return;
        const result = await controller.current.action(action, payload);
        success?.(result);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : '요청을 처리하지 못했어요. 다시 확인해 주세요.');
    }
    finally {
        release?.();
        setPending(false);
    } }
    function primary() {
        if (personalBlocked)
            return;
        if (!personal.sessionId) {
            props.onStart();
            return;
        }
        if (personal.paused) {
            props.onResume();
            return;
        }
        props.onPause();
    }
    function previewInvite() { const context = inviteContext.current; if (!context.token)
        return; void run('preview_invite', { token: context.token }, result => { if (inviteContext.current === context)
        setPreview({ token: context.token!, result }); }); }
    function acceptInvite() { const context = inviteContext.current; if (!currentPreview)
        return; void run('accept_invite', { token: currentPreview.token }, () => { if (inviteContext.current === context)
        clearInvite(); }); }
    const primaryLabel = !personal.sessionId ? '공부 시작' : personal.paused ? '공부 계속하기' : '잠시 쉬기';
    const elapsed = roundRemainingSeconds(snapshot?.round ?? null, serverNow);
    const personalControls = (<aside className="team-personal"><h2>내 공부</h2><strong className="team-personal-clock">{clock(personal.seconds)}</strong><p>{personal.sessionId ? personal.paused ? '휴식 중' : '공부 중' : '준비 중'}</p><button type="button" className="primary" disabled={personalBlocked} onClick={primary}>{primaryLabel}</button>{personal.sessionId && <button type="button" className="plain" disabled={personalBlocked} onClick={props.onEnd}>오늘 공부 종료</button>}{team && <>
      <form className="team-goal" onSubmit={e => { e.preventDefault(); void run('set_goal', { goal }, () => { setGoalDirty(false); setNotice('목표를 저장했어요.'); }); }}>
        <label>목표<input value={goal} maxLength={160} disabled={blocked} onChange={e => { setGoal(e.target.value); setGoalDirty(true); }} placeholder="예: 백엔드 개발자로 성장" autoComplete="off"/></label>
        <button type="submit" className="secondary" disabled={blocked}>목표 저장</button>
      </form>
      <label className="team-share"><input type="checkbox" checked={myMember?.share_title ?? false} disabled={blocked} onChange={e => void run('set_share_title', { share: e.target.checked })}/><span>지금 할 일 제목을 팀에 공유</span></label></>}</aside>);
    if (!registered)
        return <section id="together" className="team-study"><a href="#today"><ArrowLeft size={18}/>내 공부로</a><h1>함께 공부방</h1><p role="alert">정식 계정으로 로그인해 주세요. 익명 계정은 팀에 참여할 수 없어요.</p></section>;
    return <section id="together" className="team-study" aria-busy={pending || state.loading}>
  <a className="team-back" href="#today"><ArrowLeft size={18} aria-hidden="true"/>내 공부로</a>
  <header className="team-heading"><div><p className="team-eyebrow">초대 전용 · 영상 공유 없음</p><h1>{team?.name ?? '함께 공부방'}</h1><p>{team ? `팀원 ${team.member_count} / 6명` : '서로의 공부와 휴식 상태를 보며 각자의 공부를 이어가요.'}</p></div>{team && <button type="button" className="secondary" onClick={() => setInviteOpen(v => !v)} aria-expanded={inviteOpen}><Users size={18} aria-hidden="true"/>친구 초대</button>}</header>
  {(state.error || error) && <div className="team-error" role="alert"><p>{error || state.error}</p><p>개인 공부는 변경하지 않았어요. 표시된 팀 상태는 마지막 확인 결과예요.</p></div>}
  <div className="team-refresh"><span role="status">{state.loading ? '팀 상태 확인 중…' : state.error ? '팀 연결 확인 필요' : state.transport === 'connected' ? '팀 상태 연결됨' : '팀 상태를 주기적으로 확인 중'}</span><button type="button" className="plain" disabled={pending} onClick={() => void controller.current?.refresh()}>상태 다시 확인</button></div>
  {notice && <p role="status">{notice}</p>}
  {state.loading && !snapshot && <div className="team-loading" role="status">책상과 초대를 불러오고 있어요…</div>}
  {inviteToken && <section className="team-invite-preview" aria-label="받은 링크 초대"><h2>함께 공부방 초대</h2><p>팀명과 인원을 확인한 다음 참여해 주세요. 공부·휴식 상태와 선택한 현재 제목만 공유됩니다.</p>{currentPreview?.result.team ? <><h3>{currentPreview.result.team.name}</h3><p>{currentPreview.result.team.member_count} / 6명 · 영상·이메일·개인 이력은 공유하지 않아요.</p><button type="button" className="primary" disabled={blocked} onClick={acceptInvite}>이 팀에 참여</button></> : <button type="button" className="secondary" disabled={blocked || !isTeamInviteToken(inviteToken)} onClick={previewInvite}>초대 내용 확인</button>}<button type="button" className="plain" disabled={pending} onClick={clearInvite}>초대 취소</button></section>}
  {snapshot?.invitations.map(invitation => <section className="team-invite-preview" key={invitation.id}><h2>{invitation.team_name}</h2><p>{invitation.member_count} / 6명 · 받은 태그 초대</p><button type="button" className="primary" disabled={blocked} onClick={() => void run('respond_invite', { invite_id: invitation.id, accept: true })}>초대 수락</button><button type="button" className="plain" disabled={blocked} onClick={() => void run('respond_invite', { invite_id: invitation.id, accept: false })}>초대 거절</button></section>)}
  {snapshot && !team && <section className="team-empty"><BookOpen size={48} aria-hidden="true"/><h2>우리만의 공부방을 만들어요</h2><p>최대 6명이 한 팀에서 공부할 수 있어요. 초대는 로그인 후 직접 수락합니다.</p><form onSubmit={e => { e.preventDefault(); if (name.trim())
        void run('create_team', { name: name.trim() }); }}><label>팀 이름<input maxLength={60} required value={name} onChange={e => setName(e.target.value)} placeholder="예: 느긋한 저녁 책방"/></label><button type="submit" className="primary" disabled={blocked || !name.trim()}>팀 만들기</button></form>{!snapshot.tag && <a className="team-back" href="#settings">공개 태그 설정하기</a>}</section>}
  {inviteOpen && team && snapshot && <section className="team-invite-tools" aria-label="친구 초대">
   <form onSubmit={e => { e.preventDefault(); const normalized = normalizePublicTag(searchTag); if (normalized)
                void run('lookup_tag', { tag: normalized }, setFriend);
            else
                setError('친구의 전체 공개 태그를 입력해 주세요.'); }}><h2>친구 태그로 초대</h2><label>초대할 전체 태그<input ref={inviteField} value={searchTag} maxLength={41} onChange={e => { setSearchTag(e.target.value); setFriend(null); }} placeholder="친구#독서" autoComplete="off"/></label><button type="submit" className="secondary" disabled={blocked || !searchTag.trim()}>친구 확인</button>{!snapshot.tag && <a className="team-back" href="#settings">공개 태그 설정하기</a>}{friend && <div className="team-confirm"><p>{friend.display_name} · {friend.tag}</p><button type="button" className="primary" disabled={blocked} onClick={() => void run('invite_tag', { tag: friend.tag }, () => { setFriend(null); setNotice('초대를 보냈어요. 친구가 수락하면 함께할 수 있어요.'); })}>이 친구에게 초대 보내기</button></div>}</form>
    {owner && <div><h2>초대 링크</h2><p>7일 후 만료돼요. 링크를 받은 정식 계정만 직접 참여할 수 있어요.</p><button type="button" className="secondary" disabled={blocked} onClick={() => void run('create_invite', {}, result => { if (result.token && result.invite_id)
                setNewLink({ id: result.invite_id, url: window.location.origin + '/#together?invite=' + result.token }); })}>초대 링크 만들기</button>{newLink && <div><label>발급한 초대 링크<input readOnly value={newLink.url} onFocus={e => e.target.select()}/></label><button type="button" className="plain" onClick={async () => { try {
                await navigator.clipboard.writeText(newLink.url);
                setNotice('초대 링크를 복사했어요.');
            }
            catch {
                setNotice('링크를 선택해 직접 복사해 주세요.');
            } }}>링크 복사</button></div>}{snapshot.invite_links.map(link => <div className="team-link-row" key={link.id}><span>만료 {new Date(link.expires_at).toLocaleDateString('ko-KR')}</span><button type="button" className="plain" disabled={blocked} onClick={() => void run('revoke_invite', { invite_id: link.id }, () => { if (newLink?.id === link.id)
                setNewLink(null); })}>링크 철회</button></div>)}</div>}
  </section>}
  {team && roundComplete && snapshot.round?.joined && <p className="team-round-notice" role="status">집중 시간이 끝났어요. 공부는 계속됩니다.</p>}
  {(!team && (!snapshot || Boolean(state.error)) || Boolean(team && tab === 'forest')) && personalControls}
  {team && <><nav className="team-tabs" aria-label="함께 공부방 화면"><button type="button" aria-pressed={tab === 'room'} onClick={() => setTab('room')}>공부방</button><button type="button" aria-pressed={tab === 'forest'} onClick={() => setTab('forest')}>팀 숲</button></nav>
   {tab === 'room' ? <div className="team-room-layout"><section className="team-round"><Clock size={24} aria-hidden="true"/><div><h2>함께 집중</h2>{snapshot.round ? <p>{roundComplete ? '지정한 집중 시간이 완료됐어요.' : snapshot.round.started_at ? snapshot.round.duration_minutes === null ? '시간 제한 없이 함께 공부 중' : `${snapshot.round.duration_minutes}분 · 남은 시간 ${clock(elapsed)}` : `${snapshot.round.duration_minutes === null ? '시간 제한 없음' : snapshot.round.duration_minutes + '분'} · 첫 공부 연결 후 함께 시작해요.`}</p> : <p>시간 제한 없이, 또는 원하는 시간만큼 함께 집중해요.</p>}<p>시간이 끝나도 공부는 자동 종료되지 않아요.</p></div>
    {snapshot.round && !roundComplete ? ((owner || snapshot.round.proposed_by === userId) && <button type="button" className="plain" disabled={blocked} onClick={() => void run('cancel_round')}>{snapshot.round.started_at ? '함께 집중 마치기' : '집중 제안 취소'}</button>) : <form className="team-round-form" onSubmit={e => { e.preventDefault(); void run('propose_round', { duration_minutes: durationMode === 'unlimited' ? null : Number(durationMinutes) }); }}>
      <div className="team-duration-field"><label htmlFor="team-duration-mode">함께 집중 시간</label><select id="team-duration-mode" value={durationMode} disabled={blocked} onChange={e => setDurationMode(e.target.value)}><option value="unlimited">시간 제한 없음</option><option value="custom">시간 직접 설정</option></select></div>
      {durationMode === 'custom' && <div className="team-duration-field"><label htmlFor="team-duration-minutes">집중 시간 (분)</label><input id="team-duration-minutes" type="number" inputMode="numeric" min={1} max={1440} step={1} required value={durationMinutes} disabled={blocked} aria-describedby="team-duration-help" onChange={e => setDurationMinutes(e.target.value)}/><small id="team-duration-help">1~1440분 · 종료 알림만 표시</small></div>}
      <div className="team-round-actions"><button type="submit" className="primary" disabled={blocked}>집중 제안</button>{[25, 50].map(minutes => <button key={minutes} type="button" className="secondary" disabled={blocked} onClick={() => void run('propose_round', { duration_minutes: minutes })}>{minutes}분 제안</button>)}{snapshot.round && (owner || snapshot.round.proposed_by === userId) && <button type="button" className="plain" disabled={blocked} onClick={() => void run('cancel_round')}>완료 알림 닫기</button>}</div>
    </form>}</section>
    <section className="team-desks" aria-label="팀원들의 공부 상태"><h2>팀원들의 공부 상태</h2><div className="team-seat-grid">{snapshot.members.map(member => <article key={member.user_id} className={`team-desk ${member.state}${member.user_id === userId ? ' mine' : ''}`}><div className="team-seat-heading"><strong>{member.display_name}{member.user_id === team.owner_id && <small className="team-leader">팀장</small>}{member.user_id === userId && <small>내 자리</small>}</strong><span>{member.state === 'studying' ? '공부 중' : member.state === 'resting' ? '휴식 중' : '준비 중'}</span></div><Desk state={member.state}/><dl className="team-member-study"><div><dt>목표</dt><dd>{member.share_goal ? member.goal ?? '목표 미설정' : member.goal ? '목표 비공개' : '목표 미설정'}</dd></div><div><dt>현재 공부</dt><dd>{member.title ?? (member.state === 'ready' ? '시작 전' : member.share_title ? '현재 할 일 없음' : '현재 공부 비공개')}</dd></div></dl></article>)}</div></section>
    {personalControls}
   </div> : <section className="team-forest"><header><div><p className="team-eyebrow">팀을 만든 날부터 누적</p><h2>함께 키우는 숲</h2><p>개인 공부를 마친 뒤 서버가 인정한 팀 연결 구간만 확정해요.</p></div><strong>{snapshot.forest.trees}그루</strong></header><div className="team-forest-scene" aria-label={`완성 나무 ${snapshot.forest.trees}그루`}>{snapshot.forest.trees ? Array.from({ length: Math.min(24, snapshot.forest.trees) }, (_, index) => <TreePine key={index} size={66} aria-hidden="true"/>) : <div><TreePine size={58} aria-hidden="true"/><h3>우리 팀의 첫 나무를 기다려요</h3><p>확정 공부시간 120분마다 나무 한 그루가 자라요.</p></div>}</div><div className="team-forest-totals"><p>확정 공부시간 <strong>{Math.floor(snapshot.forest.accepted_seconds / 60)}분</strong></p><p>다음 나무까지 <strong>{Math.ceil((7200 - snapshot.forest.progress_seconds) / 60)}분</strong></p><p>정산 대기 {snapshot.forest.pending_sessions}개 세션 · 아직 나무에 반영하지 않았어요.</p></div><progress value={snapshot.forest.progress_seconds} max={7200} aria-label="다음 팀 나무 진행도"/><p>주·월 단위로 초기화하지 않아요. 개인 순위와 개인 이력은 표시하지 않습니다.</p></section>}
   <footer className="team-membership"><button type="button" className="plain danger" aria-haspopup="dialog" onClick={() => { setError(''); setSuccessor(''); setCloseTeam(owner && snapshot.members.length === 1); setLeaveOpen(true); }}>팀 탈퇴</button></footer>
   {leaveOpen && <AccessibleDialog className="team-leave-dialog team-study" labelledBy="team-leave-title" onClose={() => { if (!pending) setLeaveOpen(false); }}>
    <h2 id="team-leave-title">팀 탈퇴</h2>
    <form onSubmit={e => { e.preventDefault(); void run('leave_team', owner ? closeTeam ? { close: true } : { successor_id: successor } : {}, () => { setLeaveOpen(false); setInviteOpen(false); setNewLink(null); setTab('room'); }); }}>
     {owner ? <><label htmlFor="team-leave-method">탈퇴 방법</label><select id="team-leave-method" disabled={pending} value={closeTeam ? 'dissolve' : 'transfer'} onChange={e => setCloseTeam(e.target.value === 'dissolve')}>
      {snapshot.members.length > 1 && <option value="transfer">팀장 위임 후 탈퇴</option>}<option value="dissolve">팀 해산</option></select>
      {!closeTeam && <><label htmlFor="team-successor">새 팀장</label><select id="team-successor" required disabled={pending} value={successor} onChange={e => setSuccessor(e.target.value)}><option value="">팀원 선택</option>{snapshot.members.filter(m => m.user_id !== userId).map(member => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}</select></>}
      {closeTeam && <p>팀원 모두의 팀 가입이 해제됩니다.</p>}</> : <p>이 팀에서 탈퇴할까요?</p>}
     {(error || state.error) && <p className="team-error" role="alert">{error || state.error}</p>}
     {state.error && <button type="button" className="plain" disabled={pending} onClick={() => void controller.current?.refresh()}>상태 다시 확인</button>}
     <div className="team-leave-actions"><button type="button" className="secondary" data-dialog-initial-focus disabled={pending} onClick={() => setLeaveOpen(false)}>취소</button><button type="submit" className="secondary danger" disabled={blocked || Boolean(owner && !closeTeam && !successor)}>{pending ? '처리 중…' : owner ? closeTeam ? '팀 해산' : '위임하고 탈퇴' : '탈퇴 확인'}</button></div>
    </form>
   </AccessibleDialog>}
  </>}
 </section>;
}
