// Pure, bounded scheduling logic shared by Edge Functions and Node tests.
const MINUTE = 60000;
const formatters = new Map();
export function validZone(zone) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
    return typeof zone === "string" && zone.length < 80;
  } catch {
    return false;
  }
}
export function localParts(value, zone) {
  if (!formatters.has(zone)) {
    if (formatters.size > 64) formatters.clear();
    formatters.set(
      zone,
      new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
    );
  }
  const p = Object.fromEntries(
    formatters.get(zone).formatToParts(new Date(value)).map(
      (x) => [x.type, x.value],
    ),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}
export function addDays(day, amount) {
  return new Date(Date.parse(day + "T12:00:00Z") + amount * 86400000)
    .toISOString().slice(0, 10);
}
export function validDate(day) {
  return typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day;
}
export function validTime(time) {
  return typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}
// Resolve wall time without treating an offset as a timezone. Missing DST times are
// rejected; on a repeated hour take earliest start/latest end to block both folds.
export function wallInstant(day, time, zone, end = false) {
  if (!validDate(day) || !validTime(time) || !validZone(zone)) return null;
  const guess = Date.parse(`${day}T${time}:00Z`), offsets = new Set();
  for (const delta of [-36, -12, 0, 12, 36]) {
    const probe = guess + delta * 3600000, p = localParts(probe, zone);
    offsets.add(Date.parse(`${p.date}T${p.time}:00Z`) - probe);
  }
  const matches = [...offsets].map((offset) => guess - offset).filter((x) => {
    const p = localParts(x, zone);
    return p.date === day && p.time === time;
  }).sort((a, b) => a - b);
  return matches.length ? matches[end ? matches.length - 1 : 0] : null;
}
export function eventIntervals(event, day, zone) {
  const dayStart = wallInstant(day, "00:00", zone),
    dayEnd = wallInstant(addDays(day, 1), "00:00", zone, true);
  if (dayStart === null || dayEnd === null) return [];
  const repeats = event.repeat_weekdays?.length > 0,
    ez = event.all_day ? zone : (event.time_zone || zone),
    result = [];
  if (!repeats) {
    const start = event.all_day
      ? wallInstant(event.start_date, "00:00", ez)
      : Date.parse(event.start_at);
    const end = event.all_day
      ? wallInstant(event.end_date, "00:00", ez, true)
      : Date.parse(event.end_at);
    return Number.isFinite(start) && Number.isFinite(end) && start < dayEnd &&
        end > dayStart
      ? [[start, end]]
      : [];
  }
  const anchor = event.all_day
    ? event.start_date
    : localParts(event.start_at, ez).date;
  const durationDays = event.all_day
    ? Math.max(
      1,
      Math.round((Date.parse(event.end_date) - Date.parse(anchor)) / 86400000),
    )
    : Math.max(
      0,
      Math.round(
        (Date.parse(localParts(event.end_at, ez).date) - Date.parse(anchor)) /
          86400000,
      ),
    );
  // Limit event validation to a maximum seven-day span; include previous occurrence.
  for (let i = -8; i <= 2; i++) {
    const d = addDays(day, i), weekday = new Date(d + "T12:00Z").getUTCDay();
    if (
      d < anchor || (event.repeat_until && d > event.repeat_until) ||
      !event.repeat_weekdays.includes(weekday)
    ) continue;
    const start = wallInstant(
      d,
      event.all_day ? "00:00" : localParts(event.start_at, ez).time,
      ez,
    );
    const end = wallInstant(
      addDays(d, durationDays),
      event.all_day ? "00:00" : localParts(event.end_at, ez).time,
      ez,
      true,
    );
    if (start !== null && end !== null && start < dayEnd && end > dayStart) {
      result.push([start, end]);
    }
  }
  return result;
}
/** @param {{day:string,zone:string,settings:any,events?:any[],todos?:any[],now?:number}} input */
export function freeSlots(
  { day, zone, settings, events = [], todos = [], now = Date.now() },
) {
  const weekday = new Date(day + "T12:00Z").getUTCDay(),
    buffer = settings.buffer_minutes * MINUTE;
  const blocked = events.flatMap((e) => eventIntervals(e, day, zone));
  for (const t of todos) {
    if (t.start_time && t.end_time && !t.is_completed) {
      const start = t.coach_start_at
          ? Date.parse(t.coach_start_at)
          : wallInstant(t.local_date, t.start_time.slice(0, 5), zone),
        end = t.coach_end_at ? Date.parse(t.coach_end_at) : wallInstant(
          addDays(t.local_date, t.end_time <= t.start_time ? 1 : 0),
          t.end_time.slice(0, 5),
          zone,
          true,
        );
      if (start !== null && end !== null) blocked.push([start, end]);
    }
  }
  const windows = (settings.availability || []).filter((w) =>
    w.weekday === weekday
  ).map(
    (w) => [
      wallInstant(day, w.start, zone),
      wallInstant(day, w.end, zone, true),
    ],
  ).filter(([a, b]) => a !== null && b !== null && b > a);
  let slots = windows.map(([a, b]) => [Math.max(a, now), b]);
  for (const [a, b] of blocked) {
    slots = slots.flatMap(([s, e]) =>
      b + buffer <= s || a - buffer >= e
        ? [[s, e]]
        : [[s, Math.min(e, a - buffer)], [Math.max(s, b + buffer), e]].filter((
          [x, y],
        ) => y > x)
    );
  }
  // Overlapping availability windows should not duplicate recommendations.
  slots.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const slot of slots) {
    const last = merged.at(-1);
    if (last && slot[0] <= last[1]) last[1] = Math.max(last[1], slot[1]);
    else merged.push(slot);
  }
  return merged.filter(([a, b]) => b - a >= settings.min_slot_minutes * MINUTE)
    .map(([a, b]) => ({
      start_at: new Date(a).toISOString(),
      end_at: new Date(b).toISOString(),
      minutes: Math.floor((b - a) / MINUTE),
    }));
}
const text = (x, n = 180) =>
  typeof x === "string" && x.trim().length > 0 && x.trim().length <= n &&
  !/[<>\u0000-\u001f]/.test(x);
