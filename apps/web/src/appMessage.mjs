export const SUCCESS_MESSAGE_AUTO_DISMISS_MS = 5000;

const AUTO_DISMISS_SUCCESS_KEYWORDS = [
  "되었습니다",
  "했습니다",
  "보냈습니다",
  "만들었습니다",
  "수정했습니다",
  "삭제했습니다",
  "저장했습니다",
  "시작했습니다",
  "종료했습니다",
  "제출했습니다",
  "유지합니다",
];

const PERSISTENT_NOTICE_KEYWORDS = [
  "Error",
  "Failed",
  "required",
  "permission",
  "오류",
  "실패",
  "필요",
  "권한",
  "확인하세요",
  "입력하세요",
  "선택하세요",
  "대기",
];

export function shouldAutoDismissMessage(message) {
  const normalized = String(message ?? "").trim();
  if (!normalized) return false;
  if (PERSISTENT_NOTICE_KEYWORDS.some((keyword) => normalized.includes(keyword))) return false;
  return AUTO_DISMISS_SUCCESS_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function getAppMessagePresentation(message) {
  const body = String(message ?? "").trim();
  if (!body) return null;

  const code = body.replace(/^Error:\s*/i, "");
  if (code === "ACTIVE_SESSION_EXISTS") {
    return {
      title: "이미 진행 중인 공부가 있어요",
      body: "현재 세션을 확인한 뒤 이어서 공부해 주세요.",
      tone: "warning",
      role: "status",
    };
  }
  if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(code)) {
    return {
      title: "요청을 처리하지 못했어요",
      body: "잠시 후 다시 시도해 주세요. 문제가 계속되면 화면을 새로고침해 주세요.",
      tone: "danger",
      role: "alert",
    };
  }
  if (/error|failed|failure|timeout|unauthorized|forbidden|오류|실패|못했|시간.*초과/i.test(body)) {
    return { title: "처리 상태를 확인해 주세요", body, tone: "danger", role: "alert" };
  }
  if (shouldAutoDismissMessage(body)) {
    return { title: "완료했어요", body, tone: "success", role: "status" };
  }
  if (/필요|권한|확인하세요|입력하세요|선택하세요|대기|한도|기다려/.test(body)) {
    return { title: "확인해 주세요", body, tone: "warning", role: "status" };
  }
  return { title: "알려드려요", body, tone: "info", role: "status" };
}
