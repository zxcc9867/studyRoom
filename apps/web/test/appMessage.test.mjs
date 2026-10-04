import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { SUCCESS_MESSAGE_AUTO_DISMISS_MS, shouldAutoDismissMessage } from "../src/appMessage.mjs";
import * as appMessage from "../src/appMessage.mjs";

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

test("an existing session becomes a persistent Korean warning instead of a backend code", () => {
  const notice = appMessage.getAppMessagePresentation?.("ACTIVE_SESSION_EXISTS");
  assert.equal(notice?.tone, "warning");
  assert.equal(notice?.role, "status");
  assert.match(`${notice?.title ?? ""} ${notice?.body ?? ""}`, /진행 중인 공부/);
  assert.doesNotMatch(notice?.body ?? "", /ACTIVE_SESSION_EXISTS/);
  assert.equal(shouldAutoDismissMessage("ACTIVE_SESSION_EXISTS"), false);
});

test("Error-prefixed session codes get the same readable warning", () => {
  const notice = appMessage.getAppMessagePresentation?.("Error: ACTIVE_SESSION_EXISTS");
  assert.equal(notice?.tone, "warning");
  assert.match(notice?.body ?? "", /현재 세션/);
});

test("unknown machine codes do not leak into the user-facing alert", () => {
  const notice = appMessage.getAppMessagePresentation?.("UNEXPECTED_RPC_FAILURE");
  assert.equal(notice?.tone, "danger");
  assert.equal(notice?.role, "alert");
  assert.match(notice?.body ?? "", /다시 시도/);
  assert.doesNotMatch(notice?.body ?? "", /UNEXPECTED_RPC_FAILURE/);
});

test("uppercase codes without underscores use the safe Korean fallback", () => {
  for (const code of ["PGRST301", "UNEXPECTED", "FORBIDDEN", "Error: PGRST301"]) {
    const notice = appMessage.getAppMessagePresentation?.(code);
    assert.equal(notice?.tone, "danger", code);
    assert.equal(notice?.role, "alert", code);
    assert.match(notice?.body ?? "", /다시 시도/, code);
    assert.doesNotMatch(notice?.body ?? "", /PGRST301|UNEXPECTED|FORBIDDEN/, code);
  }
});

test("a partial success with an error is not presented as success", () => {
  const notice = appMessage.getAppMessagePresentation?.("알림 시간은 저장했습니다. Failed to send notification");
  assert.equal(notice?.tone, "danger");
  assert.match(notice?.body ?? "", /알림 시간은 저장했습니다/);
});

test("validation stays visible and success keeps its existing auto-dismiss policy", () => {
  assert.equal(appMessage.getAppMessagePresentation?.("목표 이름을 입력하세요.")?.tone, "warning");
  assert.equal(appMessage.getAppMessagePresentation?.("할 일을 저장했습니다.")?.tone, "success");
  assert.equal(shouldAutoDismissMessage("할 일을 저장했습니다."), true);
});

test("informational text is preserved without turning it into an error", () => {
  const notice = appMessage.getAppMessagePresentation?.("카메라 연결을 확인하고 있어요.");
  assert.equal(notice?.tone, "info");
  assert.equal(notice?.body, "카메라 연결을 확인하고 있어요.");
});

test("empty messages do not render an empty notification", () => {
  assert.equal(appMessage.getAppMessagePresentation?.("  "), null);
});
