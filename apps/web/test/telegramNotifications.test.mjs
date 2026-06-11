import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { isValidTelegramChatId, normalizeTelegramChatId } from "../src/telegramChatId.mjs";

test("normalizes telegram chat IDs", () => {
  assert.equal(normalizeTelegramChatId(" 123456789 "), "123456789");
  assert.equal(normalizeTelegramChatId(null), "");
});

test("validates telegram numeric chat IDs and channel handles", () => {
  assert.equal(isValidTelegramChatId("123456789"), true);
  assert.equal(isValidTelegramChatId("-1001234567890"), true);
  assert.equal(isValidTelegramChatId("@study_room_alerts"), true);
  assert.equal(isValidTelegramChatId("abc"), false);
  assert.equal(isValidTelegramChatId("@bad"), false);
});

test("web app exposes an authenticated telegram test alarm action", () => {
  const source = readFileSync("apps/web/src/telegramNotifications.mjs", "utf8");
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const functionSource = readFileSync("supabase/functions/telegram-test-alarm/index.ts", "utf8");

  assert.match(source, /export async function sendTelegramTestAlarm\(session\)/);
  assert.match(source, /\/functions\/v1\/telegram-test-alarm/);
  assert.match(source, /authorization: `Bearer \$\{session\.access_token\}`/);
  assert.match(appSource, /sendTelegramTestAlarm\(session\)/);
  assert.match(appSource, /Telegram 테스트 알림/);
  assert.match(functionSource, /admin\.auth\.getUser\(jwt\)/);
  assert.match(functionSource, /loadTelegramTarget\(admin, authResult\.userId\)/);
  assert.match(functionSource, /\.eq\("user_id", userId\)/);
});
