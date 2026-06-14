const currentFrameReadyState = 2;
const darkLumaThreshold = 10;
const minimumAverageLuma = 12;
const minimumLumaRange = 8;
const blankPixelRatio = 0.96;

export function getCameraStreamHealth(stream) {
  const tracks = typeof stream?.getVideoTracks === "function" ? stream.getVideoTracks() : [];
  const track = tracks[0];
  if (!track) {
    return { ok: false, reason: "no-video-track" };
  }
  if (track.readyState && track.readyState !== "live") {
    return { ok: false, reason: "track-ended" };
  }
  if (track.muted) {
    return { ok: false, reason: "track-muted" };
  }
  if (track.enabled === false) {
    return { ok: false, reason: "track-disabled" };
  }
  return { ok: true, reason: "live" };
}

export function getCameraFrameHealth({ readyState, videoWidth, videoHeight, pixels }) {
  if (readyState < currentFrameReadyState) {
    return { ok: false, reason: "no-current-frame" };
  }
  if (!videoWidth || !videoHeight) {
    return { ok: false, reason: "no-video-size" };
  }
  if (isProbablyBlankCameraFrame(pixels)) {
    return { ok: false, reason: "blank-frame" };
  }
  return { ok: true, reason: "visible-frame" };
}

export function isProbablyBlankCameraFrame(pixels) {
  if (!pixels || pixels.length < 4) {
    return true;
  }

  let sampleCount = 0;
  let darkCount = 0;
  let lumaTotal = 0;
  let minLuma = 255;
  let maxLuma = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] ?? 255;
    if (alpha < 32) continue;

    const luma = Math.round(0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]);
    sampleCount += 1;
    lumaTotal += luma;
    minLuma = Math.min(minLuma, luma);
    maxLuma = Math.max(maxLuma, luma);
    if (luma <= darkLumaThreshold) {
      darkCount += 1;
    }
  }

  if (sampleCount === 0) {
    return true;
  }

  const averageLuma = lumaTotal / sampleCount;
  const lumaRange = maxLuma - minLuma;
  return averageLuma < minimumAverageLuma || darkCount / sampleCount >= blankPixelRatio || lumaRange < minimumLumaRange;
}

export function cameraHealthMessage(reason) {
  switch (reason) {
    case "no-video-track":
      return "카메라 영상 트랙을 찾지 못했습니다. 카메라를 다시 켜주세요.";
    case "track-ended":
      return "카메라 연결이 종료되었습니다. 브라우저 권한이나 다른 앱 사용 여부를 확인한 뒤 다시 켜주세요.";
    case "track-muted":
      return "브라우저가 카메라 영상을 일시 중지했습니다. 권한, 프라이버시 셔터, 다른 앱 사용 여부를 확인하세요.";
    case "track-disabled":
      return "카메라 영상 트랙이 비활성화되어 있습니다. 카메라를 다시 켜주세요.";
    case "no-current-frame":
    case "no-video-size":
      return "카메라 영상을 불러오는 중입니다. 잠시 기다려주세요.";
    case "blank-frame":
      return "카메라 화면이 검은 상태입니다. 카메라 렌즈, 프라이버시 셔터, 다른 앱의 카메라 사용 여부를 확인하세요.";
    default:
      return "카메라 영상을 확인할 수 없습니다. 카메라를 다시 켜주세요.";
  }
}
