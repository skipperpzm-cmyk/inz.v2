import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { sqlClient } from '@/src/db/db';
import { createNotification } from '@/src/db/repositories/notifications.repository';
import { getBoardAccessForUser, listBoardMembers, UUID_RE } from '../../../../_lib/moderation';

type Params = { params: Promise<{ boardId: string; userId: string }> };

export async function DELETE(_request: Request, context: Params) {
  const requesterId = await getCurrentUserId();
  if (!requesterId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { boardId, userId } = await context.params;
  if (!boardId || !userId) return NextResponse.json({ error: 'Missing route params' }, { status: 400 });
  if (!UUID_RE.test(boardId) || !UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'Invalid route params' }, { status: 400 });
  }

  try {
    const access = await getBoardAccessForUser(requesterId, boardId);
    if (!access) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    if (!access.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (userId === access.ownerId) {
      return NextResponse.json({ error: 'Cannot remove board owner from board members' }, { status: 422 });
    }

    const deletedMembers = await sqlClient`
      delete from public.board_members
      where board_id = ${boardId}::uuid
        and user_id = ${userId}::uuid
      returning user_id
    `;

    await sqlClient`
      update public.board_invites
      set status = 'revoked', decided_at = now()
      where board_id = ${boardId}::uuid
        and to_user_id = ${userId}::uuid
        and status = 'pending'
    `;

    const removedMember = Array.isArray(deletedMembers) && deletedMembers.length > 0;

    if (removedMember) {
      try {
        const boardRows = await sqlClient`
          select b.title as board_title, g.name as group_name
          from public.boards b
          join public.groups g on g.id = b.group_id
          where b.id = ${boardId}::uuid
          limit 1
        `;
        const boardInfo = Array.isArray(boardRows) && boardRows.length ? boardRows[0] : null;
        await createNotification({
          userId,
          actorUserId: requesterId,
          type: 'board_member_removed',
          title: 'Usunięto Cię z tablicy',
          message: `Tablica: ${String(boardInfo?.board_title ?? 'Tablica')} (${String(boardInfo?.group_name ?? 'Grupa')}).`,
          entityType: 'board_member',
          entityId: boardId,
          payload: {
            boardId,
            targetUserId: userId,
            action: 'removed_from_board',
          },
        });
      } catch (notificationErr) {
        console.error('board members delete notification error', notificationErr);
      }
    }

    const members = await listBoardMembers(boardId);
    return NextResponse.json({ success: true, members, removedMember });
  } catch (err) {
    console.error('board members delete error', err);
    return NextResponse.json({ error: 'Failed to remove board member' }, { status: 500 });
  }
}
