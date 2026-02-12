export const USERNAME_MIN = 2;
export const USERNAME_MAX = 64;
export const USERNAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

function normalize(input?: string | null) {
  return String(input ?? '').trim();
}

export function canonicalizeUsernameSlug(input?: string | null) {
  const trimmed = normalize(input);
  const canonical = trimmed.toLowerCase();
  return {
    trimmed,
    canonical,
    isCanonical: trimmed === canonical,
  };
}

export function profileHref(idOrUsername?: string | null) {
  const val = normalize(idOrUsername);
  if (!val) return null;
  // If the value looks like a UUID, treat it as an internal id and return ID-based profile URL.
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRe.test(val)) return `/profile/${encodeURIComponent(val)}`;

  // If the value looks like an 8-digit public id, use it for public profile URLs.
  const publicIdRe = /^\d{8}$/;
  if (publicIdRe.test(val)) return `/profile/${encodeURIComponent(val)}`;

  // Slug/username-based routing is deprecated; do not construct profile URLs from usernames.
  return null;
}

export function isUsernameFormatValid(username?: string | null) {
  const normalized = normalize(username);
  if (!normalized) return false;
  if (normalized.length < USERNAME_MIN || normalized.length > USERNAME_MAX) return false;
  return USERNAME_PATTERN.test(normalized);
}
