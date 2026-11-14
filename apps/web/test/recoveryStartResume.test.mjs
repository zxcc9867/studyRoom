import assert from "node:assert/strict";
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
