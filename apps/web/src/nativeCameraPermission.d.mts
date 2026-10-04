export type NativeCameraPermissionStatus = 'granted' | 'denied' | 'blocked' | 'cancelled' | 'unavailable';
export function requestNativeCameraPermission(host: unknown, timeoutMs?: number, options?: { interactive?: boolean }): Promise<NativeCameraPermissionStatus>;
export function openNativeAppSettings(host: unknown): boolean;
