export function normalizeBase64Url(value: string): string;
export function uint8ArrayToBase64Url(value: Uint8Array): string;
export function applicationServerKeyMatches(
  subscription: PushSubscription | { options?: { applicationServerKey?: ArrayBuffer | null } } | null,
  expectedPublicKey: string,
): boolean;
