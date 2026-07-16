import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type SlackPayload = {
  type: string;
  trigger_id?: string;
  user?: { id?: string };
  channel?: { id?: string };
  actions?: Array<{ action_id?: string; value?: string }>;
  view?: {
    callback_id?: string;
    private_metadata?: string;
    state?: {
      values?: Record<string, Record<string, { value?: string }>>;
    };
  };
};

type RecoveryRequest = {
  id: string;
  user_id: string;
  local_date: string;
  trigger_type: string;
  status: "pending" | "submitted";
};

type StudyTodoRow = {
  id: string;
  local_date: string;
};

const jsonHeaders = { "content-type": "application/json" };
const supportedScheduleExtensionActionIds = new Set(["extend_schedule_5", "extend_schedule_10", "extend_schedule_custom"]);
const supportedSessionLeaseExtensionActionIds = new Set(["extend_session_lease_60"]);
const modalFieldLimits = {
  reason: 400,
  makeup_todo_title: 120,
  pledge_todo_title: 120,
};

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const rawBody = await request.text();
  if (!(await verifySlackSignature(rawBody, request))) {
    return json({ error: "Invalid Slack signature" }, 401);
  }

  const payload = parseSlackPayload(rawBody);
  if (!payload) {
    return json({ error: "Invalid Slack payload" }, 400);
  }

  const admin = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (payload.type === "block_actions") {
    if (hasSessionLeaseExtensionAction(payload)) {
      return await handleSessionLeaseExtensionAction(admin, payload);
    }
    if (hasScheduleExtensionAction(payload)) {
      return await handleScheduleExtensionAction(admin, payload);
    }
    return await handleRecoveryButton(admin, payload);
  }

  if (payload.type === "view_submission") {
    if (payload.view?.callback_id === "study_schedule_extension") {
      return await handleScheduleExtensionSubmission(admin, payload);
    }
    return await handleRecoverySubmission(admin, payload);
  }

  return json({ ok: true });
});

function hasSessionLeaseExtensionAction(payload: SlackPayload) {
  return payload.actions?.some((item) => item.action_id && supportedSessionLeaseExtensionActionIds.has(item.action_id)) ?? false;
}

async function handleSessionLeaseExtensionAction(admin: ReturnType<typeof createClient>, payload: SlackPayload) {
  const action = payload.actions?.find((item) => item.action_id && supportedSessionLeaseExtensionActionIds.has(item.action_id));
  const parsed = parseSessionLeaseExtensionValue(action?.value ?? "");
  if (!action?.action_id || !parsed) {
    return json({ error: "Invalid session lease extension action" }, 400);
  }

  const { data, error } = await admin.rpc("extend_study_session_lease", {
    p_session_id: parsed.sessionId,
    p_extension_minutes: parsed.minutes,
  });

  if (error) {
    await postEphemeralIfPossible(
      payload.channel?.id ?? null,
      payload.user?.id ?? null,
      `세션 연장에 실패했습니다: ${error.message}`,
    );
    return json({ error: error.message }, 500);
  }

  const updatedSession = data as { lease_expires_at?: string | null } | null;
  const deadlineText = updatedSession?.lease_expires_at ? ` 새 종료 예정: ${formatDateTime(updatedSession.lease_expires_at)}` : "";
  await postEphemeralIfPossible(
    payload.channel?.id ?? null,
    payload.user?.id ?? null,
    `세션 유지 시간을 연장했습니다. 남은 시간은 최대 2시간입니다.${deadlineText}`,
  );
  return json({ ok: true, sessionId: parsed.sessionId, extendedMinutes: parsed.minutes });
}

function parseSessionLeaseExtensionValue(value: string) {
  const [kind, sessionId, minutesText] = value.split("|");
  const minutes = Number(minutesText);
  if (kind !== "session_lease_extension" || !isUuid(sessionId) || minutes !== 60) {
    return null;
  }
  return { sessionId, minutes };
}
function hasScheduleExtensionAction(payload: SlackPayload) {
  return payload.actions?.some((item) => item.action_id && supportedScheduleExtensionActionIds.has(item.action_id)) ?? false;
}

