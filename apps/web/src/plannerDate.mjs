const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getPlannerDateLabel(dateKey, todayDateKey) {
  const offset = getDateOffsetDays(todayDateKey, dateKey);
  if (offset === -1) return "어제 할 일";
  if (offset === 0) return "오늘 할 일";
  if (offset === 1) return "내일 할 일";

  const date = parseDateKey(dateKey);
  if (!date) return "선택한 날짜 할 일";
  return `${date.getMonth() + 1}월 ${date.getDate()}일 할 일`;
}

export function normalizePlanCopyTargetDates({ sourceDate, selectedDates }) {
  return [
    ...new Set(
      (Array.isArray(selectedDates) ? selectedDates : [])
        .filter(isValidDateKey)
        .filter((dateKey) => dateKey !== sourceDate),
    ),
  ].sort();
}

export function buildPlanCopyRows({ sourceTodos, targetDates, existingTodos, userId }) {
  const normalizedTargetDates = normalizePlanCopyTargetDates({
    sourceDate: null,
    selectedDates: targetDates,
  });
  const existingKeys = new Set(
    (Array.isArray(existingTodos) ? existingTodos : []).map((todo) => getTodoDuplicateKey(todo)),
  );
  const nextPositionsByDate = getNextPositionsByDate(existingTodos);
  const rows = [];

  for (const targetDate of normalizedTargetDates) {
    for (const todo of Array.isArray(sourceTodos) ? sourceTodos : []) {
      const duplicateKey = getTodoDuplicateKey({ ...todo, local_date: targetDate });
      if (existingKeys.has(duplicateKey)) continue;

      const position = nextPositionsByDate.get(targetDate) ?? 0;
      nextPositionsByDate.set(targetDate, position + 1);
      existingKeys.add(duplicateKey);
      rows.push({
        user_id: userId,
        local_date: targetDate,
        title: todo.title,
        start_time: normalizeClockTime(todo.start_time),
        end_time: normalizeClockTime(todo.end_time),
        goal_id: todo.goal_id ?? null,
        repeat_group_id: null,
        repeat_mode: "single",
        repeat_weekdays: [],
        repeat_until: null,
        repeat_forever: false,
        is_completed: false,
        position,
      });
    }
  }

  return rows;
}

function getNextPositionsByDate(todos) {
  const positions = new Map();
  for (const todo of Array.isArray(todos) ? todos : []) {
    positions.set(todo.local_date, Math.max(positions.get(todo.local_date) ?? 0, Number(todo.position ?? 0) + 1));
  }
  return positions;
}

function getTodoDuplicateKey(todo) {
  return [
    todo.local_date,
    normalizeTodoTitle(todo.title),
    normalizeClockTime(todo.start_time) ?? "",
    normalizeClockTime(todo.end_time) ?? "",
  ].join(":");
}

function normalizeTodoTitle(title) {
  return String(title ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

function normalizeClockTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(String(value ?? "").trim());
  return match ? `${match[1]}:${match[2]}` : null;
}

function getDateOffsetDays(baseDateKey, targetDateKey) {
  const baseDate = parseDateKey(baseDateKey);
  const targetDate = parseDateKey(targetDateKey);
  if (!baseDate || !targetDate) return null;
  return Math.round((targetDate.getTime() - baseDate.getTime()) / 86400000);
}

function isValidDateKey(dateKey) {
  return Boolean(parseDateKey(dateKey));
}

function parseDateKey(dateKey) {
  if (!DATE_KEY_PATTERN.test(String(dateKey ?? ""))) return null;
  const [yearText, monthText, dayText] = String(dateKey).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}
