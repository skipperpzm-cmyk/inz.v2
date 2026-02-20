import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { sqlClient } from '@/src/db/db';
import { getBoardAccessForUser } from '../../_lib/moderation';

type Params = { params: Promise<{ postId: string }> };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { postId } = await context.params;
  if (!postId) return NextResponse.json({ error: 'Missing post id' }, { status: 400 });
  if (!UUID_RE.test(postId)) return NextResponse.json({ error: 'Invalid post id' }, { status: 400 });

  try {
    const rows = await sqlClient`
      select gp.id, gp.group_id, gp.board_id, gp.author_id
      from public.group_posts gp
      where gp.id = ${postId}
      limit 1
    `;

    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!row) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    const access = await getBoardAccessForUser(userId, String(row.board_id));
    if (!access || !access.isMember) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    if (access.isArchived) return NextResponse.json({ error: 'Archived board is read-only' }, { status: 409 });

    const canDelete = String(row.author_id) === String(userId) || access.canModerate;
    if (!canDelete) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await sqlClient`delete from public.group_posts where id = ${postId}`;

    return NextResponse.json({ success: true, postId: String(postId) });
  } catch (err) {
    console.error('board post delete error', err);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}
