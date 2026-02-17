import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { sqlClient } from '@/src/db/db';
import { getBoardAccessForUser } from '../../_lib/moderation';

type Params = { params: Promise<{ commentId: string }> };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { commentId } = await context.params;
  if (!commentId) return NextResponse.json({ error: 'Missing comment id' }, { status: 400 });
  if (!UUID_RE.test(commentId)) return NextResponse.json({ error: 'Invalid comment id' }, { status: 400 });

  try {
    const rows = await sqlClient`
      select gc.id, gc.author_id, gc.group_id, gc.board_id
      from public.group_comments gc
      where gc.id = ${commentId}
      limit 1
    `;

    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!row) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

    const access = await getBoardAccessForUser(userId, String(row.board_id));
    if (!access || !access.isMember) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

    const canDelete = String(row.author_id) === String(userId) || access.canModerate;
    if (!canDelete) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await sqlClient`delete from public.group_comments where id = ${commentId}`;

    return NextResponse.json({ success: true, commentId: String(commentId) });
  } catch (err) {
    console.error('board comment delete error', err);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