async function handleScheduleExtensionAction(admin: ReturnType<typeof createClient>, payload: SlackPayload) {
  const action = payload.actions?.find((item) => item.action_id && supportedScheduleExtensionActionIds.has(item.action_id));
  const parsed = parseScheduleExtensionValue(action?.value ?? "");
  if (!action?.action_id || !parsed) {
    return json({ error: "Invalid schedule extension action" }, 400);
  }

  if (action.action_id === "extend_schedule_custom" || parsed.minutes === "custom") {
    const triggerId = payload.trigger_id ?? "";
    if (!triggerId) {
      return json({ error: "Missing Slack trigger" }, 400);
    }

    await openScheduleExtensionModal(triggerId, {
      todoId: parsed.todoId,
      channelId: payload.channel?.id ?? null,
      userId: payload.user?.id ?? null,
    });
    return json({ ok: true });
  }

  const updatedCount = await extendSchedule(admin, parsed.todoId, parsed.minutes);
  await postEphemeralIfPossible(
    payload.channel?.id ?? null,
    payload.user?.id ?? null,
    `일정을 ${parsed.minutes}분 연장했습니다. 뒤쪽 미완료 일정 ${Math.max(0, updatedCount - 1)}개도 같이 이동했습니다.`,
  );
  return json({ ok: true, updatedCount });
}

async function handleScheduleExtensionSubmission(admin: ReturnType<typeof createClient>, payload: SlackPayload) {
  const metadata = parseScheduleExtensionMetadata(payload.view?.private_metadata ?? "");
  if (!metadata || !isUuid(metadata.todoId)) {
    return slackErrors({ extension_minutes: "연장할 일정을 찾을 수 없습니다." });
  }

  const minutesValue = readModalValue(payload.view?.state?.values ?? {}, "extension_minutes", "extension_minutes");
  const minutes = Number(minutesValue);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) {
    return slackErrors({ extension_minutes: "1분부터 120분 사이의 숫자를 입력해주세요." });
  }

  try {
    const updatedCount = await extendSchedule(admin, metadata.todoId, minutes);
    await postEphemeralIfPossible(
      metadata.channelId,
      metadata.userId,
      `일정을 ${minutes}분 연장했습니다. 뒤쪽 미완료 일정 ${Math.max(0, updatedCount - 1)}개도 같이 이동했습니다.`,
    );
    return json({ response_action: "clear" });
  } catch (error) {
    return slackErrors({ extension_minutes: error instanceof Error ? error.message : String(error) });
  }
}

async function extendSchedule(admin: ReturnType<typeof createClient>, todoId: string, minutes: number) {
  const { data, error } = await admin.rpc("extend_todo_schedule", {
    p_todo_id: todoId,
    p_extension_minutes: minutes,
  });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data.length : 0;
}

