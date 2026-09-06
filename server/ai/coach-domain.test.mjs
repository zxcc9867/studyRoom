import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  eventIntervals,
  freeSlots,
  localParts,
  rankCandidates,
  validateCareer,
  validateEvent,
  validateSettings,
  validDate,
  validTime,
  validZone,
  wallInstant,
} from "../../supabase/functions/_shared/coach-domain.mjs";

const day = "2026-09-07", zone = "Asia/Seoul";
const settings = {
  buffer_minutes: 10,
  min_slot_minutes: 15,
  availability: [{ weekday: 1, start: "18:00", end: "21:00" }],
};
const slots = (extra = {}) =>
  freeSlots({ day, zone, settings, now: 0, ...extra });
const event = {
  title: "appointment",
  all_day: false,
  start_at: "2026-09-07T10:00:00Z",
  end_at: "2026-09-07T11:00:00Z",
  time_zone: zone,
  repeat_weekdays: [],
};
const skill = {
  id: "s1",
  title: "TypeScript",
  task: "타입 좁히기 예제 작성",
  acceptance: "세 가지 입력으로 실행한 결과 기록",
  status: "todo",
  prerequisites: [],
};
const career = {
  title: "백엔드 개발자",
  experience: "처음 시작",
  interests: ["TypeScript"],
  target_date: null,
  skills: [skill],
  confirmed: true,
};

test("Seoul and Tokyo resolve identical current wall instants", () =>
  assert.equal(
    wallInstant(day, "19:00", zone),
    wallInstant(day, "19:00", "Asia/Tokyo"),
  ));
test("timezone changes display, not actual instant", () =>
  assert.equal(
    localParts("2026-09-07T10:00Z", "America/New_York").time,
    "06:00",
  ));
test("invalid zone fails closed", () =>
  assert.equal(validZone("Mars/Olympus"), false));
test("invalid calendar dates rejected", () =>
  assert.equal(validDate("2026-02-30"), false));
test("midnight valid, 24:00 invalid", () => {
  assert.equal(validTime("00:00"), true);
  assert.equal(validTime("24:00"), false);
});
test("DST missing hour rejected", () =>
  assert.equal(wallInstant("2026-03-08", "02:30", "America/New_York"), null));
test("DST repeated hour blocks both occurrences", () =>
  assert.equal(
    wallInstant("2026-11-01", "01:30", "America/New_York", true) -
      wallInstant("2026-11-01", "01:30", "America/New_York"),
    3600000,
  ));
test("non-hour offset timezone supported", () =>
  assert.equal(
    new Date(wallInstant(day, "12:00", "Asia/Kathmandu")).toISOString(),
    "2026-09-07T06:15:00.000Z",
  ));
test("availability yields exact free duration", () =>
  assert.equal(slots()[0].minutes, 180));
test("appointment plus buffers split availability", () =>
  assert.deepEqual(slots({ events: [event] }).map((x) => x.minutes), [50, 50]));
test("all-day event blocks full day", () =>
  assert.equal(
    slots({
      events: [{
        ...event,
        all_day: true,
        start_date: day,
        end_date: "2026-09-08",
        start_at: null,
        end_at: null,
      }],
    }).length,
    0,
  ));
test("date-only event remains same declared dates", () =>
  assert.equal(
    eventIntervals(
      { ...event, all_day: true, start_date: day, end_date: "2026-09-08" },
      day,
      zone,
    ).length,
    1,
  ));
test("date-only event never shifts into previous day across timezones", () =>
  assert.equal(
    eventIntervals(
      { ...event, all_day: true, start_date: day, end_date: "2026-09-08" },
      "2026-09-06",
      "America/New_York",
    ).length,
    0,
  ));
test("repeat weekday matches wall-clock occurrence", () =>
  assert.equal(
    slots({
      events: [{
        ...event,
        start_at: "2026-08-31T10:00:00Z",
        end_at: "2026-08-31T11:00:00Z",
        repeat_weekdays: [1],
      }],
    }).length,
    2,
  ));
test("repeat stops at inclusive end date", () =>
  assert.equal(
    slots({
      events: [{
        ...event,
        start_at: "2026-08-31T10:00Z",
        end_at: "2026-08-31T11:00Z",
        repeat_weekdays: [1],
        repeat_until: "2026-09-06",
      }],
    })[0].minutes,
    180,
  ));
