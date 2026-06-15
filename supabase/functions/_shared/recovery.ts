export type RecoveryTriggerType = "missed_attendance" | "camera_absence_repeat";

export type RecoveryRequestRow = {
  id: string;
  user_id: string;
  local_date: string;
  trigger_type: RecoveryTriggerType;
  status: "pending" | "submitted";
  slack_channel_id: string | null;
  slack_message_ts: string | null;
  followup_sent_at: string | null;
  created_at: string;
};

export type SlackTargetRow = {
  id: string;
  user_id: string;
  destination: string | null;
};

type AdminClient = {
  from: (table: string) => any;
};

const recoverySelect =
  "id,user_id,local_date,trigger_type,status,slack_channel_id,slack_message_ts,followup_sent_at,created_at";

export async function createRecoveryRequest(
  admin: AdminClient,
  input: {
    userId: string;
    localDate: string;
    triggerType: RecoveryTriggerType;
  },
) {
  const existing = await loadPendingRecoveryRequest(admin, input);
  if (existing) {
    return { request: existing, created: false };
  }

  const { data, error } = await admin
    .from("study_recovery_requests")
    .insert({
      user_id: input.userId,
      local_date: input.localDate,
      trigger_type: input.triggerType,
      status: "pending",
    })
    .select(recoverySelect)
    .single();

  if (error) {
    const retry = await loadPendingRecoveryRequest(admin, input);
    if (retry) {
      return { request: retry, created: false };
    }
    throw error;
  }

  return { request: data as RecoveryRequestRow, created: true };
}

