export function canConnectPersonalSession(session: {id:string;status:string;paused_at?:string|null;ended_at?:string|null;lease_expires_at?:string|null}|null,tracking:{session_id:string}|null,now?:number):boolean;
export function roundRemainingSeconds(round:{ends_at?:string|null}|null,now?:number):number;
export function normalizePublicTag(value:string):string|null;
export function teamStudyErrorMessage(code?:string):string;
