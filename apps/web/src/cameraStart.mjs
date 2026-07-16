export const cameraStartTimeoutMs = 15_000;

export function isCameraStartTimeoutError(error) {
  return error instanceof Error && error.name === "CameraStartTimeoutError";
}

export function requestCameraStreamWithTimeout(
  requestStream,
  {
    timeoutMs = cameraStartTimeoutMs,
    setTimer = (callback, delay) => setTimeout(callback, delay),
    clearTimer = (timer) => clearTimeout(timer),
  } = {},
) {
  if (typeof requestStream !== "function") {
    return Promise.reject(new TypeError("requestStream must be a function"));
  }

  const safeTimeoutMs = Math.max(1, Math.floor(Number(timeoutMs) || cameraStartTimeoutMs));
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimer(() => {
      if (settled) return;
      settled = true;
      const error = new Error("Camera start timed out");
      error.name = "CameraStartTimeoutError";
      reject(error);
    }, safeTimeoutMs);

    Promise.resolve()
      .then(requestStream)
      .then(
        (stream) => {
          if (settled) {
            stream?.getTracks?.().forEach((track) => track.stop());
            return;
          }
          settled = true;
          clearTimer(timer);
          resolve(stream);
        },
        (error) => {
          if (settled) return;
          settled = true;
          clearTimer(timer);
          reject(error);
        },
      );
  });
}