export async function loadSlackTarget(admin: AdminClient, userId: string) {
  const { data, error } = await admin
    .from("notification_targets")
    .select("id,user_id,destination")
    .eq("kind", "slack")
    .eq("enabled", true)
    .eq("user_id", userId)
    .not("destination", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return ((data ?? []) as SlackTargetRow[]).find((target) => target.destination?.trim()) ?? null;
}

export async function sendRecoveryRequestSlackMessage(
  admin: AdminClient,
  target: SlackTargetRow,
  request: RecoveryRequestRow,
  options: { followup?: boolean } = {},
) {
  if (!target.destination) {
    throw new Error("Slack channel ID is missing");
  }

  const appUrl = Deno.env.get("APP_ORIGIN") ?? "https://study-room-attendance.vercel.app";
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getSlackBotToken()}`,
    },
    body: JSON.stringify({
      channel: target.destination,
      text: buildRecoveryFallbackText(request, appUrl, options),
      blocks: buildRecoveryBlocks(request, appUrl, options),
      unfurl_links: false,
      unfurl_media: false,
    }),
  });

  if (!response.ok) {
    const errorMessage = `Slack recovery message failed: ${response.status} ${await response.text()}`;
    await recordRecoveryDelivery(admin, target, request.local_date, "failed", errorMessage);
    throw new Error(errorMessage);
  }

  const result = (await response.json().catch(() => null)) as {
    ok?: boolean;
    ts?: string;
    error?: string;
  } | null;
  if (!result?.ok) {
    const errorMessage = `Slack recovery message returned unexpected result: ${JSON.stringify(result)}`;
    await recordRecoveryDelivery(admin, target, request.local_date, "failed", errorMessage);
    throw new Error(errorMessage);
  }

  const updatePayload: Record<string, string | null> = {
    slack_channel_id: target.destination,
    slack_message_ts: result.ts ?? null,
  };
  if (options.followup) {
    updatePayload.followup_sent_at = new Date().toISOString();
  }

  await admin.from("study_recovery_requests").update(updatePayload).eq("id", request.id);
  await recordRecoveryDelivery(admin, target, request.local_date, "sent", null);

  return {
    ok: true,
    recoveryRequestId: request.id,
    messageTs: result.ts ?? null,
    followup: Boolean(options.followup),
  };
}

export async function sendPendingRecoveryFollowups(admin: AdminClient, nowIso: string) {
  const cutoff = new Date(Date.parse(nowIso) - 30 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("study_recovery_requests")
    .select(recoverySelect)
    .eq("status", "pending")
    .is("followup_sent_at", null)
    .lte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    throw error;
  }

  const results = [];
  for (const request of (data ?? []) as RecoveryRequestRow[]) {
    const target = await loadSlackTarget(admin, request.user_id);
    if (!target?.destination) {
      await admin
        .from("study_recovery_requests")
        .update({ followup_sent_at: new Date().toISOString() })
        .eq("id", request.id);
      results.push({ ok: true, recoveryRequestId: request.id, slackMissing: true, followup: true });
      continue;
    }

    try {
      results.push(await sendRecoveryRequestSlackMessage(admin, target, request, { followup: true }));
    } catch (error) {
      await admin
        .from("study_recovery_requests")
        .update({ followup_sent_at: new Date().toISOString() })
        .eq("id", request.id);
      results.push({
        ok: false,
        recoveryRequestId: request.id,
        followup: true,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

async function loadPendingRecoveryRequest(
  admin: AdminClient,
  input: {
    userId: string;
    localDate: string;
    triggerType: RecoveryTriggerType;
  },
) {
  const { data, error } = await admin
    .from("study_recovery_requests")
    .select(recoverySelect)
    .eq("user_id", input.userId)
    .eq("local_date", input.localDate)
    .eq("trigger_type", input.triggerType)
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as RecoveryRequestRow | null) ?? null;
}

async function recordRecoveryDelivery(
  admin: AdminClient,
  target: SlackTargetRow,
  localDate: string,
  status: "sent" | "failed",
  errorMessage: string | null,
) {
  await admin.from("notification_deliveries").insert({
    user_id: target.user_id,
    target_id: target.id,
    local_date: localDate,
    channel: "slack",
    status,
    error_message: errorMessage,
  });
}

function buildRecoveryBlocks(
  request: RecoveryRequestRow,
  appUrl: string,
  options: { followup?: boolean },
) {
  const title = options.followup
    ? "⏳ 회복 루틴이 아직 제출되지 않았습니다."
    : request.trigger_type === "missed_attendance"
      ? "🚨 오늘 출석 실패"
      : "📷 자리 비움 반복 감지";
  const detail = options.followup
    ? "사유와 보충 계획을 제출해야 다음 공부 세션을 시작할 수 있습니다."
    : request.trigger_type === "missed_attendance"
      ? "사유와 보충 계획을 제출해야 다음 공부 세션을 시작할 수 있습니다."
      : "오늘 카메라 자리 비움 경고가 2회 발생했습니다. 회복 루틴을 작성해야 다음 세션을 시작할 수 있습니다.";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${title}*\n${detail}`,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*날짜*\n${request.local_date}` },
        { type: "mrkdwn", text: `*상태*\n회복 루틴 필요` },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "회복 루틴 작성", emoji: true },
          style: "danger",
          action_id: "open_recovery_routine",
          value: request.id,
        },
      ],
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `앱: ${appUrl}` }],
    },
  ];
}

function buildRecoveryFallbackText(
  request: RecoveryRequestRow,
  appUrl: string,
  options: { followup?: boolean },
) {
  const title = options.followup
    ? "⏳ 회복 루틴이 아직 제출되지 않았습니다."
    : request.trigger_type === "missed_attendance"
      ? "🚨 오늘 출석 실패"
      : "📷 자리 비움 반복 감지";
  return [
    `*${title}*`,
    "사유와 보충 계획을 제출해야 다음 공부 세션을 시작할 수 있습니다.",
    "버튼: 회복 루틴 작성",
    appUrl,
  ].join("\n");
}

function getSlackBotToken() {
  const value = Deno.env.get("SLACK_BOT_TOKEN") ?? Deno.env.get("STUDY_ALERT_SLACK_BOT_TOKEN");
  if (!value) {
    throw new Error("SLACK_BOT_TOKEN or STUDY_ALERT_SLACK_BOT_TOKEN is required");
  }
  return value;
}
