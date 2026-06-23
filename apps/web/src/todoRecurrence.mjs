export const todoWeekdayOptions = [
  { value: 0, label: "일" },
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
];

export function normalizeTodoRepeatWeekdays(weekdays) {
  return [
    ...new Set(
      (Array.isArray(weekdays) ? weekdays : [])
        .map((weekday) => Number(weekday))
        .filter((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6),
    ),
  ].sort((left, right) => left - right);
}

export function isWeeklyTodo(todo) {
  return (
    todo?.repeat_mode === "weekly" &&
    normalizeTodoRepeatWeekdays(todo.repeat_weekdays).length > 0 &&
    (Boolean(todo.repeat_until) || Boolean(todo.repeat_forever))
  );
}

export function formatTodoRepeatLabel(todo) {
  if (!isWeeklyTodo(todo)) {
    return "하루만";
  }

  const weekdayLabels = normalizeTodoRepeatWeekdays(todo.repeat_weekdays)
    .map((weekday) => todoWeekdayOptions.find((option) => option.value === weekday)?.label)
    .filter(Boolean)
    .join("/");

  if (todo.repeat_forever) {
    return `${weekdayLabels} 반복 · 영구 반복`;
  }

  return `${weekdayLabels} 반복 · ~ ${todo.repeat_until}`;
}

export function buildRecurringTodoDates({ startDate, endDate, weekdays }) {
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  const selectedWeekdays = new Set(
    normalizeTodoRepeatWeekdays(weekdays),
  );

  if (!start || !end || end.getTime() < start.getTime() || selectedWeekdays.size === 0) {
    return [];
  }

  const dates = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    if (selectedWeekdays.has(cursor.getDay())) {
      dates.push(formatDateKey(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function filterNewTodoDates({ dates, title, existingTodos, startTime = null, endTime = null }) {
  const normalizedTitle = normalizeTodoTitle(title);
  const targetTimeKey = normalizeTodoTimeKey(startTime, endTime);
  const existingKeys = new Set(
    existingTodos.map((todo) => `${todo.local_date}:${normalizeTodoTitle(todo.title)}:${normalizeTodoTimeKey(todo.start_time, todo.end_time)}`),
  );

  return dates.filter((date) => !existingKeys.has(`${date}:${normalizedTitle}:${targetTimeKey}`));
}

export function getTodoSaveFocusDate({ selectedDate, targetDates }) {
  if (targetDates.includes(selectedDate)) {
    return selectedDate;
  }
  return targetDates[0] ?? selectedDate;
}

export function getDefaultRepeatEndDate(startDate) {
  const date = parseDateKey(startDate);
  if (!date) return startDate;
  return formatDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function getForeverRepeatEndDate(startDate) {
  const date = parseDateKey(startDate);
  if (!date) return startDate;
  const nextYearDate = new Date(date.getFullYear() + 1, date.getMonth(), date.getDate());
  if (nextYearDate.getMonth() !== date.getMonth()) {
    return formatDateKey(new Date(date.getFullYear() + 1, date.getMonth() + 1, 0));
  }
  return formatDateKey(nextYearDate);
}

export function getWeekdayFromDateKey(dateKey) {
  return parseDateKey(dateKey)?.getDay() ?? 0;
}

function normalizeTodoTitle(title) {
  return String(title).trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

function normalizeTodoTimeKey(startTime, endTime) {
  return `${normalizeClockTime(startTime) ?? ""}-${normalizeClockTime(endTime) ?? ""}`;
}

function normalizeClockTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(String(value ?? "").trim());
  return match ? `${match[1]}:${match[2]}` : null;
}

function parseDateKey(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
