export const AUTH_INITIALIZATION_TIMEOUT_MS: number;

export function isAuthInitializationTimeoutError(error: unknown): boolean;

export function runAuthInitializationWithTimeout<T>(
  task: () => T | PromiseLike<T>,
  options?: {
    timeoutMs?: number;
    setTimer?: (
      callback: () => void,
      delay: number,
    ) => ReturnType<typeof setTimeout>;
    clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
  },
): Promise<T>;
