const DAY_MS = 24 * 60 * 60 * 1000;

export function getAdaptiveReminderRecommendation({
  sessions = [],
  todayDateKey,
  timeZone,
  currentReminderTime,
  minimumDays = 3,
}) {
  const cutoff = new Date(`${todayDateKey}T00:00:00Z`).getTime() - 27 * DAY_MS;
  const firstByDate = new Map();

  for (const session of sessions) {
    if (session.status !== "completed" || !session.local_date || !session.started_at) continue;
    const localDateMs = new Date(`${session.local_date}T00:00:00Z`).getTime();
    if (!Number.isFinite(localDateMs) || localDateMs < cutoff) continue;
    const current = firstByDate.get(session.local_date);
    if (!current || session.started_at < current.started_at) firstByDate.set(session.local_date, session);
  }

  const startMinutes = [...firstByDate.values()]
    .map((session) => getZonedStartMinute(session.started_at, timeZone))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);

  if (startMinutes.length < minimumDays) {
    return {
      status: "insufficient-data",
      recommendedTime: currentReminderTime.slice(0, 5),
      sampleSize: startMinutes.length,
      deltaMinutes: 0,
      reason: `추천을 만들려면 최소 ${minimumDays}일의 완료 세션이 필요해요.`,
    };
  }

  const middle = Math.floor(startMinutes.length / 2);
  const median = startMinutes.length % 2 === 0
    ? Math.round((startMinutes[middle - 1] + startMinutes[middle]) / 2)
    : startMinutes[middle];
  const rounded = Math.max(360, Math.min(1380, Math.round(median / 15) * 15));
  const currentMinutes = parseTimeMinutes(currentReminderTime);
  const recommendedTime = formatTimeMinutes(rounded);
  const deltaMinutes = Number.isFinite(currentMinutes) ? rounded - currentMinutes : 0;

  return {
    status: Math.abs(deltaMinutes) < 15 ? "aligned" : "recommended",
    recommendedTime,
    sampleSize: startMinutes.length,
    deltaMinutes,
    reason: `최근 ${startMinutes.length}일의 첫 공부 시작 중앙값을 15분 단위로 맞췄어요.`,
  };
}

function getZonedStartMinute(value, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return hour * 60 + minute;
}

function parseTimeMinutes(value) {
  const [hour, minute] = String(value).slice(0, 5).split(":").map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : Number.NaN;
}

function formatTimeMinutes(value) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
