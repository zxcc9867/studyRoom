export function normalizeBase64Url(value) {
  return value.trim().replace(/=+$/g, "");
}

export function uint8ArrayToBase64Url(value) {
  let binary = "";
  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function applicationServerKeyMatches(subscription, expectedPublicKey) {
  const applicationServerKey = subscription?.options?.applicationServerKey;
  if (!applicationServerKey) {
    return false;
  }

  return uint8ArrayToBase64Url(new Uint8Array(applicationServerKey)) === normalizeBase64Url(expectedPublicKey);
}
