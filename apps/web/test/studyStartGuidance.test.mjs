import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("start guidance is shown only while the topbar is an inactive-session start action", () => {
  const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
  const weeklyPanel = readFileSync(new URL("../src/WeeklyHabitRhythmPanel.tsx", import.meta.url), "utf8");
  const dailyPrd = readFileSync(new URL("../../../memory-bank/prd-daily-habit-loop.md", import.meta.url), "utf8");
  const weeklyGoalPrd = readFileSync(
    new URL("../../../memory-bank/prd-flexible-weekly-start-goal.md", import.meta.url),
    "utf8",
  );
  const singleStartPrd = readFileSync(
    new URL("../../../memory-bank/prd-single-start-action.md", import.meta.url),
    "utf8",
  );

  assert.match(main, /\{latestNextAction && !activeSession && \(/);
  assert.match(weeklyPanel, /\{rhythm\.primaryActionLabel && inactiveSession && \(/);
  assert.match(main, /!activeSession \? studyStartAction\.label : activeSessionPaused \? "공부 계속하기" : "잠시 쉬기"/);
  assert.doesNotMatch(dailyPrd, /진행 중인 세션이 있으면 이어하기 버튼을 비활성화한다/);
  assert.doesNotMatch(weeklyGoalPrd, /활성 세션 중이면 CTA를 비활성화하고/);
  assert.match(weeklyGoalPrd, /최상단 단일 시작 액션/);
  assert.match(singleStartPrd, /start-only guidance is hidden while a session is active or paused/i);
});
