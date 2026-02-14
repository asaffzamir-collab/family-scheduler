import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy initialization — Supabase client is created on first use,
// not at import time. This prevents build errors when env vars
// aren't available yet (e.g., during `next build` static analysis).

let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) return _supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Copy .env.example to .env.local and fill in your Supabase credentials."
    );
  }

  _supabaseAdmin = createClient(url, key, {
    auth: { persistSession: false },
  });

  return _supabaseAdmin;
}

// Convenience getter (backward-compatible)
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseAdmin() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
