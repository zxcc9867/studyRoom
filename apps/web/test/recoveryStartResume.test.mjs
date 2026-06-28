import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { shouldResumeStartAfterRecoveryUnlock } from "../src/recoveryStartResume.mjs";

test("resumes a pending start only after recovery is fully unlocked", () => {
  assert.equal(
    shouldResumeStartAfterRecoveryUnlock({
      resumeRequested: true,
      blockingRecoveryCount: 0,
      recoveryModalOpen: false,
      activeSession: false,
      busy: false,
    }),
    true,
  );
});

test("does not resume while the recovery modal or another blocker remains", () => {
  assert.equal(
    shouldResumeStartAfterRecoveryUnlock({
      resumeRequested: true,
      blockingRecoveryCount: 1,
      recoveryModalOpen: false,
      activeSession: false,
      busy: false,
    }),
    false,
  );

  assert.equal(
    shouldResumeStartAfterRecoveryUnlock({
      resumeRequested: true,
      blockingRecoveryCount: 0,
      recoveryModalOpen: true,
      activeSession: false,
      busy: false,
    }),
    false,
  );
});

test("web app stores blocked start intent and resumes through an effect", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");

  assert.match(appSource, /resumeStartAfterRecoveryUnlock/);
  assert.match(appSource, /setResumeStartAfterRecoveryUnlock\(true\)/);
  assert.match(appSource, /shouldResumeStartAfterRecoveryUnlock/);
  assert.match(appSource, /setResumeStartAfterRecoveryUnlock\(false\)/);
  assert.match(appSource, /void startTimer\(\)/);
});
