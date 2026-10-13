export function isTeamInviteToken(value: unknown): value is string;
export function captureTeamInvite(options:{hash:string;storage?:Storage;now?:number;replaceHash?:(hash:string)=>void}):string|null;
export function readTeamInvite(storage?:Storage,now?:number):string|null;
export function clearTeamInvite(storage?:Storage):void;
export function getTeamInviteStorage():Storage|undefined;
