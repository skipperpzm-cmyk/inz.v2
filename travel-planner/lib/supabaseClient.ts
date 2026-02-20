import { createClient, SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (browserClient) return browserClient;
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) as string;
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY) as string;
  if (!url || !anon) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables');
  }
  browserClient = createClient(url, anon, {
    auth: { persistSession: false },
  });
  return browserClient;
}

/**
 * Create a lightweight server-side Supabase client for simple read queries.
 * Note: do NOT use service_role key here.
 */
export function getServerSupabase() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) as string;
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY) as string;
  if (!url || !anon) {
    throw new Error('Missing SUPABASE URL/ANON environment variables (NEXT_PUBLIC or plain)');
  }
  return createClient(url, anon, { auth: { persistSession: false } });
}

/**
 * Create a Supabase client using the service role key. Use only on the server.
 * This client bypasses RLS and can be used for admin operations like looking
 * up users in the auth schema. Ensure SUPABASE_SERVICE_ROLE_KEY is set.
 */
export function getServiceSupabase() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) as string;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY) as string;
  if (!url || !key) {
    const missing = [
      !url ? 'SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)' : null,
      !key ? 'SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY / SERVICE_ROLE_KEY)' : null,
    ].filter(Boolean).join(', ');
    throw new Error(`Missing Supabase service env: ${missing}`);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
