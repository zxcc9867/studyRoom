import { assertEquals } from "jsr:@std/assert@1";
import { handleMobileWebAuthRequest } from "./mobile_web_auth_http.ts";

const dependencies = {
  getUser: async (token: string) => token === "valid" ? { id: "user-1", email: "owner@example.com" } : null,
  allowIssue: async (_userId: string) => true,
  generateLink: async (_email: string) => ({ user: { id: "user-1" }, properties: { hashed_token: "once" } }),
};

Deno.test("HTTP ticket endpoint requires POST and an authenticated bearer token", async () => {
  const url = "https://project.supabase.co/functions/v1/mobile-web-auth";
  const get = await handleMobileWebAuthRequest(new Request(url), dependencies);
  assertEquals(get.status, 405);
  const missing = await handleMobileWebAuthRequest(new Request(url, { method: "POST" }), dependencies);
  assertEquals(missing.status, 401);
  assertEquals(await missing.json(), { error: "Unauthorized" });
  const invalid = await handleMobileWebAuthRequest(new Request(url, {
    method: "POST", headers: { authorization: "Bearer wrong" },
  }), dependencies);
  assertEquals(invalid.status, 401);
});

Deno.test("success returns only a one-use hash and refuses caching", async () => {
  const response = await handleMobileWebAuthRequest(new Request(
    "https://project.supabase.co/functions/v1/mobile-web-auth",
    { method: "POST", headers: { authorization: "Bearer valid" } },
  ), dependencies);
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("cache-control"), "no-store");
  assertEquals(await response.json(), {
    token_hash: "once", user_id: "user-1", verification_type: "magiclink",
  });
});

Deno.test("rate limit error has no secret and is not cacheable", async () => {
  const response = await handleMobileWebAuthRequest(new Request(
    "https://project.supabase.co/functions/v1/mobile-web-auth",
    { method: "POST", headers: { authorization: "Bearer valid" } },
  ), { ...dependencies, allowIssue: async () => false });
  assertEquals(response.status, 429);
  assertEquals(response.headers.get("cache-control"), "no-store");
  assertEquals(await response.json(), { error: "Rate limited" });
});
