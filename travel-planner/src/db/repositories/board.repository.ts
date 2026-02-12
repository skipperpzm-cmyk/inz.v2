import { eq } from 'drizzle-orm';
import { boards } from '../schema';
import { requireDb } from 'src/db/db';

export async function getBoardsByTripId(tripId: string) {
  const db = requireDb();
  return db.select().from(boards).where(eq(boards.tripId, tripId));
}

export async function createBoard(data: { tripId: string; title: string }) {
  const db = requireDb();
  const inserted = await db.insert(boards).values(data).returning();
  return inserted[0] ?? null;
}

export async function updateBoard(id: string, data: Partial<{ title: string }>) {
  const db = requireDb();
  const updated = await db.update(boards).set(data).where(eq(boards.id, id)).returning();
  return updated[0] ?? null;
}

export async function deleteBoard(id: string) {
  const db = requireDb();
  await db.delete(boards).where(eq(boards.id, id));
  return true;
}
