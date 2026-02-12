import { describe, it, expect } from 'vitest';

function genPublicId() {
  return String(Math.floor(Math.random() * 90000000) + 10000000).padStart(8, '0');
}

describe('public_id generator (JS simulation)', () => {
  it('generates 8-digit numeric strings', () => {
    for (let i = 0; i < 100; i++) {
      const v = genPublicId();
      expect(/^[0-9]{8}$/.test(v)).toBe(true);
    }
  });

  it('produces mostly-unique values in a small sample', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      seen.add(genPublicId());
    }
    // Collisions are possible but extremely unlikely in this sample; assert >99% unique
    expect(seen.size).toBeGreaterThan(990);
  });
});
