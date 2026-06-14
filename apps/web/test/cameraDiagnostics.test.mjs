import assert from "node:assert/strict";
import { test } from "node:test";

import { getCameraDiagnostic } from "../src/cameraDiagnostics.mjs";
import { ABSENCE_PAUSE_SECONDS, ABSENCE_WARNING_SECONDS } from "../src/cameraPresence.mjs";

test("camera diagnostic explains browser support and permission problems", () => {
  assert.deepEqual(
    getCameraDiagnostic({
      activeSession: true,
      cameraEnabled: false,
      cameraStatus: "error",
      supportReason: "secure-context-required",
      healthReason: null,
      absenceSeconds: 0,
      timerPaused: false,
    }),
    {
      tone: "error",
      title: "HTTPS 또는 localhost 필요",
      detail: "브라우저 보안 정책상 안전한 주소에서만 카메라를 사용할 수 있습니다.",
      checks: ["Vercel 배포 URL 또는 localhost에서 접속하세요.", "일반 http 주소에서는 카메라 권한이 열리지 않습니다."],
    },
  );

  const permission = getCameraDiagnostic({
    activeSession: true,
    cameraEnabled: false,
    cameraStatus: "error",
    supportReason: "supported",
    healthReason: "permission-denied",
    absenceSeconds: 0,
    timerPaused: false,
  });

  assert.equal(permission.tone, "error");
  assert.equal(permission.title, "카메라 권한 차단");
  assert.match(permission.checks.join(" "), /주소창/);
  assert.match(permission.checks.join(" "), /운영체제/);
});

test("camera diagnostic separates camera feed problems from seat absence", () => {
  const blankFrame = getCameraDiagnostic({
    activeSession: true,
    cameraEnabled: true,
    cameraStatus: "error",
    supportReason: "supported",
    healthReason: "blank-frame",
    absenceSeconds: 0,
    timerPaused: false,
  });

  assert.equal(blankFrame.title, "검은 화면 감지");
  assert.equal(blankFrame.tone, "error");
  assert.match(blankFrame.detail, /카메라 영상/);
  assert.match(blankFrame.checks.join(" "), /렌즈/);

  const absence = getCameraDiagnostic({
    activeSession: true,
    cameraEnabled: true,
    cameraStatus: "watching",
    supportReason: "supported",
    healthReason: "visible-frame",
    absenceSeconds: ABSENCE_WARNING_SECONDS,
    timerPaused: false,
  });

  assert.equal(absence.tone, "warning");
  assert.equal(absence.title, "상반신 미감지");
  assert.match(absence.detail, /카메라는 정상/);
});

test("camera diagnostic reports healthy, loading, and auto paused states", () => {
  assert.deepEqual(
    getCameraDiagnostic({
      activeSession: true,
      cameraEnabled: true,
      cameraStatus: "watching",
      supportReason: "supported",
      healthReason: "visible-frame",
      absenceSeconds: 0,
      timerPaused: false,
    }),
    {
      tone: "ok",
      title: "카메라 정상",
      detail: "영상 수신과 상반신 감지가 정상입니다.",
      checks: ["타이머가 계속 흐르고 있습니다.", "자리를 비우면 5분 뒤 경고가 발생합니다."],
    },
  );

  assert.equal(
    getCameraDiagnostic({
      activeSession: true,
      cameraEnabled: true,
      cameraStatus: "starting",
      supportReason: "supported",
      healthReason: "no-current-frame",
      absenceSeconds: 0,
      timerPaused: false,
    }).title,
    "영상 연결 확인 중",
  );

  const paused = getCameraDiagnostic({
    activeSession: true,
    cameraEnabled: true,
    cameraStatus: "warning",
    supportReason: "supported",
    healthReason: "visible-frame",
    absenceSeconds: ABSENCE_PAUSE_SECONDS,
    timerPaused: true,
  });

  assert.equal(paused.tone, "warning");
  assert.equal(paused.title, "타이머 자동 일시정지");
  assert.match(paused.checks.join(" "), /상반신/);
});
