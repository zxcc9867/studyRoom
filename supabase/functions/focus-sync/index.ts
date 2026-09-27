import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.57.4";
import { sendStudyFocusSignals } from "../_shared/study_focus.ts";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return new Response(null, { status: 405, headers: corsHeaders });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !url || !anonKey || !serviceKey) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  const caller = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: { user }, error } = await caller.auth.getUser(token);
  if (error || !user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    return Response.json(await sendStudyFocusSignals(admin, user.id), { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Focus sync failed" }, { status: 500, headers: corsHeaders });
  }
});
