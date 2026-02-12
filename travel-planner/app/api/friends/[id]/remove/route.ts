const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

import { NextResponse, NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requireDb } from '@/src/db/db';
import { sql } from 'drizzle-orm';
import { getUserById } from 'src/db/repositories/user.repository';

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const params = await context.params;
  const targetId = params?.id;
  if (!targetId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  if (!UUID_RE.test(targetId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  if (targetId === user.id) return NextResponse.json({ error: 'Cannot unfriend yourself' }, { status: 400 });

  try {
    const target = await getUserById(targetId);
    if (!target) return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
  } catch (err) {
    console.error('failed to verify target user exists', err);
    return NextResponse.json({ error: 'Failed to verify target user' }, { status: 500 });
  }

  const db = requireDb();
  try {
    const res = await (db as any).execute(sql`
      DELETE FROM public.user_friends
      WHERE (user_id = ${user.id} AND friend_id = ${targetId})
         OR (user_id = ${targetId} AND friend_id = ${user.id})
      RETURNING user_id, friend_id
    `);
    const rows = (res as any).rows ?? res;
    const removed = Array.isArray(rows) ? rows.length : 0;
    if (removed === 0) return NextResponse.json({ error: 'Friend relation not found' }, { status: 404 });
    return NextResponse.json({ ok: true, removed });
  } catch (err: any) {
    console.error('unfriend error', err);
    return NextResponse.json({ error: err?.message ?? 'Failed to remove friend' }, { status: 500 });
  }
}
