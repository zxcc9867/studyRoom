import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type SlackPayload = {
  type: string;
  trigger_id?: string;
  user?: { id?: string };
  actions?: Array<{ action_id?: string; value?: string }>;
  view?: {
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
    return await handleRecoveryButton(admin, payload);
  }

  if (payload.type === "view_submission") {
    return await handleRecoverySubmission(admin, payload);
  }

  return json({ ok: true });
});

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
