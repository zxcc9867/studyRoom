import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("settings screen exposes an editable saved alarm card", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");

  assert.match(appSource, /alarmEditing/);
  assert.match(appSource, /saveAlarmSettings/);
  assert.match(appSource, /alarm-summary-card/);
  assert.match(appSource, /설정된 알람/);
  assert.match(appSource, /알람 편집/);
  assert.match(appSource, /알람 저장/);
  assert.match(appSource, /취소/);
});
