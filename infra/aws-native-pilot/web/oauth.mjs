export const base64url = value => btoa(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const random = () => base64url(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));

export async function makeAuthorization(config, redirectUri) {
  const pending = {verifier:random(), state:random(), createdAt:Date.now()};
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pending.verifier));
  const url = new URL('/oauth2/authorize', config.cognitoDomain);
  url.search = new URLSearchParams({
    client_id:config.clientId, redirect_uri:redirectUri, response_type:'code', scope:'openid',
    code_challenge_method:'S256', code_challenge:base64url(String.fromCharCode(...new Uint8Array(hash))),
    state:pending.state
  });
  return {url, pending};
}

export async function finishAuthorization(config, callback, pending, request = fetch) {
  const age = Date.now() - pending?.createdAt;
  if (!pending || !Number.isFinite(age) || age < 0 || age > 10 * 60_000 ||
      !/^[\w-]{43}$/.test(pending.verifier) || !/^[\w-]{43}$/.test(pending.state) ||
      callback.searchParams.getAll('state').length !== 1 ||
      callback.searchParams.get('state') !== pending.state) throw new Error('Invalid OAuth state');
  const code = callback.searchParams.get('code');
  if (!code || callback.searchParams.getAll('code').length !== 1 || callback.searchParams.has('error')) throw new Error('Invalid OAuth callback');
  const response = await request(new URL('/oauth2/token', config.cognitoDomain).href, {
    method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, cache:'no-store',
    redirect:'error', credentials:'omit', signal:AbortSignal.timeout(10_000),
    body:new URLSearchParams({
      grant_type:'authorization_code', client_id:config.clientId, redirect_uri:callback.origin + '/',
      code, code_verifier:pending.verifier
    })
  });
  if (!response.ok) throw new Error('OAuth exchange failed');
  const {access_token:token, token_type:type} = await response.json();
  if (type?.toLowerCase() !== 'bearer' || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token ?? '')) throw new Error('Invalid OAuth response');
  return token;
}

export function tokenSubject(token) {
  const encoded = token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
  // Display routing only; authorization is independently enforced on AWS.
  return JSON.parse(atob(encoded)).sub;
}
