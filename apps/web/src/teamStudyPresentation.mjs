export function canConnectPersonalSession(session, tracking, now = Date.now()) {
    return Boolean(session?.id && session.status === 'active' && !session.paused_at && !session.ended_at && tracking?.session_id === session.id && Date.parse(session.lease_expires_at) > now);
}
export function roundRemainingSeconds(round, now = Date.now()) { const end = Date.parse(round?.ends_at); return Number.isFinite(end) ? Math.max(0, Math.ceil((end - now) / 1000)) : 0; }
export function isRoundComplete(round, now = Date.now()) { return Boolean(round?.started_at && Number.isFinite(Date.parse(round.ends_at)) && Date.parse(round.ends_at) <= now); }
export function normalizePublicTag(value) { const tag = String(value ?? '').trim().toLowerCase(); return /^[a-z0-9\uac00-\ud7a3_-]{2,20}#[a-z0-9\uac00-\ud7a3_-]{2,20}$/.test(tag) ? tag : null; }
export function teamStudyErrorMessage(code) {
    const messages = { ACCOUNT_REQUIRED: '정식 계정으로 로그인해 주세요.', INVALID_PAYLOAD: '입력 내용을 확인해 주세요.', INVALID_TAG: '공개 태그 전체를 이름#식별자 형식으로 입력해 주세요.', TAG_NOT_FOUND: '이 태그를 찾지 못했어요. 전체 태그를 확인해 주세요.', INVITE_INVALID: '유효하지 않거나 만료된 초대예요. 새 링크를 요청해 주세요.', RATE_LIMITED: '요청이 많아요. 잠시 후 다시 시도해 주세요.', ALREADY_IN_TEAM: '이미 다른 팀에 참여 중이에요. 자동으로 팀을 옮기지 않습니다.', TEAM_FULL: '팀 정원 6명이 모두 찼어요.', TEAM_REQUIRED: '팀 참여 상태가 바뀌었어요. 다시 확인해 주세요.', OWNER_REQUIRED: '팀 소유자만 할 수 있어요.', OWNER_SUCCESSOR_REQUIRED: '새 소유자를 고르거나 팀 종료를 선택해 주세요.', ROUND_EXISTS: '이미 제안된 집중 시간이 있어요.', SESSION_REQUIRED: '개인 공부를 시작하거나 재개한 뒤 연결해 주세요.', TRACKING_REQUIRED: '실제 공부 상태를 확인한 뒤 연결해 주세요.', CONNECTION_EXISTS: '현재 팀 연결을 먼저 확인해 주세요.', CONFLICT: '상태가 바뀌었어요. 다시 확인하고 시도해 주세요.', RETRY: '다른 작업과 겹쳤어요. 잠시 후 다시 시도해 주세요.' };
    return messages[code] ?? '함께 공부방에 연결하지 못했어요. 잠시 후 다시 확인해 주세요.';
}
