import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { sqlClient } from '@/src/db/db';

type Params = { params: Promise<{ groupId: string; boardId: string }> };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type BoardAccess = {
  boardId: string;
  groupId: string;
  ownerId: string;
  isMember: boolean;
  isOwner: boolean;
  isModerator: boolean;
  canModerate: boolean;
  isArchived: boolean;
};

async function resolveBoardAccess(userId: string, groupIdOrSlug: string, boardId: string): Promise<BoardAccess | null> {
  if (!sqlClient || !UUID_RE.test(boardId)) return null;

  const rows = UUID_RE.test(groupIdOrSlug)
    ? await sqlClient`
        select
          b.id as board_id,
          b.group_id,
          g.created_by as owner_id,
          coalesce(nullif(b.details->>'archivedAt', ''), '') <> '' as is_archived,
          exists (
            select 1 from public.board_members bm
            where bm.board_id = b.id and bm.user_id = ${userId}
          ) as is_member,
          exists (
            select 1 from public.board_moderators mod
            where mod.board_id = b.id and mod.user_id = ${userId}
          ) as is_moderator
        from public.boards b
        join public.groups g on g.id = b.group_id
        where b.id = ${boardId}::uuid
          and g.id = ${groupIdOrSlug}::uuid
        limit 1
      `
    : await sqlClient`
        select
          b.id as board_id,
          b.group_id,
          g.created_by as owner_id,
          coalesce(nullif(b.details->>'archivedAt', ''), '') <> '' as is_archived,
          exists (
            select 1 from public.board_members bm
            where bm.board_id = b.id and bm.user_id = ${userId}
          ) as is_member,
          exists (
            select 1 from public.board_moderators mod
            where mod.board_id = b.id and mod.user_id = ${userId}
          ) as is_moderator
        from public.boards b
        join public.groups g on g.id = b.group_id
        where b.id = ${boardId}::uuid
          and g.slug = ${groupIdOrSlug}
        limit 1
      `;

  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  if (!row) return null;

  const ownerId = String(row.owner_id ?? '');
  const isOwner = ownerId === userId;
  const isModerator = Boolean(row.is_moderator);

  return {
    boardId: String(row.board_id),
    groupId: String(row.group_id),
    ownerId,
    isMember: Boolean(row.is_member),
    isOwner,
    isModerator,
    canModerate: isOwner || isModerator,
    isArchived: Boolean((row as any).is_archived),
  };
}

