export type NativeCameraPermissionStatus = 'granted' | 'denied' | 'blocked' | 'cancelled' | 'unavailable';
export function requestNativeCameraPermission(host: unknown, timeoutMs?: number): Promise<NativeCameraPermissionStatus>;
export function openNativeAppSettings(host: unknown): boolean;
