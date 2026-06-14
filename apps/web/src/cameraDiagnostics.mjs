import { ABSENCE_PAUSE_SECONDS, ABSENCE_WARNING_SECONDS } from "./cameraPresence.mjs";

export function getCameraDiagnostic({
  activeSession,
  cameraEnabled,
  cameraStatus,
  supportReason = null,
  healthReason = null,
  absenceSeconds = 0,
  timerPaused = false,
}) {
  if (supportReason === "secure-context-required") {
    return {
      tone: "error",
      title: "HTTPS 또는 localhost 필요",
      detail: "브라우저 보안 정책상 안전한 주소에서만 카메라를 사용할 수 있습니다.",
      checks: ["Vercel 배포 URL 또는 localhost에서 접속하세요.", "일반 http 주소에서는 카메라 권한이 열리지 않습니다."],
    };
  }

  if (supportReason === "media-devices-unavailable") {
    return {
      tone: "error",
      title: "카메라 API 미지원",
      detail: "현재 브라우저나 기기에서 카메라 접근 API를 사용할 수 없습니다.",
      checks: ["Chrome, Edge, Safari 최신 버전에서 다시 시도하세요.", "기기에 카메라가 연결되어 있는지 확인하세요."],
    };
  }

  if (healthReason === "permission-denied") {
    return {
      tone: "error",
      title: "카메라 권한 차단",
      detail: "브라우저 또는 운영체제에서 카메라 사용이 차단되어 있습니다.",
      checks: ["주소창 왼쪽의 사이트 권한에서 카메라를 허용하세요.", "운영체제 개인정보 보호 설정에서 브라우저 카메라 권한을 켜세요."],
    };
  }

  if (healthReason === "unknown-error") {
    return {
      tone: "error",
      title: "카메라 오류",
      detail: "카메라를 시작하는 중 브라우저 오류가 발생했습니다.",
      checks: ["카메라 감시를 다시 켜보세요.", "계속 실패하면 브라우저 권한과 다른 앱의 카메라 사용 여부를 확인하세요."],
    };
  }

  if (!activeSession) {
    return {
      tone: "idle",
      title: "세션 대기",
      detail: "공부 세션을 시작하면 카메라 진단이 활성화됩니다.",
      checks: ["입장하고 시작을 누른 뒤 카메라 감시를 켜세요.", "카메라 영상은 브라우저 안에서만 확인됩니다."],
    };
  }

  if (healthReason === "blank-frame") {
    return {
      tone: "error",
      title: "검은 화면 감지",
      detail: "카메라 영상은 들어오지만 화면이 거의 보이지 않습니다.",
      checks: ["렌즈 덮개나 프라이버시 셔터가 닫혀 있는지 확인하세요.", "다른 앱이 카메라를 점유 중이면 종료한 뒤 다시 켜세요."],
    };
  }

  if (healthReason === "track-muted") {
    return {
      tone: "error",
      title: "영상 일시 중단",
      detail: "브라우저가 카메라 영상을 일시 중단했습니다.",
      checks: ["브라우저 카메라 권한과 OS 카메라 권한을 확인하세요.", "다른 앱의 카메라 사용을 종료하고 다시 켜세요."],
    };
  }

  if (healthReason === "track-ended" || healthReason === "track-disabled" || healthReason === "no-video-track") {
    return {
      tone: "error",
      title: "카메라 연결 끊김",
      detail: "사용 가능한 카메라 영상 트랙을 찾지 못했습니다.",
      checks: ["카메라가 연결되어 있는지 확인하세요.", "카메라 감시를 껐다가 다시 켜세요."],
    };
  }

  if (healthReason === "no-current-frame" || healthReason === "no-video-size" || cameraStatus === "starting") {
    return {
      tone: "loading",
      title: "영상 연결 확인 중",
      detail: "카메라 영상을 불러오거나 멈춘 프레임을 복구하는 중입니다.",
      checks: ["잠시 기다리면 자동으로 한 번 다시 연결합니다.", "계속 멈추면 카메라 감시를 껐다가 다시 켜세요."],
    };
  }

  if (timerPaused || absenceSeconds >= ABSENCE_PAUSE_SECONDS) {
    return {
      tone: "warning",
      title: "타이머 자동 일시정지",
      detail: "10분 동안 상반신이 감지되지 않아 공부 시간 집계가 멈췄습니다.",
      checks: ["머리, 어깨, 상반신이 카메라에 들어오도록 앉으세요.", "상반신이 다시 감지되면 타이머가 이어집니다."],
    };
  }

  if (absenceSeconds >= ABSENCE_WARNING_SECONDS) {
    return {
      tone: "warning",
      title: "상반신 미감지",
      detail: "카메라는 정상이나 5분 이상 상반신이 감지되지 않았습니다.",
      checks: ["머리와 어깨가 화면 안에 들어오도록 조정하세요.", "계속 감지되지 않으면 10분부터 타이머가 일시정지됩니다."],
    };
  }

  if (absenceSeconds > 0) {
    return {
      tone: "notice",
      title: "상반신 확인 중",
      detail: "카메라는 정상이나 지금은 상반신 감지가 불안정합니다.",
      checks: ["화면 중앙에 앉고 조명을 조금 밝게 해보세요.", "노트북 각도를 조정해 어깨가 보이게 하세요."],
    };
  }

  if (cameraEnabled && cameraStatus === "watching") {
    return {
      tone: "ok",
      title: "카메라 정상",
      detail: "영상 수신과 상반신 감지가 정상입니다.",
      checks: ["타이머가 계속 흐르고 있습니다.", "자리를 비우면 5분 뒤 경고가 발생합니다."],
    };
  }

  return {
    tone: "idle",
    title: "감시 꺼짐",
    detail: "카메라 감시가 꺼져 있어 상태를 진단하지 않습니다.",
    checks: ["공부 세션 중에는 카메라 감시를 켜야 합니다.", "카메라 영상은 저장되거나 서버로 전송되지 않습니다."],
  };
}
