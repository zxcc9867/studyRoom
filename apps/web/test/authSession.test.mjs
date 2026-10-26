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

test('desktop options clear only prior renderer auth key and never persist credentials', () => {
  const removed=[];
  const host={location:{origin:'https://study-room-attendance.vercel.app'},studyRoomDesktop:{protocolVersion:1,request(){},onEvent(){}},localStorage:{removeItem:key=>removed.push(key)}};host.top=host;
  const options=createSupabaseAuthOptions(host);
  assert.equal(options.persistSession,false);
  assert.deepEqual(removed,['study-room-attendance-auth-session']);
});

test('ordinary web and Android retain persistent authentication without deleting storage', () => {
  for(const android of [false,true]){
    const host={location:{origin:'https://study-room-attendance.vercel.app'},localStorage:{removeItem(){assert.fail('non-desktop storage must be preserved');}},...(android?{ReactNativeWebView:{postMessage(){}}}:{})};host.top=host;
    assert.equal(createSupabaseAuthOptions(host).persistSession,true);
  }
});

test('desktop cleanup failure stops before a client can hydrate old credentials', () => {
  const host={location:{origin:'https://study-room-attendance.vercel.app'},studyRoomDesktop:{protocolVersion:1,request(){},onEvent(){}},localStorage:{removeItem(){throw new Error('private storage boundary');}}};host.top=host;
  assert.throws(()=>createSupabaseAuthOptions(host),/^Error: DESKTOP_AUTH_STORAGE_CLEANUP_FAILED$/);
});
