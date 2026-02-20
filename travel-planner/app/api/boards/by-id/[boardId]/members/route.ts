import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { sqlClient } from '@/src/db/db';
import { createNotification } from '@/src/db/repositories/notifications.repository';
import {
  getBoardAccessForUser,
  isBoardMember,
  isBoardGroupMember,
  listBoardMembers,
  UUID_RE,
} from '../../../_lib/moderation';

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

    const members = await listBoardMembers(boardId);
    return NextResponse.json({ members }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('board members get error', err);
    return NextResponse.json({ error: 'Failed to fetch board members' }, { status: 500 });
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
    if (!access.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (targetUserId === userId) {
      return NextResponse.json({ error: 'Nie możesz zaprosić samego siebie.' }, { status: 422 });
    }

    const targetIsGroupMember = await isBoardGroupMember(boardId, targetUserId);
    if (!targetIsGroupMember) {
      return NextResponse.json({ error: 'Target user is not a group member' }, { status: 422 });
    }

    const alreadyMember = await isBoardMember(boardId, targetUserId);
    if (alreadyMember) {
      return NextResponse.json({ error: 'Użytkownik jest już członkiem tablicy.' }, { status: 409 });
    }

    const pendingRows = await sqlClient`
      select id
      from public.board_invites
      where board_id = ${boardId}::uuid
        and to_user_id = ${targetUserId}::uuid
        and status = 'pending'
      limit 1
    `;

    let inviteId = '';
    if (Array.isArray(pendingRows) && pendingRows.length > 0) {
      inviteId = String(pendingRows[0].id);
    } else {
      const insertedRows = await sqlClient`
        insert into public.board_invites (board_id, from_user_id, to_user_id, status)
        values (${boardId}::uuid, ${userId}::uuid, ${targetUserId}::uuid, 'pending')
        returning id
      `;
      inviteId = Array.isArray(insertedRows) && insertedRows.length > 0 ? String(insertedRows[0].id) : '';
    }

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
        type: 'board_invite',
        title: 'Zaproszenie do tablicy',
        message: `Tablica: ${String(boardInfo?.board_title ?? 'Tablica')} (${String(boardInfo?.group_name ?? 'Grupa')}).`,
        entityType: 'board_invite',
        entityId: boardId,
        payload: {
          inviteId,
          boardId,
          targetUserId,
          action: 'invite_to_board',
        },
      });
    } catch (notificationErr) {
      console.error('board members create notification error', notificationErr);
    }

    const members = await listBoardMembers(boardId);
    return NextResponse.json({ success: true, members, inviteId });
  } catch (err) {
    console.error('board members create error', err);
    return NextResponse.json({ error: 'Failed to add board member' }, { status: 500 });
  }
}
