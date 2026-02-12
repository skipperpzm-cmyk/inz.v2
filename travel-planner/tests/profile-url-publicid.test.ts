import { describe, it, expect } from 'vitest';
import { profileHref } from '../lib/profileUrl';

describe('profileHref public_id support', () => {
  it('returns a public profile URL for 8-digit numeric public_id', () => {
    expect(profileHref('12345678')).toBe('/profile/12345678');
  });

  it('still supports UUID internal ids', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(profileHref(uuid)).toBe(`/profile/${encodeURIComponent(uuid)}`);
  });
});
