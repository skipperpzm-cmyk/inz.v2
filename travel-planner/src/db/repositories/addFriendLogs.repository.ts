import { requireDb } from 'src/db/db';
import { addFriendLogs } from 'src/db/schema';
import { eq } from 'drizzle-orm';

export async function logAddFriend(userId: string, query: string) {
  const db = requireDb();
  await db.insert(addFriendLogs).values({ userId, query });
}

export async function listAddFriendLogs(userId: string) {
  const db = requireDb();
  return db.select().from(addFriendLogs).where(eq(addFriendLogs.userId, userId));
}
