export type RecoveryTriggerType = "missed_attendance" | "camera_absence_repeat";

export type RecoveryRequestSummaryRow = {
  id: string;
  user_id: string;
  local_date: string;
  trigger_type: RecoveryTriggerType;
  status: "pending" | "submitted";
  reason: string | null;
  makeup_todo_title: string | null;
  pledge_todo_title: string | null;
  created_at: string;
};

type SlackTargetRow = {
  id: string;
  user_id: string;
  destination: string | null;
};

type ProfileRow = {
  user_id: string;
  time_zone: string | null;
};

type AdminClient = {
  from: (table: string) => any;
};

const msPerDay = 24 * 60 * 60 * 1000;

const recoveryReasonCategories = [
  {
    id: "sleep",
    label: "수면/피로",
    keywords: ["늦잠", "수면", "잠", "졸", "피곤", "피로", "컨디션", "기상"],
    action: "알림 10분 전 책상에 앉아 카메라와 오늘 할 일을 먼저 확인하세요.",
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

const unknownRecoveryCategory = {
  id: "other",
  label: "기타",
  action: "공부 시작 전에 오늘 방해 요인을 한 줄로 적고, 첫 10분만 바로 시작하세요.",
};

export async function sendWeeklyRecoverySummaries(admin: AdminClient, nowIso: string) {
  const { data: targets, error: targetError } = await admin
    .from("notification_targets")
    .select("id,user_id,destination")
    .eq("kind", "slack")
    .eq("enabled", true)
    .not("destination", "is", null)
    .limit(500);

  if (targetError) {
    throw targetError;
  }

  const slackTargets = ((targets ?? []) as SlackTargetRow[]).filter((target) => target.destination?.trim());
  if (slackTargets.length === 0) {
    return [];
  }

  const userIds = [...new Set(slackTargets.map((target) => target.user_id))];
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("user_id,time_zone")
    .in("user_id", userIds);

  if (profileError) {
    throw profileError;
  }

  const profileByUserId = new Map((profiles ?? []).map((profile: ProfileRow) => [profile.user_id, profile]));
  const results = [];

  for (const target of slackTargets) {
    const timeZone = profileByUserId.get(target.user_id)?.time_zone || "Asia/Tokyo";
    const localNow = getLocalNowParts(nowIso, timeZone);
    if (!shouldSendWeeklySummary(localNow)) {
      continue;
    }

    const { weekStart, weekEnd } = getPreviousWeekRange(localNow.dateKey);
    const { data: existing, error: existingError } = await admin
      .from("study_recovery_weekly_reports")
      .select("id")
      .eq("user_id", target.user_id)
      .eq("week_start_date", weekStart)
      .maybeSingle();

    if (existingError) {
      results.push({ userId: target.user_id, ok: false, error: existingError.message });
      continue;
    }
    if (existing) {
      results.push({ userId: target.user_id, skipped: true, reason: "already_sent", weekStart });
      continue;
    }

    const { data: requests, error: requestError } = await admin
      .from("study_recovery_requests")
      .select("id,user_id,local_date,trigger_type,status,reason,makeup_todo_title,pledge_todo_title,created_at")
      .eq("user_id", target.user_id)
      .eq("status", "submitted")
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd)
      .order("local_date", { ascending: true });

    if (requestError) {
      results.push({ userId: target.user_id, ok: false, error: requestError.message });
      continue;
    }

    const summary = summarizeRecoveryRequestsInRange((requests ?? []) as RecoveryRequestSummaryRow[], weekStart, weekEnd);
    if (summary.totalCount === 0) {
      results.push({ userId: target.user_id, skipped: true, reason: "no_recovery_requests", weekStart });
      continue;
    }

    try {
      const messageTs = await sendWeeklyRecoverySummarySlackMessage(target.destination!, summary);
      const { error: insertError } = await admin.from("study_recovery_weekly_reports").insert({
        user_id: target.user_id,
        week_start_date: weekStart,
        week_end_date: weekEnd,
        summary,
        slack_target_id: target.id,
        slack_message_ts: messageTs,
        slack_sent_at: new Date(nowIso).toISOString(),
      });
      if (insertError) {
        throw insertError;
      }
      await admin.from("notification_deliveries").insert({
        user_id: target.user_id,
        target_id: target.id,
        local_date: weekEnd,
        channel: "slack",
        status: "sent",
        error_message: null,
      });
      results.push({ userId: target.user_id, ok: true, weekStart, weekEnd, totalCount: summary.totalCount });
    } catch (error) {
      await admin.from("notification_deliveries").insert({
        user_id: target.user_id,
        target_id: target.id,
        local_date: weekEnd,
        channel: "slack",
        status: "failed",
        error_message: error instanceof Error ? error.message : String(error),
      });
      results.push({
        userId: target.user_id,
        ok: false,
        weekStart,
        weekEnd,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

export function shouldSendWeeklySummary(localNow: { dateKey: string; hour: number; minute: number }) {
  const weekday = parseDateKey(localNow.dateKey).getUTCDay();
  return weekday === 1 && localNow.hour === 8 && localNow.minute === 0;
}

export function summarizeRecoveryRequestsInRange(
  requests: RecoveryRequestSummaryRow[],
  weekStart: string,
  weekEnd: string,
) {
  const categoryMap = new Map<string, { id: string; label: string; action: string; count: number }>();
  for (const request of requests) {
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
    totalCount: requests.length,
    missedCount: requests.filter((request) => request.trigger_type === "missed_attendance").length,
    cameraCount: requests.filter((request) => request.trigger_type === "camera_absence_repeat").length,
    categories,
    topCategory,
    nextAction: topCategory?.action ?? unknownRecoveryCategory.action,
    samples: requests.slice(0, 5).map((request) => ({
      localDate: request.local_date,
      triggerType: request.trigger_type,
      reason: request.reason,
      makeupTodoTitle: request.makeup_todo_title,
      pledgeTodoTitle: request.pledge_todo_title,
      category: classifyRecoveryReason(request).label,
    })),
  };
}

function classifyRecoveryReason(request: RecoveryRequestSummaryRow) {
  const text = [
    request.reason,
    request.makeup_todo_title,
    request.pledge_todo_title,
    request.trigger_type === "camera_absence_repeat" ? "카메라 자리 비움" : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ko-KR");

  return recoveryReasonCategories.find((category) =>
    category.keywords.some((keyword) => text.includes(keyword.toLocaleLowerCase("ko-KR"))),
  ) ?? unknownRecoveryCategory;
}

function buildWeeklyRecoverySummaryMessage(summary: ReturnType<typeof summarizeRecoveryRequestsInRange>) {
  const categoryLines = summary.categories.slice(0, 4).map((category) => `- ${category.label}: ${category.count}건`);
  const sampleLines = summary.samples.slice(0, 3).map((sample) => {
    const trigger = sample.triggerType === "missed_attendance" ? "결석/지각" : "자리 비움";
    return `- ${sample.localDate} ${trigger}: ${sample.reason || "사유 없음"}`;
  });

  return [
    "*📋 이번 주 회복루틴 요약*",
    `기간: ${summary.weekStart} ~ ${summary.weekEnd}`,
    `총 ${summary.totalCount}건 · 결석/지각 ${summary.missedCount}건 · 자리 비움 ${summary.cameraCount}건`,
    "",
    "*주요 원인*",
    summary.topCategory ? `${summary.topCategory.label} (${summary.topCategory.count}건)` : "기록 없음",
    ...categoryLines,
    "",
    "*다음 공부 전 체크*",
    summary.nextAction,
    "",
    "*최근 사유*",
    ...(sampleLines.length > 0 ? sampleLines : ["- 기록 없음"]),
  ].join("\n");
}

async function sendWeeklyRecoverySummarySlackMessage(
  channelId: string,
  summary: ReturnType<typeof summarizeRecoveryRequestsInRange>,
) {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getSlackBotToken()}`,
    },
    body: JSON.stringify({
      channel: channelId,
      text: buildWeeklyRecoverySummaryMessage(summary),
      unfurl_links: false,
      unfurl_media: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack weekly recovery summary failed: ${response.status} ${await response.text()}`);
  }

  const result = (await response.json().catch(() => null)) as { ok?: boolean; ts?: string; error?: string } | null;
  if (!result?.ok) {
    throw new Error(`Slack weekly recovery summary returned unexpected result: ${JSON.stringify(result)}`);
  }

  return result.ts ?? null;
}

function getSlackBotToken() {
  const token = Deno.env.get("SLACK_BOT_TOKEN") ?? Deno.env.get("STUDY_ALERT_SLACK_BOT_TOKEN");
  if (!token) {
    throw new Error("SLACK_BOT_TOKEN is required");
  }
  return token;
}

function getLocalNowParts(nowIso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(nowIso));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  const hour = Number(part("hour"));
  const normalizedHour = hour === 24 ? 0 : hour;
  return {
    dateKey: `${part("year")}-${part("month")}-${part("day")}`,
    hour: normalizedHour,
    minute: Number(part("minute")),
  };
}

function getPreviousWeekRange(dateKey: string) {
  const { weekStart } = getWeekRange(dateKey);
  const previousWeekEnd = addDays(parseDateKey(weekStart), -1);
  const previousWeekStart = addDays(previousWeekEnd, -6);
  return {
    weekStart: formatDateKey(previousWeekStart),
    weekEnd: formatDateKey(previousWeekEnd),
  };
}

function getWeekRange(dateKey: string) {
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

function parseDateKey(dateKey: string) {
  const [year = "1970", month = "01", day = "01"] = dateKey.split("-");
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * msPerDay);
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
