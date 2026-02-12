import { requireDb } from 'src/db/db';
import { sql } from 'drizzle-orm';

type ChatMessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  group_id: string | null;
  content: string;
  created_at: string;
  sender_name?: string | null;
  sender_avatar_url?: string | null;
};

function clampLimit(limit?: number) {
  const fallback = 100;
  if (!limit || Number.isNaN(Number(limit))) return fallback;
  return Math.min(Math.max(Number(limit), 1), 200);
}

async function assertFriends(userId: string, friendId: string) {
  const db = requireDb();
  const res = await (db as any).execute(
    sql`SELECT 1 FROM public.user_friends WHERE user_id = ${userId} AND friend_id = ${friendId} LIMIT 1`
  );
  const rows = (res as any).rows ?? res;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Not friends');
}

async function assertGroupMember(userId: string, groupId: string) {
  const db = requireDb();
  const res = await (db as any).execute(
    sql`SELECT 1 FROM public.group_members WHERE group_id = ${groupId} AND user_id = ${userId} LIMIT 1`
  );
  const rows = (res as any).rows ?? res;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Not a group member');
}

export async function fetchDirectMessages(userId: string, friendId: string, limit?: number) {
  await assertFriends(userId, friendId);
  const db = requireDb();
  const take = clampLimit(limit);

  const res = await (db as any).execute(
    sql`SELECT m.id, m.sender_id, m.receiver_id, m.group_id, m.content, m.created_at,
        COALESCE(p.username_display, p.full_name, p.username) AS sender_name,
        COALESCE(u.avatar_url, p.avatar_url) AS sender_avatar_url
      FROM public.chat_messages m
      LEFT JOIN public.profiles p ON p.id = m.sender_id
      LEFT JOIN public.users u ON u.id = m.sender_id
      WHERE (m.sender_id = ${userId} AND m.receiver_id = ${friendId})
         OR (m.sender_id = ${friendId} AND m.receiver_id = ${userId})
      ORDER BY m.created_at ASC
      LIMIT ${take}`
  );
  const rows = (res as any).rows ?? res;
  return Array.isArray(rows) ? (rows as ChatMessageRow[]) : [];
}

export async function fetchGroupMessages(userId: string, groupId: string, limit?: number) {
  await assertGroupMember(userId, groupId);
  const db = requireDb();
  const take = clampLimit(limit);

  const res = await (db as any).execute(
    sql`SELECT m.id, m.sender_id, m.receiver_id, m.group_id, m.content, m.created_at,
        COALESCE(p.username_display, p.full_name, p.username) AS sender_name,
        COALESCE(u.avatar_url, p.avatar_url) AS sender_avatar_url
      FROM public.chat_messages m
      LEFT JOIN public.profiles p ON p.id = m.sender_id
      LEFT JOIN public.users u ON u.id = m.sender_id
      WHERE m.group_id = ${groupId}
      ORDER BY m.created_at ASC
      LIMIT ${take}`
  );
  const rows = (res as any).rows ?? res;
  return Array.isArray(rows) ? (rows as ChatMessageRow[]) : [];
}

export async function createDirectMessage(userId: string, friendId: string, content: string) {
  await assertFriends(userId, friendId);
  const db = requireDb();
  const res = await (db as any).execute(
    sql`INSERT INTO public.chat_messages (sender_id, receiver_id, content)
      VALUES (${userId}, ${friendId}, ${content})
      RETURNING id, sender_id, receiver_id, group_id, content, created_at`
  );
  const rows = (res as any).rows ?? res;
  return Array.isArray(rows) && rows.length ? (rows[0] as ChatMessageRow) : null;
}

export async function createGroupMessage(userId: string, groupId: string, content: string) {
  await assertGroupMember(userId, groupId);
  const db = requireDb();
  const res = await (db as any).execute(
    sql`INSERT INTO public.chat_messages (sender_id, group_id, content)
      VALUES (${userId}, ${groupId}, ${content})
      RETURNING id, sender_id, receiver_id, group_id, content, created_at`
  );
  const rows = (res as any).rows ?? res;
  return Array.isArray(rows) && rows.length ? (rows[0] as ChatMessageRow) : null;
}
