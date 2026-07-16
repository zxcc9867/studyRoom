export const cameraStartTimeoutMs: number;

export function isCameraStartTimeoutError(error: unknown): boolean;

export function requestCameraStreamWithTimeout(
  requestStream: () => Promise<MediaStream>,
  options?: {
    timeoutMs?: number;
    setTimer?: (
      callback: () => void,
      delay: number,
    ) => ReturnType<typeof setTimeout>;
    clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
  },
): Promise<MediaStream>;
