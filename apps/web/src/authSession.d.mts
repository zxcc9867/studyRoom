export const supabaseAuthStorageKey: string;

export function createSupabaseAuthOptions(host?: unknown): {
  autoRefreshToken: true;
  detectSessionInUrl: false;
  persistSession: boolean;
  storageKey: string;
};
export function getSupabaseAuthBootstrap(host?: unknown): {
  options: ReturnType<typeof createSupabaseAuthOptions>;
  readonly failed: boolean;
  assertReady(): void;
  retry(): void;
};
