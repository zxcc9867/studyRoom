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

  const overlapDetailsById = buildOverlapDetails(scheduledTodos);
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
      overlaps: (overlapDetailsById.get(item.todo.id) ?? []).length > 0,
      overlapDetails: overlapDetailsById.get(item.todo.id) ?? [],
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

function buildOverlapDetails(items) {
  const detailsById = new Map(items.map((item) => [item.todo.id, []]));

  for (let index = 0; index < items.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < items.length; compareIndex += 1) {
      const left = items[index];
      const right = items[compareIndex];
      const overlapRanges = normalizeOverlapRanges(
        getOverlapRanges(left.ranges, right.ranges),
      );

      for (const overlapRange of overlapRanges) {
        detailsById.get(left.todo.id).push(
          createOverlapDetail(right, overlapRange),
        );
        detailsById.get(right.todo.id).push(
          createOverlapDetail(left, overlapRange),
        );
      }
    }
  }

  return detailsById;
}

function createOverlapDetail(otherItem, overlapRange) {
  return {
    todoId: otherItem.todo.id,
    title: otherItem.todo.title,
    startTime: formatMinutesAsTime(otherItem.startMinute),
    endTime: formatMinutesAsTime(otherItem.endMinute),
    overlapStartTime: formatMinutesAsTime(overlapRange.start),
    overlapEndTime: formatMinutesAsTime(overlapRange.end),
    overlapWrapsMidnight: overlapRange.wrapsMidnight,
  };
}

function getOverlapRanges(leftRanges, rightRanges) {
  const overlapRanges = [];

  for (const left of leftRanges) {
    for (const right of rightRanges) {
      const start = Math.max(left.start, right.start);
      const end = Math.min(left.end, right.end);
      if (start < end) {
        overlapRanges.push({ start, end, wrapsMidnight: end === MINUTES_PER_DAY });
      }
    }
  }

  return overlapRanges.sort((left, right) => left.start - right.start);
}

function normalizeOverlapRanges(ranges) {
  if (ranges.length < 2) {
    return ranges;
  }

  const first = ranges[0];
  const last = ranges[ranges.length - 1];
  if (first.start !== 0 || last.end !== MINUTES_PER_DAY) {
    return ranges;
  }

  return [
    ...ranges.slice(1, -1),
    {
      start: last.start,
      end: first.end,
      wrapsMidnight: true,
    },
  ];
}
