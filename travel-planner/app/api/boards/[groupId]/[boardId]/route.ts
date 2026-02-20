import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { sqlClient } from '@/src/db/db';

type Params = { params: Promise<{ groupId: string; boardId: string }> };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { groupId, boardId } = await context.params;
  if (!groupId || !boardId) return NextResponse.json({ error: 'Missing route params' }, { status: 400 });
  if (!UUID_RE.test(boardId)) return NextResponse.json({ error: 'Invalid board id' }, { status: 400 });

  try {
    const rows = UUID_RE.test(groupId)
      ? await sqlClient`
          select
            b.id,
            b.group_id,
            b.title,
            b.description,
            b.created_by,
            b.created_at,
            b.updated_at,
            b.location,
            b.start_date,
            b.end_date,
            b.travel_description,
            b.budget,
            b.checklist,
            b.details,
            g.name as group_name,
            g.avatar_url as group_avatar_url,
            g.created_by as owner_id,
            gm.role,
            exists (
              select 1
              from public.board_moderators bm
              where bm.board_id = b.id
                and bm.user_id = ${userId}
            ) as is_moderator
          from public.boards b
          join public.groups g on g.id = b.group_id
          join public.board_members bm_member on bm_member.board_id = b.id and bm_member.user_id = ${userId}
          left join public.group_members gm on gm.group_id = b.group_id and gm.user_id = ${userId}
          where b.id = ${boardId}::uuid and g.id = ${groupId}::uuid
          limit 1
        `
      : await sqlClient`
          select
            b.id,
            b.group_id,
            b.title,
            b.description,
            b.created_by,
            b.created_at,
            b.updated_at,
            b.location,
            b.start_date,
            b.end_date,
            b.travel_description,
            b.budget,
            b.checklist,
            b.details,
            g.name as group_name,
            g.avatar_url as group_avatar_url,
            g.created_by as owner_id,
            gm.role,
            exists (
              select 1
              from public.board_moderators bm
              where bm.board_id = b.id
                and bm.user_id = ${userId}
            ) as is_moderator
          from public.boards b
          join public.groups g on g.id = b.group_id
          join public.board_members bm_member on bm_member.board_id = b.id and bm_member.user_id = ${userId}
          left join public.group_members gm on gm.group_id = b.group_id and gm.user_id = ${userId}
          where b.id = ${boardId}::uuid and g.slug = ${groupId}
          limit 1
        `;

    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!row) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

    const checklist = Array.isArray(row.checklist) ? row.checklist.map((item: unknown) => String(item)) : [];
    const details = row.details && typeof row.details === 'object' ? row.details : {};
    const archivedAtValue = typeof (details as { archivedAt?: unknown })?.archivedAt === 'string'
      ? String((details as { archivedAt?: string }).archivedAt).trim()
      : '';
    const isArchived = archivedAtValue.length > 0;
    const isOwner = String(row.owner_id ?? '') === String(userId);
    const isModerator = Boolean(row.is_moderator);

    return NextResponse.json({
      id: String(row.id),
      groupId: String(row.group_id),
      groupName: String(row.group_name ?? ''),
      boardName: String(row.title ?? 'Tablica'),
      boardDescription: row.description ?? null,
      groupAvatarUrl: row.group_avatar_url ?? null,
      createdBy: String(row.created_by ?? ''),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      ownerId: String(row.owner_id ?? ''),
      role: row.role === 'admin' ? 'admin' : 'member',
      isOwner,
      isModerator,
      canModerate: isOwner || isModerator,
      isArchived,
      travelInfo: {
        location: row.location ?? null,
        startDate: row.start_date ?? null,
        endDate: row.end_date ?? null,
        description: row.travel_description ?? null,
        budget: row.budget != null ? Number(row.budget) : null,
        checklist,
        details,
        updatedAt: row.updated_at ?? null,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('board detail error', err);
    return NextResponse.json({ error: 'Failed to fetch board detail' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { groupId, boardId } = await context.params;
  if (!groupId || !boardId) return NextResponse.json({ error: 'Missing route params' }, { status: 400 });
  if (!UUID_RE.test(boardId)) return NextResponse.json({ error: 'Invalid board id' }, { status: 400 });

  try {
    const ownerRows = UUID_RE.test(groupId)
      ? await sqlClient`
          select g.id as group_id, g.created_by
          from public.groups g
          join public.group_members gm on gm.group_id = g.id and gm.user_id = ${userId}
          where g.id = ${groupId}::uuid
          limit 1
        `
      : await sqlClient`
          select g.id as group_id, g.created_by
          from public.groups g
          join public.group_members gm on gm.group_id = g.id and gm.user_id = ${userId}
          where g.slug = ${groupId}
          limit 1
        `;

    const owner = Array.isArray(ownerRows) && ownerRows.length ? ownerRows[0] : null;
    if (!owner) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    if (String(owner.created_by ?? '') !== String(userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const deleted = await sqlClient`
      delete from public.boards
      where id = ${boardId}::uuid and group_id = ${owner.group_id}
      returning id
    `;

    if (!Array.isArray(deleted) || deleted.length === 0) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, boardId: String(boardId) });
  } catch (err) {
    console.error('board delete error', err);
    return NextResponse.json({ error: 'Failed to delete board' }, { status: 500 });
  }
}
