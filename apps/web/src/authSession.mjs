export const supabaseAuthStorageKey = "study-room-attendance-auth-session";

export function createSupabaseAuthOptions() {
  return {
    autoRefreshToken: true,
    detectSessionInUrl: false,
    persistSession: true,
    storageKey: supabaseAuthStorageKey,
  };
}
