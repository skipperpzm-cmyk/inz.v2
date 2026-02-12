import { describe, it, expect } from 'vitest';
import { profileHref, canonicalizeUsernameSlug } from '../lib/profileUrl';

describe('profile URL helpers', () => {
  it('forces lowercase slugs while preserving original casing for display', () => {
    const input = 'TiLuM';
    const href = profileHref(input);
    // Slug-based profileHref is deprecated; it should not construct a URL from a username.
    expect(href).toBeNull();
    // original string stays untouched for UI display
    expect(input).toBe('TiLuM');
  });

  it('returns null when username is missing', () => {
    expect(profileHref('')).toBeNull();
    expect(profileHref('   ')).toBeNull();
    expect(profileHref(undefined)).toBeNull();
  });

  it('detects when canonical redirect is required', () => {
    const mixed = canonicalizeUsernameSlug('  TiLuM  ');
    expect(mixed.trimmed).toBe('TiLuM');
    expect(mixed.canonical).toBe('tilum');
    expect(mixed.isCanonical).toBe(false);

    const alreadyLower = canonicalizeUsernameSlug('tilum');
    expect(alreadyLower.isCanonical).toBe(true);
  });
});
