import { describe, it, expect } from 'vitest';
import { fetchPublicProfile } from '../lib/profileLookup';

class MockQuery {
  public selectedFields: string | null = null;
  public ilikeArgs: [string, string] | null = null;
  constructor(private response: any) {}
  select(fields: string) {
    this.selectedFields = fields;
    return this;
  }
  ilike(column: string, value: string) {
    this.ilikeArgs = [column, value];
    return this;
  }
  async maybeSingle() {
    return this.response;
  }
}

describe('fetchPublicProfile', () => {
  it('performs case-insensitive lookup via ilike', async () => {
    const response = { data: { id: '1', username: 'TiLuM' }, error: null };
    const query = new MockQuery(response);
    const client = {
      from: (table: string) => {
        expect(table).toBe('profiles');
        return query;
      },
    };

    const result = await fetchPublicProfile(client as any, 'TiLuM');

    expect(query.selectedFields).toBe('id, username, username_display, full_name, avatar_url, bio');
    expect(query.ilikeArgs).toEqual(['username', 'TiLuM']);
    expect(result).toBe(response);
  });
});
