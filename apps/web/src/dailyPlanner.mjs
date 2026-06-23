export const DAILY_PLANNER_COLORS = [
  "#b7e6c7",
  "#f8d46a",
  "#f5a6a2",
  "#80d5db",
  "#9fbde8",
  "#f7e8a6",
  "#d8edbc",
];

const MINUTES_PER_DAY = 24 * 60;
const SNAP_MINUTES = 30;

export function timeToPlannerAngle(time) {
  return (parseTimeToMinutes(time) / MINUTES_PER_DAY) * 360;
}

export function plannerAngleToTime(angle) {
  const normalizedAngle = ((Number(angle) % 360) + 360) % 360;
  const rawMinutes = (normalizedAngle / 360) * MINUTES_PER_DAY;
  const snappedMinutes = Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES;
  return formatMinutesAsTime(snappedMinutes % MINUTES_PER_DAY);
}

export function buildDailyPlannerSegments(todos, dateKey) {
  const scheduledTodos = [];
  const unscheduledTodos = [];

  for (const todo of todos) {
    if (todo.local_date !== dateKey) {
      continue;
    }

    if (!todo.start_time || !todo.end_time) {
      unscheduledTodos.push(todo);
      continue;
    }

    const startMinute = parseTimeToMinutes(todo.start_time);
    const endMinute = parseTimeToMinutes(todo.end_time);
    if (startMinute === endMinute) {
      unscheduledTodos.push(todo);
      continue;
    }

    const durationMinutes =
      endMinute > startMinute ? endMinute - startMinute : MINUTES_PER_DAY - startMinute + endMinute;

    scheduledTodos.push({
      todo,
      startMinute,
      endMinute,
      durationMinutes,
      wrapsMidnight: endMinute < startMinute,
      ranges: expandPlannerRanges(startMinute, endMinute),
    });
  }

  const overlapIds = findOverlappingTodoIds(scheduledTodos);
  const segments = scheduledTodos
    .sort((left, right) => left.startMinute - right.startMinute || left.todo.title.localeCompare(right.todo.title))
    .map((item, index) => ({
      id: item.todo.id,
      todo: item.todo,
      title: item.todo.title,
      startTime: formatMinutesAsTime(item.startMinute),
      endTime: formatMinutesAsTime(item.endMinute),
      startMinute: item.startMinute,
      endMinute: item.endMinute,
      durationMinutes: item.durationMinutes,
      startAngle: minuteToAngle(item.startMinute),
      endAngle: minuteToAngle((item.startMinute + item.durationMinutes) % MINUTES_PER_DAY),
      wrapsMidnight: item.wrapsMidnight,
      overlaps: overlapIds.has(item.todo.id),
      color: DAILY_PLANNER_COLORS[index % DAILY_PLANNER_COLORS.length],
    }));

  return { segments, unscheduledTodos };
}

function parseTimeToMinutes(time) {
  const [hour = "0", minute = "0"] = String(time).slice(0, 5).split(":");
  return Math.max(0, Math.min(MINUTES_PER_DAY - 1, Number(hour) * 60 + Number(minute)));
}

function minuteToAngle(minutes) {
  return (minutes / MINUTES_PER_DAY) * 360;
}

function formatMinutesAsTime(minutes) {
  const normalizedMinutes = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function expandPlannerRanges(startMinute, endMinute) {
  if (endMinute > startMinute) {
    return [{ start: startMinute, end: endMinute }];
  }

  return [
    { start: startMinute, end: MINUTES_PER_DAY },
    { start: 0, end: endMinute },
  ];
}

function findOverlappingTodoIds(items) {
  const overlapIds = new Set();
  for (let index = 0; index < items.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < items.length; compareIndex += 1) {
      if (rangesOverlap(items[index].ranges, items[compareIndex].ranges)) {
        overlapIds.add(items[index].todo.id);
        overlapIds.add(items[compareIndex].todo.id);
      }
    }
  }

  return overlapIds;
}

function rangesOverlap(leftRanges, rightRanges) {
  return leftRanges.some((left) =>
    rightRanges.some((right) => left.start < right.end && right.start < left.end),
  );
}
