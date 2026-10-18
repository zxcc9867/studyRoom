import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActualResult, ActualTracking } from './actualStudy.mjs';
export type SharedStudySession = ActualResult['session'] & {user_id:string};
export type SharedCamera = {session_id:string;owner_client_id:string;generation:number;device_type:string;status:string;last_seen_at:string;expires_at:string;absence_seconds:number;excluded_seconds:number;auto_paused_at?:string|null;is_owner:boolean};
export type SharedStudySnapshot = {server_now:string;received_at_ms?:number;active_session:SharedStudySession|null;session:SharedStudySession|null;tracking:ActualTracking|null;camera:SharedCamera|null;accepted?:boolean};
export type SharedCameraView = {isOwner:boolean;canPublish:boolean;cameraRequired:boolean;remote:boolean;fresh:boolean;status:string;label:string;excludedSeconds:number;generation:number|null;clockMs:number};
export function getSharedCameraView(snapshot:SharedStudySnapshot|null,clientId:string,nowMs?:number):SharedCameraView;
export type StudyDeviceSync = {clientId:string;read():SharedStudySnapshot|null;refresh():Promise<SharedStudySnapshot|null>;claim(sessionId:string,options?:{takeover?:boolean;deviceType?:string}):Promise<SharedStudySnapshot|null>;report(sessionId:string,generation:number,options:{status:string;excludedSeconds:number}):Promise<SharedStudySnapshot|null>;start():void;dispose():void};
export function createStudyDeviceSync(options:{client:SupabaseClient;userId:string;clientId:string;onSnapshot:(snapshot:SharedStudySnapshot)=>void;onError?:(error:unknown)=>void;canRefresh?:()=>boolean;readRevision?:()=>number;host?:Window;now?:()=>number;request?:<T>(run:(signal:AbortSignal)=>Promise<T>,signal:AbortSignal)=>Promise<T>}):StudyDeviceSync;
