import { describe, it, expect, vi } from 'vitest';
import { fetchPublicProfileByPublicIdServer } from '../lib/profileLookup';

// Mock the server supabase client module
vi.mock('../lib/supabaseClient', () => ({
  getServerSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { id: 'u1', public_id: '12345678', username: 'alice' }, error: null }) }),
      }),
    }),
  }),
}));

describe('fetchPublicProfileByPublicIdServer', () => {
  it('returns the profile via server wrapper', async () => {
    const res = await fetchPublicProfileByPublicIdServer('12345678') as any;
    expect(res).toEqual({ data: { id: 'u1', public_id: '12345678', username: 'alice' }, error: null });
  });
});