async function openScheduleExtensionModal(
  triggerId: string,
  metadata: { todoId: string; channelId: string | null; userId: string | null },
) {
  const response = await fetch("https://slack.com/api/views.open", {
    method: "POST",
    headers: {
      ...jsonHeaders,
      authorization: `Bearer ${getSlackBotToken()}`,
    },
    body: JSON.stringify({
      trigger_id: triggerId,
      view: {
        type: "modal",
        callback_id: "study_schedule_extension",
        private_metadata: JSON.stringify(metadata),
        title: { type: "plain_text", text: "일정 연장", emoji: true },
        submit: { type: "plain_text", text: "연장", emoji: true },
        close: { type: "plain_text", text: "취소", emoji: true },
        blocks: [
          {
            type: "input",
            block_id: "extension_minutes",
            label: { type: "plain_text", text: "몇 분 연장할까요?", emoji: true },
            element: {
              type: "plain_text_input",
              action_id: "extension_minutes",
              placeholder: { type: "plain_text", text: "예: 15", emoji: true },
              max_length: 3,
            },
          },
        ],
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack views.open failed: ${response.status} ${await response.text()}`);
  }

  const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    throw new Error(`Slack views.open returned unexpected result: ${JSON.stringify(result)}`);
  }
}

async function postEphemeralIfPossible(channelId: string | null, userId: string | null, text: string) {
  if (!channelId || !userId) {
    return;
  }

  const response = await fetch("https://slack.com/api/chat.postEphemeral", {
    method: "POST",
    headers: {
      ...jsonHeaders,
      authorization: `Bearer ${getSlackBotToken()}`,
    },
    body: JSON.stringify({ channel: channelId, user: userId, text }),
  });

  if (!response.ok) {
    throw new Error(`Slack postEphemeral failed: ${response.status} ${await response.text()}`);
  }

  const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    throw new Error(`Slack postEphemeral returned unexpected result: ${JSON.stringify(result)}`);
  }
}

function parseScheduleExtensionValue(value: string) {
  const [kind, todoId, minutesText] = value.split("|");
  if (kind !== "schedule_extension" || !isUuid(todoId)) {
    return null;
  }

  if (minutesText === "custom") {
    return { todoId, minutes: "custom" as const };
  }

  const minutes = Number(minutesText);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) {
    return null;
  }

  return { todoId, minutes };
}

function parseScheduleExtensionMetadata(value: string) {
  try {
    const parsed = JSON.parse(value) as Partial<{ todoId: string; channelId: string | null; userId: string | null }>;
    if (typeof parsed.todoId !== "string") {
      return null;
    }
    return {
      todoId: parsed.todoId,
      channelId: typeof parsed.channelId === "string" ? parsed.channelId : null,
      userId: typeof parsed.userId === "string" ? parsed.userId : null,
    };
  } catch {
    return null;
  }
}
async function handleRecoveryButton(admin: ReturnType<typeof createClient>, payload: SlackPayload) {
  const action = payload.actions?.find((item) => item.action_id === "open_recovery_routine");
  const requestId = action?.value ?? "";
  const triggerId = payload.trigger_id ?? "";

  if (!requestId || !triggerId) {
    return json({ error: "Missing recovery request or Slack trigger" }, 400);
  }

  const recoveryRequest = await loadRecoveryRequest(admin, requestId);
  if (!recoveryRequest) {
    return json({ error: "Recovery request was not found" }, 404);
  }

  await openRecoveryModal(triggerId, recoveryRequest);
  return json({ ok: true });
}

async function handleRecoverySubmission(admin: ReturnType<typeof createClient>, payload: SlackPayload) {
  const requestId = payload.view?.private_metadata ?? "";
  const recoveryRequest = await loadRecoveryRequest(admin, requestId);
  if (!recoveryRequest) {
    return slackErrors({ reason: "회복 요청을 찾을 수 없습니다. 앱에서 상태를 새로고침해주세요." });
  }

  if (recoveryRequest.status !== "pending") {
    return json({ response_action: "clear" });
  }

  const values = payload.view?.state?.values ?? {};
  const reason = readModalValue(values, "reason", "reason");
  const makeupTodoTitle = readModalValue(values, "makeup_todo_title", "makeup_todo_title");
  const pledgeTodoTitle = readModalValue(values, "pledge_todo_title", "pledge_todo_title");
  const errors: Record<string, string> = {};

  validateRequiredField(errors, "reason", reason, modalFieldLimits.reason, "결석/이탈 사유를 입력해주세요.");
  validateRequiredField(
    errors,
    "makeup_todo_title",
    makeupTodoTitle,
    modalFieldLimits.makeup_todo_title,
    "오늘 보충 과제를 입력해주세요.",
  );
  validateRequiredField(
    errors,
    "pledge_todo_title",
    pledgeTodoTitle,
    modalFieldLimits.pledge_todo_title,
    "내일 재도전 약속을 입력해주세요.",
  );

  if (Object.keys(errors).length > 0) {
    return slackErrors(errors);
  }

  const makeupTodo = await createTodo(admin, {
    userId: recoveryRequest.user_id,
    localDate: recoveryRequest.local_date,
    title: makeupTodoTitle,
    position: 0,
  });

  const { error } = await admin
    .from("study_recovery_requests")
    .update({
      status: "submitted",
      reason,
      makeup_todo_title: makeupTodoTitle,
      pledge_todo_title: pledgeTodoTitle,
      makeup_todo_id: makeupTodo.id,
      pledge_todo_id: null,
      slack_submitter_id: payload.user?.id ?? null,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", recoveryRequest.id);

  if (error) {
    return slackErrors({ reason: error.message });
  }

  return json({ response_action: "clear" });
}

async function loadRecoveryRequest(admin: ReturnType<typeof createClient>, requestId: string) {
  if (!isUuid(requestId)) {
    return null;
  }

  const { data, error } = await admin
    .from("study_recovery_requests")
    .select("id,user_id,local_date,trigger_type,status")
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as RecoveryRequest | null) ?? null;
}

async function createTodo(
  admin: ReturnType<typeof createClient>,
  input: { userId: string; localDate: string; title: string; position: number },
) {
  const { data, error } = await admin
    .from("study_todos")
    .insert({
      user_id: input.userId,
      local_date: input.localDate,
      title: input.title,
      position: input.position,
    })
    .select("id,local_date")
    .single();

  if (error) {
    throw error;
  }

  return data as StudyTodoRow;
}

async function openRecoveryModal(triggerId: string, recoveryRequest: RecoveryRequest) {
  const response = await fetch("https://slack.com/api/views.open", {
    method: "POST",
    headers: {
      ...jsonHeaders,
      authorization: `Bearer ${getSlackBotToken()}`,
    },
    body: JSON.stringify({
      trigger_id: triggerId,
      view: {
        type: "modal",
        callback_id: "study_recovery_routine",
        private_metadata: recoveryRequest.id,
        title: { type: "plain_text", text: "회복 루틴", emoji: true },
        submit: { type: "plain_text", text: "제출", emoji: true },
        close: { type: "plain_text", text: "취소", emoji: true },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text:
                recoveryRequest.trigger_type === "missed_attendance"
                  ? "*오늘 출석 실패* 사유와 보충 계획을 작성해주세요."
                  : "*자리 비움 반복 감지* 사유와 보충 계획을 작성해주세요.",
            },
          },
          {
            type: "input",
            block_id: "reason",
            label: { type: "plain_text", text: "결석/이탈 사유", emoji: true },
            element: {
              type: "plain_text_input",
              action_id: "reason",
              multiline: true,
              max_length: modalFieldLimits.reason,
            },
          },
          {
            type: "input",
            block_id: "makeup_todo_title",
            label: { type: "plain_text", text: "오늘 보충 과제", emoji: true },
            element: {
              type: "plain_text_input",
              action_id: "makeup_todo_title",
              max_length: modalFieldLimits.makeup_todo_title,
            },
          },
          {
            type: "input",
            block_id: "pledge_todo_title",
            label: { type: "plain_text", text: "내일 재도전 약속", emoji: true },
            element: {
              type: "plain_text_input",
              action_id: "pledge_todo_title",
              max_length: modalFieldLimits.pledge_todo_title,
            },
          },
        ],
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack views.open failed: ${response.status} ${await response.text()}`);
  }

  const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    throw new Error(`Slack views.open returned unexpected result: ${JSON.stringify(result)}`);
  }
}

async function verifySlackSignature(rawBody: string, request: Request) {
  const signingSecret = requiredEnv("SLACK_SIGNING_SECRET");
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const receivedSignature = request.headers.get("x-slack-signature") ?? "";
  const requestTime = Number(timestamp);

  if (!Number.isFinite(requestTime) || Math.abs(Date.now() / 1000 - requestTime) > 60 * 5) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(`v0:${timestamp}:${rawBody}`));
  const expectedSignature = `v0=${bytesToHex(new Uint8Array(signatureBytes))}`;

  return timingSafeEqual(receivedSignature, expectedSignature);
}

function parseSlackPayload(rawBody: string) {
  const payloadText = new URLSearchParams(rawBody).get("payload");
  if (!payloadText) {
    return null;
  }

  try {
    return JSON.parse(payloadText) as SlackPayload;
  } catch {
    return null;
  }
}

function readModalValue(
  values: Record<string, Record<string, { value?: string }>>,
  blockId: string,
  actionId: string,
) {
  return values[blockId]?.[actionId]?.value?.trim() ?? "";
}

function validateRequiredField(
  errors: Record<string, string>,
  field: keyof typeof modalFieldLimits,
  value: string,
  maxLength: number,
  emptyMessage: string,
) {
  if (!value) {
    errors[field] = emptyMessage;
  } else if (value.length > maxLength) {
    errors[field] = `${maxLength}자 이하로 입력해주세요.`;
  }
}

function slackErrors(errors: Record<string, string>) {
  return json({ response_action: "errors", errors });
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }
  return diff === 0;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function getSlackBotToken() {
  const value = Deno.env.get("SLACK_BOT_TOKEN") ?? Deno.env.get("STUDY_ALERT_SLACK_BOT_TOKEN");
  if (!value) {
    throw new Error("SLACK_BOT_TOKEN or STUDY_ALERT_SLACK_BOT_TOKEN is required");
  }
  return value;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
