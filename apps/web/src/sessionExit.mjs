export function requestEndStudySessionOnExit({
  supabaseUrl,
  anonKey,
  accessToken,
  sessionId,
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
    body: JSON.stringify({ p_session_id: sessionId }),
  });

  if (request && typeof request.catch === "function") {
    request.catch(() => undefined);
  }

  return true;
}
