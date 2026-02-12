import { describe, it, expect } from 'vitest';
import { fetchPublicProfileByPublicId } from '../lib/profileLookup';

// Mock Supabase-like client
const makeMockClient = (result: any) => ({
  from: (table: string) => ({
    select: (fields: string) => ({
      eq: (col: string, val: string) => ({
        maybeSingle: async () => ({ data: result, error: null }),
      }),
    }),
  }),
});

describe('fetchPublicProfileByPublicId', () => {
  it('returns profile data from a Supabase-like client', async () => {
    const expected = { id: 'u1', public_id: '12345678', username: 'alice' };
    const client = makeMockClient(expected);
    const res = await fetchPublicProfileByPublicId(client as any, '12345678');
    expect(res).toEqual({ data: expected, error: null });
  });
});
