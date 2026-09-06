export function emailChannelConnected(targets:{kind:string;enabled:boolean}[],profile:{email?:string|null;email_reminders_enabled?:boolean}|null):boolean;
export function setEmailConnection<T>(request:(name:string,body:Record<string,unknown>)=>Promise<T>,connected:boolean):Promise<T>;
