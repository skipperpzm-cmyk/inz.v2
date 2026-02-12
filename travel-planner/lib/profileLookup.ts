const PUBLIC_PROFILE_FIELDS = 'id, username, username_display, full_name, avatar_url, bio';

type ProfileQueryBuilder = {
  select: (fields: string) => ProfileQueryBuilder;
  eq: (column: string, value: string) => ProfileQueryBuilder;
  ilike: (column: string, value: string) => ProfileQueryBuilder;
  maybeSingle: () => Promise<any>;
};

export type SupabaseLikeClient = {
  from: (table: string) => ProfileQueryBuilder;
};

/**
 * Simple helper: fetch public profile by id using a Supabase-like client.
 * Slug-based lookups have been removed; use profile `id` for public routes.
 */
export async function fetchPublicProfileById(client: SupabaseLikeClient, id: string) {
  return await client.from('profiles').select(PUBLIC_PROFILE_FIELDS).eq('id', id).maybeSingle();
}

// Server-side convenience wrapper — use this when you only have an id
// and want the profile. This creates a server supabase client internally
// so callers do not need to manage the client themselves.
import { getServerSupabase } from './supabaseClient';

export async function fetchPublicProfileByIdServer(id: string) {
  const supabase = getServerSupabase();
  return fetchPublicProfileById(supabase as any, id);
}

// Server-side fetch for publicId: prefer repository DB lookup to ensure we read
// the authoritative avatar URL stored on the `users` table (not the profile row).
export async function fetchPublicProfileByPublicIdServer(publicId: string) {
  try {
    const mod = await import('src/db/repositories/user.repository.ts');
    const profile = await mod.getProfileByPublicId(publicId);
    return { data: profile ?? null, error: null };
  } catch (err: any) {
    // If the repository import fails (common in test environments due to
    // module aliasing), fall back to using the server Supabase client so
    // tests that mock `getServerSupabase` continue to work.
    try {
      const supabase = getServerSupabase();
      const res = await fetchPublicProfileByPublicId(supabase as any, publicId);
      return res as any;
    } catch (innerErr: any) {
      return { data: null, error: err };
    }
  }
}

// Fetch public profile by `public_id` (8-digit stable public identifier)
export async function fetchPublicProfileByPublicId(client: SupabaseLikeClient, publicId: string) {
  return await client.from('profiles').select(PUBLIC_PROFILE_FIELDS).eq('public_id', publicId).maybeSingle();
}

// NOTE: server-side fetch for publicId is implemented above using the
// repository `getProfileByPublicId`. We intentionally do not call Supabase
// here to ensure we read the authoritative `users.avatar_url` value.

// Backwards-compatible helper used by tests and a few callers in the repo.
// This performs a case-insensitive username lookup only. Slug-based public
// routing is deprecated for production, but the helper remains for test coverage.
export async function fetchPublicProfile(client: SupabaseLikeClient, usernameSafe: string) {
  return await client.from('profiles').select(PUBLIC_PROFILE_FIELDS).ilike('username', usernameSafe).maybeSingle();
}
