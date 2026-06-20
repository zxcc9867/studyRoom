import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { SUCCESS_MESSAGE_AUTO_DISMISS_MS, shouldAutoDismissMessage } from "../src/appMessage.mjs";

const mainSource = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");

test("auto-dismisses success messages after a short delay", () => {
  assert.equal(shouldAutoDismissMessage("목표를 만들었습니다."), true);
  assert.equal(shouldAutoDismissMessage("할 일을 수정했습니다."), true);
  assert.equal(SUCCESS_MESSAGE_AUTO_DISMISS_MS, 5000);
});

test("keeps validation and error messages visible", () => {
  assert.equal(shouldAutoDismissMessage("목표 이름을 입력하세요."), false);
  assert.equal(shouldAutoDismissMessage("Slack Channel ID 형식을 확인하세요."), false);
  assert.equal(shouldAutoDismissMessage("알림 시간은 저장했습니다. Failed to send notification"), false);
});

test("web app clears auto-dismissable status messages with cleanup", () => {
  assert.match(mainSource, /shouldAutoDismissMessage\(message\)/);
  assert.match(mainSource, /window\.setTimeout\(\(\) => setMessage\(""\), SUCCESS_MESSAGE_AUTO_DISMISS_MS\)/);
  assert.match(mainSource, /window\.clearTimeout\(timeoutId\)/);
});
