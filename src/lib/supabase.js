import { createClient } from '@supabase/supabase-js';

// Single Supabase client for the app. Reads the project URL + anon (public)
// key from Vite env (.env, gitignored). The anon key is safe to ship in the
// browser bundle — it only ever grants what Row Level Security policies allow.
// The service_role key must NEVER be used here; it bypasses RLS and belongs
// server-side only.
//
// The client is created lazily-null when env is missing (e.g. a machine with no
// .env, or the mock-only build) so importing this never crashes the app — call
// sites check `isSupabaseConfigured` before using it. This lets the app keep
// running on the in-memory mock while features are migrated over one batch at
// a time.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,      // keep the session across refreshes (localStorage)
        autoRefreshToken: true,    // silently refresh the JWT before it expires
        detectSessionInUrl: true,  // needed for magic-link / email-confirm redirects
      },
    })
  : null;
