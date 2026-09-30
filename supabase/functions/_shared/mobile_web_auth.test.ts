import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { issueMobileWebTicket, MobileWebTicketError } from "./mobile_web_auth.ts";

const user = { id: "user-1", email: "owner@example.com" };

Deno.test("issues a one-use web token only for the native caller's exact account", async () => {
  const result = await issueMobileWebTicket({
    token: "native-access",
    getUser: async (token: string) => token === "native-access" ? user : null,
    allowIssue: async () => true,
    generateLink: async (email: string) => email === user.email
      ? { user: { id: user.id }, properties: { hashed_token: "one-use-hash" } }
      : null,
  });
  assertEquals(result, {
    token_hash: "one-use-hash",
    user_id: "user-1",
    verification_type: "magiclink",
  });
});

Deno.test("rejects missing and invalid native access tokens before creating a link", async () => {
  let generated = false;
  for (const token of ["", "expired"]) {
    await assertRejects(() => issueMobileWebTicket({
      token,
      getUser: async () => null,
      allowIssue: async () => true,
      generateLink: async () => { generated = true; return null; },
    }), MobileWebTicketError, "Unauthorized");
  }
  assertEquals(generated, false);
});

Deno.test("does not generate a link for an account without an email", async () => {
  let generated = false;
  await assertRejects(() => issueMobileWebTicket({
    token: "native-access",
    getUser: async () => ({ id: "user-1", email: null }),
    allowIssue: async () => true,
    generateLink: async () => { generated = true; return null; },
  }), MobileWebTicketError, "Unavailable");
  assertEquals(generated, false);
});

Deno.test("rate-limit rejection does not generate a token", async () => {
  let generated = false;
  await assertRejects(() => issueMobileWebTicket({
    token: "native-access",
    getUser: async () => user,
    allowIssue: async () => false,
    generateLink: async () => { generated = true; return null; },
  }), MobileWebTicketError, "Rate limited");
  assertEquals(generated, false);
});

Deno.test("never returns a link generated for another account", async () => {
  await assertRejects(() => issueMobileWebTicket({
    token: "native-access",
    getUser: async () => user,
    allowIssue: async () => true,
    generateLink: async () => ({ user: { id: "user-2" }, properties: { hashed_token: "wrong-hash" } }),
  }), MobileWebTicketError, "Unavailable");
});

Deno.test("rejects missing generated hash instead of returning a partial login", async () => {
  await assertRejects(() => issueMobileWebTicket({
    token: "native-access",
    getUser: async () => user,
    allowIssue: async () => true,
    generateLink: async () => ({ user: { id: user.id }, properties: { hashed_token: "" } }),
  }), MobileWebTicketError, "Unavailable");
});
