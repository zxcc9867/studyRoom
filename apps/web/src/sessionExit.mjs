export function requestEndStudySessionOnExit({
  supabaseUrl,
  anonKey,
  accessToken,
  sessionId,
  excludedSeconds = 0,
  fetch = globalThis.fetch?.bind(globalThis),
}) {
  if (!supabaseUrl || !anonKey || !accessToken || !sessionId || !fetch) {
    return false;
  }

  const url = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/end_study_session`;
  const request = fetch(url, {
    method: "POST",
    keepalive: true,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_session_id: sessionId,
      p_excluded_seconds: Math.max(0, Math.floor(Number(excludedSeconds) || 0)),
    }),
  });

  if (request && typeof request.catch === "function") {
    request.catch(() => undefined);
  }

  return true;
}

export function shouldEndStudySessionForPageEvent({ type, visibilityState } = {}) {
  if (type === "pagehide" || type === "beforeunload") {
    return true;
  }

  if (type === "visibilitychange") {
    return false;
  }

  return visibilityState === "unloaded";
}
