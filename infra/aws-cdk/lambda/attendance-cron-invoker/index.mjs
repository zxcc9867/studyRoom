const DEFAULT_USER_AGENT = "study-room-attendance-aws-scheduler";
const BODY_PREVIEW_LIMIT = 500;

export async function handler() {
  return invokeAttendanceCron({
    env: process.env,
    fetchImpl: fetch,
  });
}

export async function invokeAttendanceCron({ env, fetchImpl, now = new Date() }) {
  const attendanceCronUrl = requiredEnv(env, "ATTENDANCE_CRON_URL");
  const cronSecret = requiredEnv(env, "CRON_SECRET");
  const userAgent = env.USER_AGENT || DEFAULT_USER_AGENT;

  const response = await fetchImpl(attendanceCronUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-cron-secret": cronSecret,
      "user-agent": userAgent,
    },
    body: JSON.stringify({
      source: "aws-eventbridge",
      triggeredAt: now.toISOString(),
    }),
  });

  const body = await response.text();
  const bodyPreview = body.slice(0, BODY_PREVIEW_LIMIT);

  if (!response.ok) {
    throw new Error(`attendance-cron failed with status ${response.status}: ${bodyPreview}`);
  }

  return {
    ok: true,
    status: response.status,
    bodyPreview,
  };
}

function requiredEnv(env, name) {
  const value = env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}
