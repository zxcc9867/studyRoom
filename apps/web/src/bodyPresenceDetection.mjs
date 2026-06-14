const tasksVisionVersion = "0.10.35";
const defaultWasmBaseUrl = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${tasksVisionVersion}/wasm`;
const defaultModelAssetPath =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

const minimumConfidence = 0.35;
const minimumShoulderSpan = 0.05;

export const landmarkIndexes = {
  nose: 0,
  leftEye: 2,
  rightEye: 5,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
};

const headLandmarkIndexes = [
  landmarkIndexes.nose,
  landmarkIndexes.leftEye,
  landmarkIndexes.rightEye,
  landmarkIndexes.leftEar,
  landmarkIndexes.rightEar,
];

export async function createUpperBodyPresenceDetector(options = {}) {
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(options.wasmBaseUrl ?? defaultWasmBaseUrl);
  const modelAssetPath = options.modelAssetPath ?? defaultModelAssetPath;

  let detector;
  try {
    detector = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  } catch {
    detector = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  }

  return {
    detect(video, nowMs = performance.now()) {
      const result = detector.detectForVideo(video, nowMs);
      return hasSeatedUpperBodyPose(result);
    },
    close() {
      detector.close?.();
    },
  };
}

export function hasSeatedUpperBodyPose(result) {
  const poses = Array.isArray(result?.landmarks) ? result.landmarks : [];
  return poses.some((pose) => hasVisibleHeadAndShoulders(pose));
}

function hasVisibleHeadAndShoulders(landmarks) {
  const leftShoulder = visibleLandmark(landmarks?.[landmarkIndexes.leftShoulder]);
  const rightShoulder = visibleLandmark(landmarks?.[landmarkIndexes.rightShoulder]);
  if (!leftShoulder || !rightShoulder) {
    return false;
  }

  const shoulderSpan = Math.abs(leftShoulder.x - rightShoulder.x);
  if (shoulderSpan < minimumShoulderSpan) {
    return false;
  }

  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  return headLandmarkIndexes.some((index) => {
    const landmark = visibleLandmark(landmarks?.[index]);
    return landmark && landmark.y < shoulderY + 0.12;
  });
}

function visibleLandmark(landmark) {
  if (!landmark) {
    return null;
  }

  const visibility = typeof landmark.visibility === "number" ? landmark.visibility : 1;
  const presence = typeof landmark.presence === "number" ? landmark.presence : 1;
  if (visibility < minimumConfidence || presence < minimumConfidence) {
    return null;
  }

  return landmark;
}
