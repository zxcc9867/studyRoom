export function normalizeTodoSchedule({ enabled, startTime, endTime }) {
  if (!enabled) {
    return { ok: true, startTime: null, endTime: null };
  }

  const normalizedStart = normalizeClockTime(startTime);
  const normalizedEnd = normalizeClockTime(endTime);
  if (!normalizedStart || !normalizedEnd) {
    return {
      ok: false,
      message: "시작 시간과 종료 시간을 모두 선택하세요.",
      startTime: null,
      endTime: null,
    };
  }

  if (normalizedStart === normalizedEnd) {
    return {
      ok: false,
      message: "시작 시간과 종료 시간은 같을 수 없습니다.",
      startTime: null,
      endTime: null,
    };
  }

  return { ok: true, startTime: normalizedStart, endTime: normalizedEnd };
}

export function formatTodoScheduleLabel(todo) {
  const startTime = normalizeClockTime(todo?.start_time ?? todo?.startTime);
  const endTime = normalizeClockTime(todo?.end_time ?? todo?.endTime);
  return startTime && endTime ? `${startTime}-${endTime}` : "";
}

export function formatTodoWithSchedule(todo) {
  const label = formatTodoScheduleLabel(todo);
  const title = String(todo?.title ?? "");
  return label ? `${label} ${title}` : title;
}

function normalizeClockTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(String(value ?? "").trim());
  return match ? `${match[1]}:${match[2]}` : null;
}
