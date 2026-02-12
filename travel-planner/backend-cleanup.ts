// backend-cleanup.ts
// Skrypt do automatycznego wygaszania statusu online

import { requireDb } from './src/db/db';
import { sql } from 'drizzle-orm';

async function cleanupOnlineStatus() {
  const db = requireDb();
  const res = await db.execute(sql`UPDATE public.profiles SET online = false WHERE last_online_at < now() - interval '2 minutes' AND online = true`);
  console.log('[CLEANUP] Updated profiles:', res);
}

cleanupOnlineStatus().catch(console.error);