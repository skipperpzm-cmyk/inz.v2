// Slug-based resolution removed — return notfound for legacy resolver.
export type ResolveResult = { type: 'notfound' };
export async function resolveSlug(): Promise<ResolveResult> {
  return { type: 'notfound' };
}
