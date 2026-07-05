import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildNotificationDiagnostics,
  formatDiagnosticTime,
  normalizeNotificationDeliveries,
} from "../src/notificationDiagnostics.mjs";

test("normalizes recent notification delivery rows for diagnostics", () => {
  const rows = normalizeNotificationDeliveries([
    {
      channel: "slack",
      status: "sent",
      error_message: null,
      created_at: "2026-07-05T09:00:00.000Z",
    },
    {
      channel: "email",
      status: "failed",
      error_message: "RESEND_API_KEY is required",
      created_at: "2026-07-05T08:59:00.000Z",
    },
    {
      channel: "telegram",
      status: "sent",
      created_at: "2026-07-05T08:58:00.000Z",
    },
  ]);

  assert.deepEqual(rows, [
    {
      channel: "slack",
      status: "sent",
      errorMessage: "",
      createdAt: "2026-07-05T09:00:00.000Z",
      legacy: false,
    },
    {
      channel: "email",
      status: "failed",
      errorMessage: "RESEND_API_KEY is required",
      createdAt: "2026-07-05T08:59:00.000Z",
      legacy: false,
    },
    {
      channel: "telegram",
      status: "sent",
      errorMessage: "",
      createdAt: "2026-07-05T08:58:00.000Z",
      legacy: true,
    },
  ]);
});

test("builds concise notification diagnostic cards", () => {
  const diagnostics = buildNotificationDiagnostics({
    webPushStatus: { supported: true, permission: "granted", subscribed: true },
    slackStatus: { connected: true, channelId: "C0BAFS1CSV8", updatedAt: "2026-07-05T08:00:00.000Z" },
    deliveries: normalizeNotificationDeliveries([
      {
        channel: "slack",
        status: "sent",
        error_message: null,
        created_at: "2026-07-05T09:00:00.000Z",
      },
    ]),
  });

  assert.deepEqual(
    diagnostics.map((item) => [item.id, item.state]),
    [
      ["browser", "ready"],
      ["slack", "ready"],
      ["last-delivery", "ready"],
      ["legacy", "info"],
    ],
  );
  assert.match(diagnostics[2].detail, /slack/);
  assert.match(diagnostics[3].detail, /Telegram/);
});

test("formats diagnostic timestamps in Korean locale", () => {
  assert.equal(formatDiagnosticTime(null), "기록 없음");
  assert.match(formatDiagnosticTime("2026-07-05T09:00:00.000Z"), /2026/);
});
