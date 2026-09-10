import { buildRangeMetrics } from "./weeklyReview.mjs";

export function getStudyReportTodayDate(nowMs, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(nowMs));
  const part = type => parts.find(item => item.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const DAY = 86400000;
const dateKey = date => date.toISOString().slice(0, 10);
const addDays = (key, days) => dateKey(new Date(parseDate(key).getTime() + days * DAY));

function parseDate(key) {
  if (typeof key !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(key)) throw new Error("Invalid report date");
  const value = new Date(`${key}T00:00:00Z`);
  if (!Number.isFinite(value.getTime()) || dateKey(value) !== key) throw new Error("Invalid report date");
  return value;
}

function periodStart(key, mode) {
  const date = parseDate(key);
  return mode === "month" ? `${key.slice(0, 7)}-01` : addDays(key, -(date.getUTCDay() + 6) % 7);
}

function shiftStart(start, mode, offset) {
  if (mode === "week") return addDays(start, offset * 7);
  const date = parseDate(start);
  return dateKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1)));
}

function range(startDate, endDate) {
  return { startDate, endDate, coveredDayCount: Math.round((parseDate(endDate) - parseDate(startDate)) / DAY) + 1 };
}

export function getStudyReportPeriods({ todayDateKey, mode = "week", anchorDate = todayDateKey }) {
  parseDate(todayDateKey); parseDate(anchorDate);
  if (!["week", "month"].includes(mode) || anchorDate > todayDateKey) throw new Error("Invalid report period");
  const start = periodStart(anchorDate, mode);
  const previousStart = shiftStart(start, mode, -1);
  const nextAnchor = shiftStart(start, mode, 1);
  const isCurrentPeriod = start === periodStart(todayDateKey, mode);
  const end = isCurrentPeriod ? todayDateKey : addDays(nextAnchor, -1);
  const currentRange = range(start, end);
  const previousFullEnd = addDays(start, -1);
  const elapsedPreviousEnd = addDays(previousStart, currentRange.coveredDayCount - 1);
  const previousEnd = isCurrentPeriod && elapsedPreviousEnd < previousFullEnd ? elapsedPreviousEnd : previousFullEnd;
  return {
    mode, currentRange, previousRange: range(previousStart, previousEnd), isCurrentPeriod,
    previousAnchor: previousStart, nextAnchor, canGoForward: !isCurrentPeriod,
    comparisonLabel: mode === "month" ? "이전 달" : "이전 주",
  };
}

export function buildStudyReport(periods, data) {
  if (!data.currentSummary || !data.previousSummary) throw new Error("Report summaries are not ready");
  const current = buildRangeMetrics(periods.currentRange, data.sessions, data.todos, data.attendanceDays, data.reflections, data.currentSummary);
  const previous = buildRangeMetrics(periods.previousRange, data.sessions, data.todos, data.attendanceDays, data.reflections, data.previousSummary);
  return { current, previous, studySecondsChange: current.studySeconds - previous.studySeconds, completionRateChange: current.completionRate - previous.completionRate, consistencyChange: current.consistencyScore - previous.consistencyScore };
}
