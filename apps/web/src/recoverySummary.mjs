const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const RECOVERY_REASON_CATEGORIES = [
  {
    id: "sleep",
    label: "수면/피로",
    keywords: ["늦잠", "수면", "잠", "졸", "피곤", "피로", "컨디션", "기상"],
    action: "알림 10분 전에는 책상에 앉아 카메라와 오늘 할 일을 먼저 확인하세요.",
  },
  {
    id: "work",
    label: "업무/일정",
    keywords: ["회사", "업무", "야근", "회의", "미팅", "출근", "퇴근", "근무"],
    action: "업무가 있는 날은 공부 시작 시간을 앞당기거나 짧은 보충 세션을 미리 배치하세요.",
  },
  {
    id: "personal",
    label: "개인 일정",
    keywords: ["약속", "외출", "이동", "가족", "친구", "식사"],
    action: "개인 일정이 있는 날은 생활계획표에 이동 시간을 먼저 넣고 공부 시간을 잠그세요.",
  },
  {
    id: "health",
    label: "건강",
    keywords: ["아픔", "아파", "병원", "감기", "두통", "몸살", "진료"],
    action: "컨디션이 좋지 않은 날은 목표 시간을 줄이고 최소 시작 루틴만 지키세요.",
  },
  {
    id: "alert",
    label: "알림/습관",
    keywords: ["알림", "못 봄", "못봤", "깜빡", "잊", "까먹"],
    action: "Slack과 브라우저 알림 상태를 확인하고, 알림 직후 바로 입장하는 규칙을 두세요.",
  },
  {
    id: "camera",
    label: "환경/자리 비움",
    keywords: ["카메라", "자리", "이탈", "비움", "화장실", "나갔", "밖"],
    action: "세션 시작 전에 카메라 각도와 조명을 확인하고, 자리를 비울 때는 먼저 일시정지하세요.",
  },
  {
    id: "focus",
    label: "집중/의지",
    keywords: ["집중", "의지", "미루", "게으", "딴짓", "유튜브", "게임"],
    action: "세션 시작 전에 이번 세션에서 끝낼 할 일 1개만 고르고 방해 앱을 닫으세요.",
  },
];

export const UNKNOWN_RECOVERY_CATEGORY = {
  id: "other",
  label: "기타",
  keywords: [],
  action: "공부 시작 전에 오늘 방해 요인을 한 줄로 적고, 첫 10분만 바로 시작하세요.",
};

export function classifyRecoveryReason(request) {
  const text = [
    request?.reason,
    request?.makeup_todo_title,
    request?.pledge_todo_title,
    request?.trigger_type === "camera_absence_repeat" ? "카메라 자리 비움" : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ko-KR");

  const matchedCategory = RECOVERY_REASON_CATEGORIES.find((category) =>
    category.keywords.some((keyword) => text.includes(keyword.toLocaleLowerCase("ko-KR"))),
  );

  return matchedCategory ?? UNKNOWN_RECOVERY_CATEGORY;
}

export function getRecoveryTriggerLabel(triggerType) {
  if (triggerType === "missed_attendance") return "결석/지각";
  if (triggerType === "camera_absence_repeat") return "자리 비움 반복";
  return "회복루틴";
}

export function getRecoveryWeekRange(dateKey) {
  const date = parseDateKey(dateKey);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = addDays(date, mondayOffset);
  const weekEnd = addDays(weekStart, 6);

  return {
    weekStart: formatDateKey(weekStart),
    weekEnd: formatDateKey(weekEnd),
  };
}

export function getPreviousRecoveryWeekRange(dateKey) {
  const { weekStart } = getRecoveryWeekRange(dateKey);
  const previousWeekEnd = addDays(parseDateKey(weekStart), -1);
  const previousWeekStart = addDays(previousWeekEnd, -6);

  return {
    weekStart: formatDateKey(previousWeekStart),
    weekEnd: formatDateKey(previousWeekEnd),
  };
}

export function summarizeRecoveryRequests(requests, dateKey) {
  const { weekStart, weekEnd } = getRecoveryWeekRange(dateKey);
  return summarizeRecoveryRequestsInRange(requests, weekStart, weekEnd);
}

export function summarizeRecoveryRequestsInRange(requests, weekStart, weekEnd) {
  const weeklyRequests = [...requests]
    .filter((request) => request.local_date >= weekStart && request.local_date <= weekEnd)
    .sort((left, right) => {
      const dateOrder = right.local_date.localeCompare(left.local_date);
      if (dateOrder !== 0) return dateOrder;
      return String(right.created_at ?? "").localeCompare(String(left.created_at ?? ""));
    });

  const categoryMap = new Map();
  for (const request of weeklyRequests) {
    const category = classifyRecoveryReason(request);
    const current = categoryMap.get(category.id) ?? {
      id: category.id,
      label: category.label,
      action: category.action,
      count: 0,
    };
    current.count += 1;
    categoryMap.set(category.id, current);
  }

  const categories = [...categoryMap.values()].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.label.localeCompare(right.label, "ko-KR");
  });
  const topCategory = categories[0] ?? null;

  return {
    weekStart,
    weekEnd,
    totalCount: weeklyRequests.length,
    submittedCount: weeklyRequests.filter((request) => request.status === "submitted").length,
    pendingCount: weeklyRequests.filter((request) => request.status === "pending").length,
    missedCount: weeklyRequests.filter((request) => request.trigger_type === "missed_attendance").length,
    cameraCount: weeklyRequests.filter((request) => request.trigger_type === "camera_absence_repeat").length,
    categories,
    topCategory,
    nextAction: topCategory?.action ?? UNKNOWN_RECOVERY_CATEGORY.action,
    requests: weeklyRequests,
  };
}

function parseDateKey(dateKey) {
  const [year = "1970", month = "01", day = "01"] = String(dateKey).split("-");
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function addDays(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}
