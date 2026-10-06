export type NativeSettingsTarget = 'update' | 'focus' | 'permissions';
export type NativePermissionState = 'granted' | 'denied' | 'unsupported' | 'unknown';
export type NativeSettingsSnapshot = {
  versionName: string | null;
  versionCode: number | null;
  updaterStatus: 'idle' | 'checking' | 'latest' | 'available' | 'downloading' | 'verifying' | 'ready' | 'cancelled' | 'failed' | 'permission_required' | 'install_pending' | 'installed';
  permissions: { camera: NativePermissionState; notifications: NativePermissionState; focus: NativePermissionState };
};
export type NativeSettingsResult = { status: 'ready'; snapshot: NativeSettingsSnapshot } | { status: 'unsupported' | 'failure' };
export function getNativeSettingsInfo(host: Window | undefined, timeoutMs?: number): Promise<NativeSettingsResult>;
export function openNativeSettings(host: Window | undefined, target: NativeSettingsTarget): boolean;
