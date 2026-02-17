import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { sqlClient } from '@/src/db/db';
import { createNotification } from '@/src/db/repositories/notifications.repository';
import { getBoardAccessForUser, isBoardGroupMember, listBoardModerators, UUID_RE } from '../../../../_lib/moderation';

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
    if (!access.isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (userId === access.ownerId) {
      return NextResponse.json({ error: 'Cannot remove owner from moderators' }, { status: 422 });
    }

    const targetIsMember = await isBoardGroupMember(boardId, userId);
    if (!targetIsMember) {
      return NextResponse.json({ error: 'Target user is not a group member' }, { status: 422 });
    }

    await sqlClient`
      delete from public.board_moderators
      where board_id = ${boardId}::uuid
        and user_id = ${userId}::uuid
    `;

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
        type: 'board_moderator_revoked',
        title: 'Usunięto Ci uprawnienia moderatora',
        message: `Tablica: ${String(boardInfo?.board_title ?? 'Tablica')} (${String(boardInfo?.group_name ?? 'Grupa')}).`,
        entityType: 'board_moderator',
        entityId: boardId,
        payload: {
          boardId,
          targetUserId: userId,
          action: 'moderator_revoked',
        },
      });
    } catch (notificationErr) {
      console.error('board moderators delete notification error', notificationErr);
    }

    const moderators = await listBoardModerators(boardId);
    return NextResponse.json({ success: true, moderators });
  } catch (err) {
    console.error('board moderators delete error', err);
    return NextResponse.json({ error: 'Failed to remove board moderator' }, { status: 500 });
  }
}