test("tomorrow appointment does not block today", () =>
  assert.equal(
    slots({
      events: [{
        ...event,
        start_at: "2026-09-08T10:00Z",
        end_at: "2026-09-08T11:00Z",
      }],
    })[0].minutes,
    180,
  ));
test("time passed excluded", () =>
  assert.equal(slots({ now: Date.parse("2026-09-07T11:00Z") })[0].minutes, 60));
test("tiny remaining gap excluded", () =>
  assert.equal(slots({ now: Date.parse("2026-09-07T11:50Z") }).length, 0));
test("no availability means no opportunity", () =>
  assert.deepEqual(slots({ settings: { ...settings, availability: [] } }), []));
test("overlapping availability merged", () =>
  assert.equal(
    slots({
      settings: {
        ...settings,
        availability: [...settings.availability, {
          weekday: 1,
          start: "19:00",
          end: "20:00",
        }],
      },
    }).length,
    1,
  ));
test("scheduled todo blocks with buffers", () =>
  assert.deepEqual(
    slots({
      todos: [{
        local_date: day,
        start_time: "19:00:00",
        end_time: "20:00:00",
        is_completed: false,
      }],
    }).map((x) => x.minutes),
    [50, 50],
  ));
test("completed todo does not block", () =>
  assert.equal(
    slots({
      todos: [{
        local_date: day,
        start_time: "19:00",
        end_time: "20:00",
        is_completed: true,
      }],
    })[0].minutes,
    180,
  ));
test("overnight todo blocks following day", () =>
  assert.equal(
    slots({
      todos: [{
        local_date: "2026-09-06",
        start_time: "23:00",
        end_time: "19:00",
        is_completed: false,
      }],
    })[0].minutes,
    110,
  ));
test("invalid availability rejected", () =>
  assert.throws(() =>
    validateSettings({
      availability: [{ weekday: 7, start: "18:00", end: "20:00" }],
    })
  ));
test("channels require explicit booleans", () =>
  assert.throws(() =>
    validateSettings({
      channels: { slack: "true", web_push: false, email: false },
    })
  ));
test("unrecognized setting fields ignored", () =>
  assert.deepEqual(
    validateSettings({ user_id: "someone", time_zone: "Asia/Tokyo" }),
    { time_zone: "Asia/Tokyo" },
  ));
test("empty career rejected", () =>
  assert.throws(() => validateCareer({ ...career, title: " " })));
test("cyclic or future skill prerequisite rejected", () =>
  assert.throws(() =>
    validateCareer({
      ...career,
      skills: [{ ...skill, prerequisites: ["s2"] }, { ...skill, id: "s2" }],
    })
  ));
test("known earlier prerequisites accepted", () =>
  assert.equal(
    validateCareer({
      ...career,
      skills: [skill, { ...skill, id: "s2", prerequisites: ["s1"] }],
    }).skills.length,
    2,
  ));
test("invalid reversed event rejected", () =>
  assert.throws(() =>
    validateEvent({ ...event, end_at: "2026-09-07T09:00Z" })
  ));
test("source todo reference retained to avoid cloning", () =>
  assert.equal(
    rankCandidates({
      career,
      todos: [{ id: "todo1", title: "existing", is_completed: false }],
    })[0].source_todo_id,
    "todo1",
  ));
test("difficult feedback reduces next task duration", () =>
  assert.equal(
    rankCandidates({
      career,
      todos: [],
      feedback: [{ skill_id: "s1", feedback: "difficult" }],
    })[0].duration_minutes,
    15,
  ));
test("known feedback excludes skill", () =>
  assert.equal(
    rankCandidates({
      career,
      todos: [],
      feedback: [{ skill_id: "s1", feedback: "known" }],
    }).length,
    0,
  ));
test("unfinished prerequisite blocks advanced task", () =>
  assert.equal(
    rankCandidates({
      career: {
        ...career,
        skills: [{ ...skill, id: "s2", prerequisites: ["s1"] }],
      },
      todos: [],
    }).length,
    0,
  ));
test("repository suggestions require evidence", () =>
  assert.equal(
    rankCandidates({
      career: { ...career, skills: [] },
      todos: [],
      repositories: [{ analysis: [{ title: "claim", evidence: [] }] }],
    }).length,
    0,
  ));
test("Edge free-only client remains byte-identical to tested server client", async () =>
  assert.equal(
    await readFile(
      new URL(
        "../../supabase/functions/_shared/coach-openrouter.mjs",
        import.meta.url,
      ),
      "utf8",
    ),
    await readFile(new URL("./openrouter.mjs", import.meta.url), "utf8"),
  ));
