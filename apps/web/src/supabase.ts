import { createClient } from "@supabase/supabase-js";
import { getSupabaseAuthBootstrap } from "./authSession.mjs";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
// Even failed legacy cleanup constructs only an empty memory client. The shared
// bootstrap latch keeps desktop authentication blocked behind actionable UI.
const { options: authOptions } = getSupabaseAuthBootstrap(typeof window === "undefined" ? undefined : window);

export const supabase = createClient(
  supabaseUrl || "https://example.supabase.co",
  supabaseAnonKey || "missing-anon-key",
  {
    auth: authOptions,
  },
);
