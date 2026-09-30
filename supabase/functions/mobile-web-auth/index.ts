import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.57.4";
import { handleMobileWebAuthRequest } from "../_shared/mobile_web_auth_http.ts";

const url = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve((request) => {
  if (!url || !anonKey || !serviceKey) {
    return Response.json({ error: "Unavailable" }, {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }

  const caller = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return handleMobileWebAuthRequest(request, {
    getUser: async (token) => {
      const { data, error } = await caller.auth.getUser(token);
      return error || !data.user ? null : { id: data.user.id, email: data.user.email ?? null };
    },
    allowIssue: async (userId) => {
      const { data, error } = await admin.rpc("try_issue_mobile_web_auth_ticket", { p_user_id: userId });
      if (error) throw error;
      return data === true;
    },
    generateLink: async (email) => {
      const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (error || !data?.user || !data.properties) return null;
      return { user: { id: data.user.id }, properties: { hashed_token: data.properties.hashed_token } };
    },
  });
});
