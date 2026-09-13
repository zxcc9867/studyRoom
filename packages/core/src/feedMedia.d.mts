export type FeedVideo = {provider:'youtube'|'vimeo';id:string};
export function safeMediaUrl(value:unknown,base?:string):string|null;
export function videoFromUrl(value:unknown,base?:string):FeedVideo|null;
export function videoEmbedUrl(video:unknown):string|null;
