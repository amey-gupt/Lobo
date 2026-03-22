import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _adminClient: SupabaseClient | null = null;

/**
 * Server-only Supabase client with service role key for admin operations
 * (e.g. updating chat_logs with Gemini flag results).
 * Returns null if SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY is not set.
 * Get it from Supabase Dashboard → Settings → API → service_role (secret).
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (_adminClient) return _adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;
  if (!url || !serviceKey) return null;
  _adminClient = createClient(url, serviceKey);
  return _adminClient;
}
