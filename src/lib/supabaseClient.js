// Single Supabase client for the whole app. Reads only the public,
// client-safe publishable ("anon") key — never the service-role secret,
// which must never appear in frontend code.
//
// If credentials are absent (e.g. local development before Supabase is
// configured), this module does NOT throw and does NOT fake a signed-in
// session. `supabase` is exported as `null` and `isSupabaseConfigured` is
// `false`; every caller (AuthContext, progress hooks, etc.) checks that
// flag and degrades to a signed-out, local-only experience instead of
// crashing the app or pretending auth succeeded.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

if (!isSupabaseConfigured && import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn(
    "[e-Lab] Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing). " +
    "Sign-in, profiles, and saved progress are disabled until these are set in .env — see .env.example."
  );
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
