import { sql } from 'drizzle-orm';
import { requireDb } from 'src/db/db';

// Update live presence fields for a profile row.
export async function setOnlineStatus(userId: string, online: boolean) {
  await requireDb().execute(
    sql`UPDATE public.profiles SET online = ${online}, last_online_at = now() WHERE id = ${userId}`
  );
}
