export const mobileOAuthRedirect = "studyroom://auth/callback";

export function getMobileOAuthCode(value: string) {
  const url = new URL(value);
  if (url.protocol !== "studyroom:" || url.host !== "auth" || url.pathname !== "/callback"
    || url.username || url.password || url.hash || url.searchParams.has("error")
    || url.searchParams.has("access_token") || url.searchParams.has("refresh_token")) {
    throw new Error("로그인 연결을 완료하지 못했어요. Google 로그인을 다시 눌러 주세요.");
  }
  const codes = url.searchParams.getAll("code");
  if (codes.length !== 1 || !codes[0] || codes[0].length > 4096) {
    throw new Error("로그인 응답을 확인하지 못했어요. 다시 시도해 주세요.");
  }
  return codes[0];
}

type OAuthClient = { auth: {
  signInWithOAuth: (args: { provider: "google"; options: { redirectTo: string; skipBrowserRedirect: boolean } }) => Promise<{ data: { url: string | null }; error: unknown }>;
  exchangeCodeForSession: (code: string) => Promise<{ data: { session: unknown }; error: unknown }>;
} };
type BrowserResult = { type: string; url?: string };
const callbackExchanges = new Map<string, Promise<boolean>>();

export function completeMobileOAuthCallback(client: Pick<OAuthClient, "auth">, value: string) {
  const code = getMobileOAuthCode(value);
  const existing = callbackExchanges.get(code);
  if (existing) return existing;
  const exchange = (async () => {
    const result = await client.auth.exchangeCodeForSession(code);
    if (result.error || !result.data.session) throw new Error("로그인 연결이 만료되었어요. Google 로그인을 다시 눌러 주세요.");
    return true;
  })();
  callbackExchanges.set(code, exchange);
  if (callbackExchanges.size > 10) callbackExchanges.delete(callbackExchanges.keys().next().value!);
  return exchange;
}

export async function signInWithMobileGoogle(
  client: OAuthClient,
  openBrowser: (url: string, redirect: string) => Promise<BrowserResult>,
  supabaseOrigin: string,
) {
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google", options: { redirectTo: mobileOAuthRedirect, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new Error("Google 로그인을 열지 못했어요. 잠시 후 다시 시도해 주세요.");
  const destination = new URL(data.url);
  if (destination.protocol !== "https:" || destination.origin !== new URL(supabaseOrigin).origin
    || destination.pathname !== "/auth/v1/authorize"
    || destination.searchParams.get("code_challenge_method") !== "s256") throw new Error("안전한 인증 연결을 준비하지 못했어요. 앱을 다시 열고 시도해 주세요.");
  const result = await openBrowser(data.url, mobileOAuthRedirect);
  if (result.type !== "success") return false;
  if (!result.url) throw new Error("로그인 응답이 없어요. 다시 시도해 주세요.");
  return completeMobileOAuthCallback(client, result.url);
}
