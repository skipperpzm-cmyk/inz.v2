import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { requireDb } from 'src/db/db';
import { isConnectTimeoutError } from '@/lib/db-errors';
import { sessions } from '../schema';

const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24h

export async function createSession(userId: string, expiresAt?: Date | null) {
  const token = randomUUID();
  const db = requireDb();
  const expiry = expiresAt ?? new Date(Date.now() + DEFAULT_SESSION_TTL_MS);
  await db.insert(sessions).values({ userId, sessionToken: token, expiresAt: expiry }).returning();
  return token;
}

export async function getSessionByToken(token: string) {
  const row = await requireDb().select().from(sessions).where(eq(sessions.sessionToken, token)).limit(1);
  return row[0] ?? null;
}

export async function getUserIdByToken(token: string) {
  try {
    const rows = await requireDb()
      .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(eq(sessions.sessionToken, token))
      .limit(1);

    const row = rows[0] ?? null;
    if (!row) return null;
    if (row.expiresAt && new Date(row.expiresAt) <= new Date()) return null;
    return row.userId;
  } catch (error: any) {
    if (isConnectTimeoutError(error)) {
      console.warn('Session lookup timed out');
      return null;
    }
    throw error;
  }
}

export async function deleteSessionByToken(token: string) {
  await requireDb().delete(sessions).where(eq(sessions.sessionToken, token));
}

export async function deleteSessionsByUserId(userId: string) {
  await requireDb().delete(sessions).where(eq(sessions.userId, userId));
}
