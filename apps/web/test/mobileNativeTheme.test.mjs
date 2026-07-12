import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const mobileSource = readFileSync("apps/mobile/App.tsx", "utf8");
const appConfig = JSON.parse(readFileSync("apps/mobile/app.json", "utf8"));

test("Expo mobile UI uses the same light forest palette as the web dashboard", () => {
  assert.match(mobileSource, /const mobilePalette =/);
  for (const color of ["#d9f0e3", "#fff9df", "#fff6c7", "#2f6b52", "#4f916f", "#f0c85c"]) {
    assert.match(mobileSource, new RegExp(color, "i"));
  }
  assert.doesNotMatch(mobileSource, /#f8f4ea|#1d1a16/i);
  assert.match(mobileSource, /<StatusBar[^>]*barStyle="dark-content"/);
  assert.equal(appConfig.expo.userInterfaceStyle, "light");
  assert.equal(appConfig.expo.android.adaptiveIcon.backgroundColor, "#d9f0e3");
});
