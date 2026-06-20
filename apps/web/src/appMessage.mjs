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
