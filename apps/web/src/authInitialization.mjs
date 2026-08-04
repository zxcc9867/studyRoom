export const AUTH_INITIALIZATION_TIMEOUT_MS = 12_000;

export function isAuthInitializationTimeoutError(error) {
  return error instanceof Error && error.name === "AuthInitializationTimeoutError";
}

export async function runAuthInitializationWithTimeout(
  task,
  {
    timeoutMs = AUTH_INITIALIZATION_TIMEOUT_MS,
    setTimer = (callback, delay) => setTimeout(callback, delay),
    clearTimer = (timer) => clearTimeout(timer),
  } = {},
) {
  if (typeof task !== "function") {
    throw new TypeError("Auth initialization task must be a function");
  }

  const safeTimeoutMs = Math.max(
    1,
    Math.floor(Number(timeoutMs) || AUTH_INITIALIZATION_TIMEOUT_MS),
  );
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimer(() => {
      const error = new Error(
        `로그인 상태 확인이 ${Math.ceil(safeTimeoutMs / 1000)}초 안에 끝나지 않았습니다.`,
      );
      error.name = "AuthInitializationTimeoutError";
      reject(error);
    }, safeTimeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve().then(task), timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimer(timer);
    }
  }
}
