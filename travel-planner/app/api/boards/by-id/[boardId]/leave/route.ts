import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { sqlClient } from '@/src/db/db';
import { getBoardAccessForUser, UUID_RE } from '../../../_lib/moderation';

type Params = { params: Promise<{ boardId: string }> };

export async function POST(_request: Request, context: Params) {
  const requesterId = await getCurrentUserId();
  if (!requesterId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { boardId } = await context.params;
  if (!boardId) return NextResponse.json({ error: 'Missing board id' }, { status: 400 });
  if (!UUID_RE.test(boardId)) return NextResponse.json({ error: 'Invalid board id' }, { status: 400 });

  try {
    const access = await getBoardAccessForUser(requesterId, boardId);
    if (!access) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    if (!access.isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (access.isArchived) {
      return NextResponse.json({ error: 'Archived board cannot be left' }, { status: 409 });
    }
    if (access.isOwner) {
      return NextResponse.json({ error: 'Owner cannot leave board. Owner can only delete board.' }, { status: 422 });
    }

    await sqlClient`
      delete from public.board_moderators
      where board_id = ${boardId}::uuid
        and user_id = ${requesterId}::uuid
    `;

    await sqlClient`
      delete from public.board_members
      where board_id = ${boardId}::uuid
        and user_id = ${requesterId}::uuid
    `;

    return NextResponse.json({ success: true, boardId, groupId: access.groupId });
  } catch (err) {
    console.error('board leave error', err);
    return NextResponse.json({ error: 'Failed to leave board' }, { status: 500 });
  }
}
