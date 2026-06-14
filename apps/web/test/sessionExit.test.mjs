import assert from "node:assert/strict";
import test from "node:test";

import { requestEndStudySessionOnExit, shouldEndStudySessionForPageEvent } from "../src/sessionExit.mjs";

test("sends end_study_session with keepalive when a page exits with an active session", () => {
  const calls = [];
  const sent = requestEndStudySessionOnExit({
    supabaseUrl: "https://project.supabase.co/",
    anonKey: "anon-key",
    accessToken: "access-token",
    sessionId: "session-id",
    fetch: (url, init) => {
      calls.push({ url, init });
      return Promise.resolve({ ok: true });
    },
  });

  assert.equal(sent, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://project.supabase.co/rest/v1/rpc/end_study_session");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.keepalive, true);
  assert.equal(calls[0].init.headers.apikey, "anon-key");
  assert.equal(calls[0].init.headers.Authorization, "Bearer access-token");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  assert.equal(calls[0].init.body, JSON.stringify({ p_session_id: "session-id", p_excluded_seconds: 0 }));
});

test("sends excluded camera absence seconds when a page exits", () => {
  const calls = [];
  const sent = requestEndStudySessionOnExit({
    supabaseUrl: "https://project.supabase.co",
    anonKey: "anon-key",
    accessToken: "access-token",
    sessionId: "session-id",
    excludedSeconds: 375,
    fetch: (url, init) => {
      calls.push({ url, init });
      return Promise.resolve({ ok: true });
    },
  });

  assert.equal(sent, true);
  assert.equal(calls[0].init.body, JSON.stringify({ p_session_id: "session-id", p_excluded_seconds: 375 }));
});

test("does not send an exit request without an access token or active session", () => {
  const calls = [];

  assert.equal(
    requestEndStudySessionOnExit({
      supabaseUrl: "https://project.supabase.co",
      anonKey: "anon-key",
      accessToken: "",
      sessionId: "session-id",
      fetch: (...args) => calls.push(args),
    }),
    false,
  );
  assert.equal(
    requestEndStudySessionOnExit({
      supabaseUrl: "https://project.supabase.co",
      anonKey: "anon-key",
      accessToken: "access-token",
      sessionId: null,
      fetch: (...args) => calls.push(args),
    }),
    false,
  );
  assert.equal(calls.length, 0);
});

test("does not end a study session for tab switches or browser refresh lifecycle events", () => {
  assert.equal(shouldEndStudySessionForPageEvent({ type: "visibilitychange", visibilityState: "hidden" }), false);
  assert.equal(shouldEndStudySessionForPageEvent({ type: "visibilitychange", visibilityState: "visible" }), false);
  assert.equal(shouldEndStudySessionForPageEvent({ type: "pagehide" }), false);
  assert.equal(shouldEndStudySessionForPageEvent({ type: "beforeunload" }), false);
});
