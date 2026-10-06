export type DeviceSession = { id: string; paused: boolean } | null;
export type DeviceStudyState = { userId: string | null; ready: boolean; session: DeviceSession; cameraActive: boolean; operationPending: boolean };
export type DeviceStudyTracker = {
  prepare(userId: string, committing?: boolean): boolean;
  mark(userId: string, sessionId: string): void;
  observe(userId: string, session: DeviceSession): void;
  check(state: DeviceStudyState, expectedSession: DeviceSession): "allowed" | "studying" | "unknown";
};
export function createDeviceStudyTracker(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">): DeviceStudyTracker;
export function bindDeviceStudyCheck(host: Window, readState: () => DeviceStudyState, tracker: DeviceStudyTracker): () => void;
