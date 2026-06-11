import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type KakaoConnectionStatus = {
  connected: boolean;
  enabled: boolean;
  connectedAt: string | null;
  updatedAt: string | null;
  scope: string | null;
  needsTalkMessage: boolean;
};

type KakaoTokenInfo = {
  id?: number;
  expires_in?: number;
};

const kakaoMessageScope = "talk_message account_email profile_image profile_nickname";
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "content-type": "application/json" };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authHeader = request.headers.get("authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return json({ error: "Unauthorized" }, 401);
  }

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(jwt);
  if (userError || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    if (request.method === "GET") {
      return json(await loadConnectionStatus(admin, user.id));
    }

    if (request.method === "POST") {
      const body = await parseJsonBody(request);
      const providerToken = normalizeToken(body.provider_token);
      const providerRefreshToken = normalizeToken(body.provider_refresh_token);
      if (!providerToken) {
        return json({ error: "Kakao provider token is required" }, 400);
      }

      const tokenInfo = await fetchKakaoTokenInfo(providerToken);
      const expiresIn = safePositiveNumber(tokenInfo.expires_in, 6 * 60 * 60);
      const kakaoUserId = tokenInfo.id ? String(tokenInfo.id) : null;
      const { data: existing } = await admin
        .from("kakao_message_connections")
        .select("refresh_token")
        .eq("user_id", user.id)
        .maybeSingle();

      const refreshToken = providerRefreshToken ?? existing?.refresh_token ?? null;
      const now = new Date();
      const { error: upsertError } = await admin.from("kakao_message_connections").upsert(
        {
          user_id: user.id,
          kakao_user_id: kakaoUserId,
          access_token: providerToken,
          refresh_token: refreshToken,
          access_token_expires_at: new Date(now.getTime() + expiresIn * 1000).toISOString(),
          scope: kakaoMessageScope,
          enabled: true,
          connected_at: now.toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (upsertError) {
        throw upsertError;
      }

      const { error: targetError } = await admin.from("notification_targets").upsert(
        {
          user_id: user.id,
          kind: "kakao_memo",
          destination: "kakao",
          enabled: true,
          last_seen_at: now.toISOString(),
        },
        { onConflict: "user_id,kind,target_key" },
      );
      if (targetError) {
        throw targetError;
      }

      return json(await loadConnectionStatus(admin, user.id));
    }

    if (request.method === "DELETE") {
      await admin.from("kakao_message_connections").update({ enabled: false }).eq("user_id", user.id);
      await admin
        .from("notification_targets")
        .update({ enabled: false, last_seen_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("kind", "kakao_memo");
      return json(await loadConnectionStatus(admin, user.id));
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

async function loadConnectionStatus(admin: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await admin
    .from("kakao_message_connections")
    .select("enabled,connected_at,updated_at,scope")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const scope = data?.scope ?? null;
  const enabled = Boolean(data?.enabled);
  return {
    connected: enabled,
    enabled,
    connectedAt: enabled ? data?.connected_at ?? null : null,
    updatedAt: data?.updated_at ?? null,
    scope,
    needsTalkMessage: enabled ? !hasTalkMessageScope(scope) : true,
  } satisfies KakaoConnectionStatus;
}

async function fetchKakaoTokenInfo(accessToken: string) {
  const response = await fetch("https://kapi.kakao.com/v1/user/access_token_info", {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Kakao token verification failed: ${response.status}`);
  }

  return (await response.json()) as KakaoTokenInfo;
}

async function parseJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

function normalizeToken(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hasTalkMessageScope(scope: string | null) {
  return (scope ?? "").split(/\s+/).includes("talk_message");
}

function safePositiveNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
