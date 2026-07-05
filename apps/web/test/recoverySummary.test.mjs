import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyRecoveryReason,
  getPreviousRecoveryWeekRange,
  getRecoveryTriggerLabel,
  getRecoveryWeekRange,
  paginateRecoveryHistory,
  summarizeRecoveryRequests,
} from "../src/recoverySummary.mjs";

function recovery(overrides) {
  return {
    id: "recovery-id",
    local_date: "2026-06-24",
    trigger_type: "missed_attendance",
    status: "submitted",
    reason: "알림을 봤지만 늦잠을 잤습니다.",
    makeup_todo_title: "MOS 1시간 보충",
    pledge_todo_title: "내일은 알림 전에 입장",
    created_at: "2026-06-24T00:00:00.000Z",
    ...overrides,
  };
}

test("classifies recovery reasons with deterministic keyword rules", () => {
  assert.equal(classifyRecoveryReason(recovery({ reason: "늦잠 때문에 실패" })).label, "수면/피로");
  assert.equal(classifyRecoveryReason(recovery({ reason: "회사 야근으로 늦었습니다" })).label, "업무/일정");
  assert.equal(
    classifyRecoveryReason(recovery({ trigger_type: "camera_absence_repeat", reason: "카메라 밖으로 나갔습니다", makeup_todo_title: null, pledge_todo_title: null })).label,
    "환경/자리 비움",
  );
  assert.equal(classifyRecoveryReason(recovery({ reason: "특별한 이유 없음", makeup_todo_title: null, pledge_todo_title: null })).label, "기타");
});

test("recovery week range uses Monday through Sunday", () => {
  assert.deepEqual(getRecoveryWeekRange("2026-06-24"), {
    weekStart: "2026-06-22",
    weekEnd: "2026-06-28",
  });
  assert.deepEqual(getPreviousRecoveryWeekRange("2026-06-29"), {
    weekStart: "2026-06-22",
    weekEnd: "2026-06-28",
  });
});

test("summarizes only the selected week and exposes the top cause", () => {
  const summary = summarizeRecoveryRequests(
    [
      recovery({ id: "sleep-1", local_date: "2026-06-23", reason: "늦잠" }),
      recovery({ id: "sleep-2", local_date: "2026-06-24", reason: "피로" }),
      recovery({
        id: "camera-1",
        local_date: "2026-06-25",
        trigger_type: "camera_absence_repeat",
        status: "pending",
        reason: "카메라 밖으로 나갔습니다.",
      }),
      recovery({ id: "previous-week", local_date: "2026-06-18", reason: "회사 회의" }),
    ],
    "2026-06-26",
  );

  assert.equal(summary.totalCount, 3);
  assert.equal(summary.submittedCount, 2);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.missedCount, 2);
  assert.equal(summary.cameraCount, 1);
  assert.equal(summary.topCategory?.label, "수면/피로");
  assert.match(summary.nextAction, /알림 10분 전/);
  assert.deepEqual(
    summary.requests.map((item) => item.id),
    ["camera-1", "sleep-2", "sleep-1"],
  );
});

test("trigger labels stay readable for history UI", () => {
  assert.equal(getRecoveryTriggerLabel("missed_attendance"), "결석/지각");
  assert.equal(getRecoveryTriggerLabel("camera_absence_repeat"), "자리 비움 반복");
  assert.equal(getRecoveryTriggerLabel("other"), "회복루틴");
});

test("recovery history pagination returns five items per page", () => {
  const items = Array.from({ length: 13 }, (_, index) =>
    recovery({
      id: `recovery-${index + 1}`,
      local_date: "2026-06-24",
      created_at: `2026-06-24T00:${String(index).padStart(2, "0")}:00.000Z`,
    }),
  );

  const pageOne = paginateRecoveryHistory(items, 1);
  const pageThree = paginateRecoveryHistory(items, 3);
  const pageTooHigh = paginateRecoveryHistory(items, 99);

  assert.equal(pageOne.items.length, 5);
  assert.equal(pageOne.currentPage, 1);
  assert.equal(pageOne.totalPages, 3);
  assert.equal(pageOne.hasPrevious, false);
  assert.equal(pageOne.hasNext, true);
  assert.equal(pageThree.items.length, 3);
  assert.equal(pageThree.hasNext, false);
  assert.equal(pageTooHigh.currentPage, 3);
});
