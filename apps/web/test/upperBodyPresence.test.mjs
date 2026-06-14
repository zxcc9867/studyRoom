import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  hasSeatedUpperBodyPose,
  landmarkIndexes,
} from "../src/bodyPresenceDetection.mjs";

function landmarks(points) {
  const result = Array.from({ length: 33 }, () => undefined);
  for (const [index, point] of Object.entries(points)) {
    result[Number(index)] = {
      x: point.x,
      y: point.y,
      visibility: point.visibility ?? 0.95,
      presence: point.presence ?? 0.95,
    };
  }
  return result;
}

test("detects seated presence from head and both shoulders", () => {
  const poseResult = {
    landmarks: [
      landmarks({
        [landmarkIndexes.nose]: { x: 0.5, y: 0.22 },
        [landmarkIndexes.leftShoulder]: { x: 0.35, y: 0.46 },
        [landmarkIndexes.rightShoulder]: { x: 0.65, y: 0.46 },
      }),
    ],
  };

  assert.equal(hasSeatedUpperBodyPose(poseResult), true);
});

test("does not detect seated presence from a head without shoulders", () => {
  const poseResult = {
    landmarks: [
      landmarks({
        [landmarkIndexes.nose]: { x: 0.5, y: 0.22 },
      }),
    ],
  };

  assert.equal(hasSeatedUpperBodyPose(poseResult), false);
});

test("does not detect seated presence when shoulders are too uncertain", () => {
  const poseResult = {
    landmarks: [
      landmarks({
        [landmarkIndexes.nose]: { x: 0.5, y: 0.22 },
        [landmarkIndexes.leftShoulder]: { x: 0.35, y: 0.46, visibility: 0.1 },
        [landmarkIndexes.rightShoulder]: { x: 0.65, y: 0.46 },
      }),
    ],
  };

  assert.equal(hasSeatedUpperBodyPose(poseResult), false);
});

test("detects seated presence when webcam crop shows head, one shoulder, and one hip", () => {
  const poseResult = {
    landmarks: [
      landmarks({
        [landmarkIndexes.nose]: { x: 0.5, y: 0.22 },
        [landmarkIndexes.leftShoulder]: { x: 0.38, y: 0.46 },
        [landmarkIndexes.leftHip]: { x: 0.4, y: 0.74 },
      }),
    ],
  };

  assert.equal(hasSeatedUpperBodyPose(poseResult), true);
});

test("web app uses upper body pose detection instead of face detection", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const detectorSource = readFileSync("apps/web/src/bodyPresenceDetection.mjs", "utf8");

  assert.match(appSource, /createUpperBodyPresenceDetector/);
  assert.match(appSource, /presenceDetected/);
  assert.doesNotMatch(appSource, /faceDetected/);
  assert.match(detectorSource, /PoseLandmarker/);
  assert.match(detectorSource, /pose_landmarker_lite/);
  assert.match(detectorSource, /hasSeatedUpperBodyPose/);
});
