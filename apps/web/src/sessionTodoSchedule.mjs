function formatClockTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * Suggest a practical one-hour block when the learner opens the start-study
 * planner. The value is only a starting point; the learner always confirms it.
 */
export function getSuggestedSessionTodoSchedule(date = new Date()) {
  const start = new Date(date);
  start.setSeconds(0, 0);
  start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30);

  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 60);

  return {
    startTime: formatClockTime(start),
    endTime: formatClockTime(end),
  };
}
