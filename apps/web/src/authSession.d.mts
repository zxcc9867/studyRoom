export const supabaseAuthStorageKey: string;

export function createSupabaseAuthOptions(): {
  autoRefreshToken: true;
  detectSessionInUrl: false;
  persistSession: true;
  storageKey: string;
};
