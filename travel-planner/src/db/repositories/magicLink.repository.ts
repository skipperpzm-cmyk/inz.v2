import { eq } from 'drizzle-orm';
import { requireDb } from 'src/db/db';
import { magicLinks } from '../schema';

export async function createMagicLinkToken(data: {
  userId?: string | null;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const db = requireDb();
  const created = await db
    .insert(magicLinks)
    .values({
      userId: data.userId ?? null,
      email: data.email.toLowerCase(),
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      ip: data.ip ?? null,
      userAgent: data.userAgent ?? null,
    })
    .returning();
  return created[0] ?? null;
}

export async function getMagicLinkByTokenHash(tokenHash: string) {
  const row = await requireDb().select().from(magicLinks).where(eq(magicLinks.tokenHash, tokenHash)).limit(1);
  return row[0] ?? null;
}

export async function markMagicLinkUsed(id: string) {
  const updated = await requireDb()
    .update(magicLinks)
    .set({ usedAt: new Date() })
    .where(eq(magicLinks.id, id))
    .returning();
  return updated[0] ?? null;
}

export async function deleteMagicLinksByUserId(userId: string) {
  await requireDb().delete(magicLinks).where(eq(magicLinks.userId, userId));
}
