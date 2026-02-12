import { eq } from 'drizzle-orm';
import { boardItems } from '../schema';
import { requireDb } from 'src/db/db';

type BoardItemInput = {
  boardId: string;
  title: string;
  description?: string | null;
  status?: 'todo' | 'doing' | 'done';
};

export async function getItemsByBoardId(boardId: string) {
  const db = requireDb();
  return db.select().from(boardItems).where(eq(boardItems.boardId, boardId));
}

export async function createItem(data: BoardItemInput) {
  const db = requireDb();
  const inserted = await db
    .insert(boardItems)
    .values({
      boardId: data.boardId,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? 'todo',
    })
    .returning();
  return inserted[0] ?? null;
}

export async function updateItem(id: string, data: Partial<BoardItemInput>) {
  const db = requireDb();
  const updated = await db
    .update(boardItems)
    .set({
      title: data.title,
      description: data.description,
      status: data.status,
    })
    .where(eq(boardItems.id, id))
    .returning();
  return updated[0] ?? null;
}

export async function deleteItem(id: string) {
  const db = requireDb();
  await db.delete(boardItems).where(eq(boardItems.id, id));
  return true;
}
