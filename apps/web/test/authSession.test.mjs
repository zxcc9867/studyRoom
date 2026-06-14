import assert from "node:assert/strict";
import test from "node:test";

import { createSupabaseAuthOptions, supabaseAuthStorageKey } from "../src/authSession.mjs";

test("configures Supabase Auth to persist and refresh browser sessions", () => {
  const options = createSupabaseAuthOptions();

  assert.equal(options.persistSession, true);
  assert.equal(options.autoRefreshToken, true);
  assert.equal(options.storageKey, supabaseAuthStorageKey);
});

test("keeps OAuth callback handling inside the app", () => {
  const options = createSupabaseAuthOptions();

  assert.equal(options.detectSessionInUrl, false);
});
