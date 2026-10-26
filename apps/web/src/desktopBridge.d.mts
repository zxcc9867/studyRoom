import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { DeviceStudyState, DeviceStudyTracker } from './deviceStudyActivity.mjs';
export type DesktopQuitEvent = { type: 'quit-requested'; requestId: string; userId: string; sessionId: string | null; localEngagement: boolean };
export type DesktopEvent = { type: 'auth-changed' } | { type: 'state-requested'; requestId: string } | DesktopQuitEvent;
export type DesktopAuthState = { status: 'connecting' | 'ready' | 'signed-out' | 'error'; session: Session | null };
export function isDesktopStudyApp(host: unknown): boolean;
export function beginDesktopWrite(host: object): () => void;
export function hasDesktopWrites(host: object): boolean;
export function desktopRequest<T = Record<string, unknown>>(host: unknown, action: string, payload?: Record<string, unknown>, options?: { id?: string; timeoutMs?: number }): Promise<T>;
export function subscribeDesktop(host: unknown, listener: (event: DesktopEvent) => void): () => void;
export function getDesktopStudyActivity(state: DeviceStudyState, tracker: DeviceStudyTracker): 'allowed' | 'studying' | 'unknown';
export function bindDesktopStudy(host: unknown, readState: () => DeviceStudyState, tracker: DeviceStudyTracker, onQuit: (event: DesktopQuitEvent) => void): () => void;
export function createDesktopAuthSession(host: Window, sdk: SupabaseClient, notify: (state: DesktopAuthState) => void, options?: { timeoutMs?: number; assertReady?: () => void }): {
  start(): Promise<void>; retry(): Promise<void>; signOut(): Promise<void>; dispose(): void;
};