/** @returns {Record<string, any>} */
export function validateSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw Error("invalid_settings");
  }
  const out = {};
  for (const key of ["summary_time", "quiet_start", "quiet_end"]) {
    if (key in input) {
      if (!validTime(input[key])) throw Error("invalid_time");
      out[key] = input[key];
    }
  }
  for (const key of ["enabled"]) {
    if (key in input) {
      if (typeof input[key] !== "boolean") throw Error("invalid_settings");
      out[key] = input[key];
    }
  }
  for (
    const [key, min, max] of [["buffer_minutes", 0, 120], [
      "min_slot_minutes",
      5,
      120,
    ]]
  ) {
    if (key in input) {
      if (
        !Number.isInteger(input[key]) || input[key] < min || input[key] > max
      ) throw Error("invalid_settings");
      out[key] = input[key];
    }
  }
  if ("time_zone" in input) {
    if (!validZone(input.time_zone)) throw Error("invalid_zone");
    out.time_zone = input.time_zone;
  }
  if ("channels" in input) {
    if (!input.channels || typeof input.channels !== "object") {
      throw Error("invalid_channels");
    }
    out.channels = {};
    for (const key of ["slack", "web_push", "email"]) {
      if (typeof input.channels[key] !== "boolean") {
        throw Error("invalid_channels");
      }
      out.channels[key] = input.channels[key];
    }
  }
  if ("availability" in input) {
    if (!Array.isArray(input.availability) || input.availability.length > 28) {
      throw Error("invalid_availability");
    }
    out.availability = input.availability.map((w) => {
      if (
        !Number.isInteger(w.weekday) || w.weekday < 0 || w.weekday > 6 ||
        !validTime(w.start) || !validTime(w.end) || w.start >= w.end
      ) throw Error("invalid_availability");
      return { weekday: w.weekday, start: w.start, end: w.end };
    });
  }
  return out;
}
export function validateCareer(c) {
  if (
    !c || !text(c.title, 120) || typeof c.experience !== "string" ||
    c.experience.length > 2000 || c.target_date && !validDate(c.target_date) ||
    !Array.isArray(c.interests) || c.interests.length > 15 ||
    c.interests.some((x) => !text(x, 80)) || !Array.isArray(c.skills) ||
    c.skills.length > 30 ||
    typeof c.confirmed !== "boolean"
  ) throw Error("invalid_career");
  const ids = new Set();
  const skills = c.skills.map((s, i) => {
    if (
      !text(s.title, 120) || !text(s.task, 300) || !text(s.acceptance, 300) ||
      !["todo", "doing", "done"].includes(s.status) ||
      !Array.isArray(s.prerequisites) || s.prerequisites.some((x) =>
        !text(x, 120) || !ids.has(x)
      )
    ) throw Error("invalid_skill");
    const id = typeof s.id === "string" && /^[\w-]{1,80}$/.test(s.id)
      ? s.id
      : `skill-${i + 1}`;
    if (ids.has(id)) throw Error("invalid_skill");
    ids.add(id);
    return {
      id,
      title: s.title.trim(),
      task: s.task.trim(),
      acceptance: s.acceptance.trim(),
      status: s.status,
      prerequisites: s.prerequisites,
    };
  });
  return {
    title: c.title.trim(),
    experience: c.experience.trim(),
    target_date: c.target_date || null,
    interests: c.interests,
    skills,
    confirmed: c.confirmed,
  };
}
export function validateEvent(e) {
  if (
    !e || !text(e.title, 200) || !validZone(e.time_zone) ||
    typeof e.all_day !== "boolean" || !Array.isArray(e.repeat_weekdays) ||
    e.repeat_weekdays.length > 7 ||
    e.repeat_weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
    e.repeat_until && !validDate(e.repeat_until)
  ) throw Error("invalid_event");
  const start = e.all_day ? Date.parse(e.start_date) : Date.parse(e.start_at),
    end = e.all_day ? Date.parse(e.end_date) : Date.parse(e.end_at);
  if (
    !Number.isFinite(start) || !Number.isFinite(end) || end <= start ||
    end - start > 7 * 86400000 ||
    e.all_day && (!validDate(e.start_date) || !validDate(e.end_date))
  ) throw Error("invalid_event");
  return {
    title: e.title.trim(),
    all_day: e.all_day,
    time_zone: e.time_zone,
    repeat_weekdays: [...new Set(e.repeat_weekdays)],
    repeat_until: e.repeat_until || null,
    start_at: e.all_day ? null : new Date(start).toISOString(),
    end_at: e.all_day ? null : new Date(end).toISOString(),
    start_date: e.all_day ? e.start_date : null,
    end_date: e.all_day ? e.end_date : null,
  };
}
export function ruleRoadmap(career) {
  return career.interests.slice(0, 6).map((title, i) => ({
    id: `skill-${i + 1}`,
    title,
    prerequisites: i ? [`skill-${i}`] : [],
    task: `${title}의 기본 개념을 정리하고 작은 예제를 작성하기`,
    acceptance: "직접 실행한 예제와 배운 점 세 가지를 기록하기",
    status: "todo",
  }));
}
/** @param {{career:any,todos:any[],repositories?:any[],feedback?:any[]}} input */
export function rankCandidates(
  { career, todos, repositories = [], feedback = [] },
) {
  const excluded = new Set(
    feedback.filter((x) => ["known", "skip"].includes(x.feedback)).map((x) =>
      x.skill_id
    ),
  );
  const difficult = new Set(
    feedback.filter((x) => x.feedback === "difficult").map((x) => x.skill_id),
  );
  const done = new Set(
    career.skills.filter((s) => s.status === "done").flatMap(
      (s) => [s.id, s.title],
    ),
  );
  const candidates = todos.filter((t) => !t.is_completed && !t.start_time)
    .slice(0, 3).map((t) => ({
      title: t.title,
      source_todo_id: t.id,
      skill_id: null,
      acceptance: "작업 결과와 다음 행동을 짧게 기록하기",
      reason: "진행 중인 할 일의 다음 행동입니다.",
      duration_minutes: 25,
      source: "rules",
      evidence: [],
    }));
  for (const s of career.skills) {
    if (
      s.status !== "done" && !excluded.has(s.id) &&
      s.prerequisites.every((p) => done.has(p))
    ) {
      candidates.push({
        title: s.task,
        skill_id: s.id,
        acceptance: s.acceptance,
        reason: `${s.title} 스킬을 연습하는 다음 단계입니다.`,
        duration_minutes: difficult.has(s.id) ? 15 : 30,
        source: "rules",
        evidence: [],
      });
    }
  }
  for (const r of repositories) {
    for (const item of r.analysis || []) {
      if (item.title && item.evidence?.length) {
        candidates.push({
          ...item,
          duration_minutes: 30,
          source: "github",
          skill_id: null,
          reason: "연결한 저장소의 코드 근거가 있는 개선 작업입니다.",
        });
      }
    }
  }
  return candidates;
}
