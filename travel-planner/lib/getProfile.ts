import type { SupabaseClient } from '@supabase/supabase-js';
import { getBrowserSupabase, getServerSupabase } from './supabaseClient';

export type Profile = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * Server-safe helper to fetch a profile by user id.
 * - If `userId` is not provided, returns null.
 */
export async function getProfileServer(userId?: string): Promise<Profile | null> {
  if (!userId) return null;
  const supabase = getServerSupabase() as SupabaseClient;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) {
    // Don't throw — let callers handle null and log if desired
    console.error('getProfileServer error', error);
    return null;
  }
  return (data as Profile) ?? null;
}

/**
 * Client-side fetch function that returns profile or null.
 * Useful for Client Components where you already manage loading state.
 */
export async function fetchProfileClient(userId: string | null): Promise<Profile | null> {
  if (!userId) return null;
  const supabase = getBrowserSupabase() as SupabaseClient;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) {
    console.error('fetchProfileClient error', error);
    return null;
  }
  return (data as Profile) ?? null;
}
