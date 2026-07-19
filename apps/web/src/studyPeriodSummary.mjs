export const EMPTY_STUDY_PERIOD_SUMMARY = Object.freeze({
  completedSeconds: 0,
  completedSessionCount: 0,
  anomalySessionCount: 0,
  crossDateSessionCount: 0,
});

export async function fetchStudyPeriodSummary(client, startDate, endDate) {
  const { data, error } = await client.rpc("get_study_period_summary", {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return normalizeStudyPeriodSummary(row);
}

export function normalizeStudyPeriodSummary(row) {
  if (!row || typeof row !== "object") return { ...EMPTY_STUDY_PERIOD_SUMMARY };
  return {
    completedSeconds: toNonNegativeNumber(row.completed_seconds),
    completedSessionCount: toNonNegativeNumber(row.completed_session_count),
    anomalySessionCount: toNonNegativeNumber(row.anomaly_session_count),
    crossDateSessionCount: toNonNegativeNumber(row.cross_date_session_count),
  };
}

export function getMonthDateRange(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey))) throw new Error("Invalid month key");
  const [year, month] = monthKey.split("-").map(Number);
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { startDate: `${monthKey}-01`, endDate: `${monthKey}-${String(endDay).padStart(2, "0")}` };
}

function toNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}
