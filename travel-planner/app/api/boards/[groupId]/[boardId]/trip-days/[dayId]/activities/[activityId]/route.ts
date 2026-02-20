import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { sqlClient } from '@/src/db/db';

type Params = { params: Promise<{ groupId: string; boardId: string; dayId: string; activityId: string }> };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BoardAccess = {
  boardId: string;
  isMember: boolean;
  canModerate: boolean;
  isArchived: boolean;
};

async function resolveBoardAccess(userId: string, groupIdOrSlug: string, boardId: string): Promise<BoardAccess | null> {
  if (!sqlClient || !UUID_RE.test(boardId)) return null;

  const rows = UUID_RE.test(groupIdOrSlug)
    ? await sqlClient`
        select
          b.id as board_id,
          coalesce(nullif(b.details->>'archivedAt', ''), '') <> '' as is_archived,
          exists (select 1 from public.board_members bm where bm.board_id = b.id and bm.user_id = ${userId}) as is_member,
          (
            g.created_by = ${userId}::uuid
            or exists (select 1 from public.board_moderators mod where mod.board_id = b.id and mod.user_id = ${userId})
          ) as can_moderate
        from public.boards b
        join public.groups g on g.id = b.group_id
        where b.id = ${boardId}::uuid and g.id = ${groupIdOrSlug}::uuid
        limit 1
      `
    : await sqlClient`
        select
          b.id as board_id,
          coalesce(nullif(b.details->>'archivedAt', ''), '') <> '' as is_archived,
          exists (select 1 from public.board_members bm where bm.board_id = b.id and bm.user_id = ${userId}) as is_member,
          (
            g.created_by = ${userId}::uuid
            or exists (select 1 from public.board_moderators mod where mod.board_id = b.id and mod.user_id = ${userId})
          ) as can_moderate
        from public.boards b
        join public.groups g on g.id = b.group_id
        where b.id = ${boardId}::uuid and g.slug = ${groupIdOrSlug}
        limit 1
      `;

  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  if (!row) return null;

  return {
    boardId: String((row as any).board_id),
    isMember: Boolean((row as any).is_member),
    canModerate: Boolean((row as any).can_moderate),
    isArchived: Boolean((row as any).is_archived),
  };
}

async function activityBelongsToBoard(activityId: string, dayId: string, boardId: string) {
  if (!sqlClient) return false;
  const rows = await sqlClient`
    select 1
    from public.board_trip_activities a
    join public.board_trip_days d on d.id = a.day_id
    where a.id = ${activityId}::uuid
      and a.day_id = ${dayId}::uuid
      and d.board_id = ${boardId}::uuid
    limit 1
  `;
  return Array.isArray(rows) && rows.length > 0;
}

export async function PATCH(request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { groupId, boardId, dayId, activityId } = await context.params;
  if (!groupId || !boardId || !dayId || !activityId) {
    return NextResponse.json({ error: 'Missing route params' }, { status: 400 });
  }
  if (!UUID_RE.test(dayId) || !UUID_RE.test(activityId)) {
    return NextResponse.json({ error: 'Invalid route params' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const payload = (body ?? {}) as { time?: unknown; title?: unknown; description?: unknown; cost?: unknown };

  try {
    const access = await resolveBoardAccess(userId, groupId, boardId);
    if (!access) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    if (!access.isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (access.isArchived) return NextResponse.json({ error: 'Archived board is read-only' }, { status: 409 });
    if (!access.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const belongs = await activityBelongsToBoard(activityId, dayId, access.boardId);
    if (!belongs) return NextResponse.json({ error: 'Activity not found' }, { status: 404 });

    const title = typeof payload.title === 'string' ? payload.title.trim().slice(0, 160) : '';
    if (!title) return NextResponse.json({ error: 'Activity title is required' }, { status: 400 });
    const time = typeof payload.time === 'string' ? payload.time.trim().slice(0, 32) : null;
    const description = typeof payload.description === 'string' ? payload.description.trim().slice(0, 2000) : null;
    const parsedCost = payload.cost == null || payload.cost === '' ? null : Number(payload.cost);
    const cost = parsedCost == null ? null : Number.isFinite(parsedCost) ? parsedCost : null;

    const updated = await sqlClient`
      update public.board_trip_activities
      set
        time = ${time},
        title = ${title},
        description = ${description},
        cost = ${cost},
        updated_at = now()
      where id = ${activityId}::uuid
        and day_id = ${dayId}::uuid
      returning id
    `;

    if (!Array.isArray(updated) || updated.length === 0) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('trip activity update error', err);
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { groupId, boardId, dayId, activityId } = await context.params;
  if (!groupId || !boardId || !dayId || !activityId) {
    return NextResponse.json({ error: 'Missing route params' }, { status: 400 });
  }
  if (!UUID_RE.test(dayId) || !UUID_RE.test(activityId)) {
    return NextResponse.json({ error: 'Invalid route params' }, { status: 400 });
  }

  try {
    const access = await resolveBoardAccess(userId, groupId, boardId);
    if (!access) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    if (!access.isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (access.isArchived) return NextResponse.json({ error: 'Archived board is read-only' }, { status: 409 });
    if (!access.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const belongs = await activityBelongsToBoard(activityId, dayId, access.boardId);
    if (!belongs) return NextResponse.json({ error: 'Activity not found' }, { status: 404 });

    const deleted = await sqlClient`
      delete from public.board_trip_activities
      where id = ${activityId}::uuid
        and day_id = ${dayId}::uuid
      returning id
    `;

    if (!Array.isArray(deleted) || deleted.length === 0) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('trip activity delete error', err);
    return NextResponse.json({ error: 'Failed to delete activity' }, { status: 500 });
  }
}
