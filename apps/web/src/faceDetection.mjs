const tasksVisionVersion = "0.10.35";
const defaultWasmBaseUrl = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${tasksVisionVersion}/wasm`;
const defaultModelAssetPath =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";

export async function createFacePresenceDetector(options = {}) {
  const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(options.wasmBaseUrl ?? defaultWasmBaseUrl);
  const modelAssetPath = options.modelAssetPath ?? defaultModelAssetPath;

  let detector;
  try {
    detector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
    });
  } catch {
    detector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
    });
  }

  return {
    detect(video, nowMs = performance.now()) {
      const result = detector.detectForVideo(video, nowMs);
      return Array.isArray(result?.detections) && result.detections.length > 0;
    },
    close() {
      detector.close?.();
    },
  };
}
