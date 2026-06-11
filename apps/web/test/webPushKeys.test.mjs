import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applicationServerKeyMatches,
  normalizeBase64Url,
  uint8ArrayToBase64Url,
} from "../src/webPushKeys.mjs";

test("normalizes base64url values by removing padding and whitespace", () => {
  assert.equal(normalizeBase64Url(" abc-_== \n"), "abc-_");
});

test("converts application server key bytes to base64url", () => {
  assert.equal(uint8ArrayToBase64Url(Uint8Array.from([251, 255, 254])), "-__-");
});

test("detects whether an existing push subscription uses the current VAPID public key", () => {
  const currentKey = Uint8Array.from([4, 1, 2, 3]);
  const subscription = {
    options: {
      applicationServerKey: currentKey.buffer,
    },
  };

  assert.equal(applicationServerKeyMatches(subscription, "BAECAw"), true);
  assert.equal(applicationServerKeyMatches(subscription, "BAECAA"), false);
});

test("treats subscriptions without applicationServerKey as mismatched", () => {
  assert.equal(applicationServerKeyMatches({ options: {} }, "BAECAw"), false);
  assert.equal(applicationServerKeyMatches(null, "BAECAw"), false);
});
