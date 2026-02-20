import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { sqlClient } from '@/src/db/db';
import { createNotification } from '@/src/db/repositories/notifications.repository';
import { getBoardAccessForUser, isBoardGroupMember, listBoardModerators, UUID_RE } from '../../../_lib/moderation';

type Params = { params: Promise<{ boardId: string }> };

export async function GET(_request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { boardId } = await context.params;
  if (!boardId) return NextResponse.json({ error: 'Missing board id' }, { status: 400 });
  if (!UUID_RE.test(boardId)) return NextResponse.json({ error: 'Invalid board id' }, { status: 400 });

  try {
    const access = await getBoardAccessForUser(userId, boardId);
    if (!access) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    if (!access.isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const moderators = await listBoardModerators(boardId);
    return NextResponse.json({ moderators }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('board moderators get error', err);
    return NextResponse.json({ error: 'Failed to fetch board moderators' }, { status: 500 });
  }
}

export async function POST(request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { boardId } = await context.params;
  if (!boardId) return NextResponse.json({ error: 'Missing board id' }, { status: 400 });
  if (!UUID_RE.test(boardId)) return NextResponse.json({ error: 'Invalid board id' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const targetUserId = typeof (body as { userId?: unknown })?.userId === 'string'
    ? (body as { userId: string }).userId
    : '';
  if (!UUID_RE.test(targetUserId)) {
    return NextResponse.json({ error: 'Invalid target user id' }, { status: 400 });
  }

  try {
    const access = await getBoardAccessForUser(userId, boardId);
    if (!access) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    if (access.isArchived) return NextResponse.json({ error: 'Archived board is read-only' }, { status: 409 });
    if (!access.isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (targetUserId === access.ownerId) {
      return NextResponse.json({ error: 'Owner cannot be assigned as moderator' }, { status: 422 });
    }

    const targetIsMember = await isBoardGroupMember(boardId, targetUserId);
    if (!targetIsMember) {
      return NextResponse.json({ error: 'Target user is not a group member' }, { status: 422 });
    }

    await sqlClient`
      insert into public.board_moderators (board_id, user_id, assigned_by)
      values (${boardId}::uuid, ${targetUserId}::uuid, ${userId}::uuid)
      on conflict (board_id, user_id) do nothing
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
        userId: targetUserId,
        actorUserId: userId,
        type: 'board_moderator_granted',
        title: 'Nadano Ci uprawnienia moderatora',
        message: `Tablica: ${String(boardInfo?.board_title ?? 'Tablica')} (${String(boardInfo?.group_name ?? 'Grupa')}).`,
        entityType: 'board_moderator',
        entityId: boardId,
        payload: {
          boardId,
          targetUserId,
          action: 'moderator_granted',
        },
      });
    } catch (notificationErr) {
      console.error('board moderators create notification error', notificationErr);
    }

    const moderators = await listBoardModerators(boardId);
    return NextResponse.json({ success: true, moderators });
  } catch (err) {
    console.error('board moderators create error', err);
    return NextResponse.json({ error: 'Failed to add board moderator' }, { status: 500 });
  }
}
