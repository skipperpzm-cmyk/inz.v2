// Deprecated compatibility re-export. Prefer importing from `src/db/db` directly.
// This module will be removed in a future version.
console.warn('[DEPRECATED] lib/db.ts is deprecated. Import from src/db/db instead.');
export { db, requireDb } from '../src/db/db';