async function listTripDays(boardId: string) {
  if (!sqlClient) return [] as any[];

  const daysRows = await sqlClient`
    select
      d.id,
      d.board_id,
      d.day_number,
      d.title,
      d.date,
      d.location,
      d.description,
      d.accommodation,
      d.estimated_budget,
      d.created_at,
      d.updated_at
    from public.board_trip_days d
    where d.board_id = ${boardId}::uuid
    order by d.day_number asc, d.created_at asc, d.id asc
  `;

  const activitiesRows = await sqlClient`
    select
      a.id,
      a.day_id,
      a.time,
      a.title,
      a.description,
      a.cost,
      a.created_at,
      a.updated_at
    from public.board_trip_activities a
    join public.board_trip_days d on d.id = a.day_id
    where d.board_id = ${boardId}::uuid
    order by a.created_at asc, a.id asc
  `;

  const activityByDay = new Map<string, any[]>();
  for (const row of Array.isArray(activitiesRows) ? activitiesRows : []) {
    const dayId = String((row as any).day_id);
    const current = activityByDay.get(dayId) ?? [];
    current.push({
      id: String((row as any).id),
      dayId,
      time: (row as any).time ?? null,
      title: String((row as any).title ?? ''),
      description: (row as any).description ?? null,
      cost: (row as any).cost != null ? Number((row as any).cost) : null,
      createdAt: String((row as any).created_at),
      updatedAt: String((row as any).updated_at),
    });
    activityByDay.set(dayId, current);
  }

  return (Array.isArray(daysRows) ? daysRows : []).map((row: any) => {
    const id = String(row.id);
    return {
      id,
      boardId: String(row.board_id),
      dayNumber: Number(row.day_number ?? 0),
      title: row.title ?? null,
      date: row.date ?? null,
      location: row.location ?? null,
      description: row.description ?? null,
      accommodation: row.accommodation ?? null,
      estimatedBudget: row.estimated_budget != null ? Number(row.estimated_budget) : null,
      activities: activityByDay.get(id) ?? [],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  });
}

export async function GET(_request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { groupId, boardId } = await context.params;
  if (!groupId || !boardId) return NextResponse.json({ error: 'Missing route params' }, { status: 400 });

  try {
    const access = await resolveBoardAccess(userId, groupId, boardId);
    if (!access) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    if (!access.isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const tripDays = await listTripDays(access.boardId);
    return NextResponse.json({ tripDays }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('trip days list error', err);
    return NextResponse.json({ error: 'Failed to fetch trip days' }, { status: 500 });
  }
}

export async function POST(request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { groupId, boardId } = await context.params;
  if (!groupId || !boardId) return NextResponse.json({ error: 'Missing route params' }, { status: 400 });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const payload = (body ?? {}) as {
    title?: unknown;
    date?: unknown;
    location?: unknown;
    description?: unknown;
    accommodation?: unknown;
    estimatedBudget?: unknown;
  };

  try {
    const access = await resolveBoardAccess(userId, groupId, boardId);
    if (!access) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    if (!access.isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (access.isArchived) return NextResponse.json({ error: 'Archived board is read-only' }, { status: 409 });
    if (!access.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const nextRows = await sqlClient`
      select coalesce(max(day_number), 0)::int + 1 as next_day
      from public.board_trip_days
      where board_id = ${access.boardId}::uuid
    `;

    const nextDay = Number((Array.isArray(nextRows) && nextRows.length ? (nextRows[0] as any).next_day : 1) ?? 1);
    const date = typeof payload.date === 'string' && DATE_RE.test(payload.date) ? payload.date : null;
    const title = typeof payload.title === 'string' ? payload.title.trim().slice(0, 140) : null;
    const location = typeof payload.location === 'string' ? payload.location.trim().slice(0, 300) : null;
    const description = typeof payload.description === 'string' ? payload.description.trim().slice(0, 5000) : null;
    const accommodation = typeof payload.accommodation === 'string' ? payload.accommodation.trim().slice(0, 300) : null;
    const parsedBudget = payload.estimatedBudget == null || payload.estimatedBudget === '' ? null : Number(payload.estimatedBudget);
    const estimatedBudget = parsedBudget == null ? null : Number.isFinite(parsedBudget) ? parsedBudget : null;

    await sqlClient`
      insert into public.board_trip_days (
        board_id,
        day_number,
        title,
        date,
        location,
        description,
        accommodation,
        estimated_budget
      )
      values (
        ${access.boardId}::uuid,
        ${nextDay},
        ${title},
        ${date},
        ${location},
        ${description},
        ${accommodation},
        ${estimatedBudget}
      )
    `;

    const tripDays = await listTripDays(access.boardId);
    return NextResponse.json({ success: true, tripDays });
  } catch (err) {
    console.error('trip day create error', err);
    return NextResponse.json({ error: 'Failed to create trip day' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { groupId, boardId } = await context.params;
  if (!groupId || !boardId) return NextResponse.json({ error: 'Missing route params' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const dayIds = Array.isArray((body as { dayIds?: unknown })?.dayIds)
    ? ((body as { dayIds: unknown[] }).dayIds).filter((id): id is string => typeof id === 'string' && UUID_RE.test(id))
    : [];

  if (dayIds.length === 0) {
    return NextResponse.json({ error: 'Missing dayIds' }, { status: 400 });
  }

  try {
    const access = await resolveBoardAccess(userId, groupId, boardId);
    if (!access) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    if (!access.isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (access.isArchived) return NextResponse.json({ error: 'Archived board is read-only' }, { status: 409 });
    if (!access.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const existingRows = await sqlClient`
      select id
      from public.board_trip_days
      where board_id = ${access.boardId}::uuid
    `;

    const existingIds = new Set((Array.isArray(existingRows) ? existingRows : []).map((row: any) => String(row.id)));
    if (existingIds.size !== dayIds.length || dayIds.some((id) => !existingIds.has(id))) {
      return NextResponse.json({ error: 'Invalid dayIds payload' }, { status: 422 });
    }

    for (let index = 0; index < dayIds.length; index += 1) {
      const id = dayIds[index];
      await sqlClient`
        update public.board_trip_days
        set day_number = ${index + 1}
        where board_id = ${access.boardId}::uuid
          and id = ${id}::uuid
      `;
    }

    const tripDays = await listTripDays(access.boardId);
    return NextResponse.json({ success: true, tripDays });
  } catch (err) {
    console.error('trip day reorder error', err);
    return NextResponse.json({ error: 'Failed to reorder trip days' }, { status: 500 });
  }
}
