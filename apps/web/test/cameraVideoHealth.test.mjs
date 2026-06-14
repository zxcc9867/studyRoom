import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getCameraFrameHealth,
  getCameraStreamHealth,
  isProbablyBlankCameraFrame,
} from "../src/cameraVideoHealth.mjs";

function rgbaPixels(values) {
  return new Uint8ClampedArray(values.flatMap(([r, g, b, a = 255]) => [r, g, b, a]));
}

test("camera stream health rejects missing, muted, ended, or disabled tracks", () => {
  assert.equal(getCameraStreamHealth(null).ok, false);
  assert.equal(
    getCameraStreamHealth({
      getVideoTracks: () => [{ readyState: "ended", muted: false, enabled: true }],
    }).reason,
    "track-ended",
  );
  assert.equal(
    getCameraStreamHealth({
      getVideoTracks: () => [{ readyState: "live", muted: true, enabled: true }],
    }).reason,
    "track-muted",
  );
  assert.equal(
    getCameraStreamHealth({
      getVideoTracks: () => [{ readyState: "live", muted: false, enabled: false }],
    }).reason,
    "track-disabled",
  );
});

test("camera stream health accepts a live unmuted enabled video track", () => {
  assert.deepEqual(
    getCameraStreamHealth({
      getVideoTracks: () => [{ readyState: "live", muted: false, enabled: true }],
    }),
    { ok: true, reason: "live" },
  );
});

test("blank black camera frames are treated as unhealthy", () => {
  const blackPixels = rgbaPixels(Array.from({ length: 64 }, () => [0, 0, 0]));

  assert.equal(isProbablyBlankCameraFrame(blackPixels), true);
  assert.deepEqual(
    getCameraFrameHealth({
      readyState: 2,
      videoWidth: 640,
      videoHeight: 480,
      pixels: blackPixels,
    }),
    { ok: false, reason: "blank-frame" },
  );
});

test("visible camera frames are treated as healthy", () => {
  const visiblePixels = rgbaPixels([
    [28, 32, 40],
    [100, 88, 76],
    [188, 160, 128],
    [66, 90, 120],
    [210, 190, 170],
    [44, 58, 72],
  ]);

  assert.equal(isProbablyBlankCameraFrame(visiblePixels), false);
  assert.deepEqual(
    getCameraFrameHealth({
      readyState: 2,
      videoWidth: 640,
      videoHeight: 480,
      pixels: visiblePixels,
    }),
    { ok: true, reason: "visible-frame" },
  );
});

test("camera frame health waits until video metadata and current frame are available", () => {
  assert.deepEqual(
    getCameraFrameHealth({
      readyState: 1,
      videoWidth: 640,
      videoHeight: 480,
      pixels: rgbaPixels([[10, 20, 30]]),
    }),
    { ok: false, reason: "no-current-frame" },
  );
  assert.deepEqual(
    getCameraFrameHealth({
      readyState: 2,
      videoWidth: 0,
      videoHeight: 480,
      pixels: rgbaPixels([[10, 20, 30]]),
    }),
    { ok: false, reason: "no-video-size" },
  );
});
