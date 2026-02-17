import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { sqlClient } from '@/src/db/db';

type Params = { params: Promise<{ groupId: string }> };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { groupId } = await context.params;
  if (!groupId) return NextResponse.json({ error: 'Missing group id' }, { status: 400 });

  try {
    const membershipRows = UUID_RE.test(groupId)
      ? await sqlClient`
          select g.id as group_id, g.name as group_name, g.avatar_url as group_avatar_url, g.created_by as owner_id, gm.role
          from public.groups g
          join public.group_members gm on gm.group_id = g.id and gm.user_id = ${userId}
          where g.id = ${groupId}::uuid
          limit 1
        `
      : await sqlClient`
          select g.id as group_id, g.name as group_name, g.avatar_url as group_avatar_url, g.created_by as owner_id, gm.role
          from public.groups g
          join public.group_members gm on gm.group_id = g.id and gm.user_id = ${userId}
          where g.slug = ${groupId}
          limit 1
        `;

    const member = Array.isArray(membershipRows) && membershipRows.length ? membershipRows[0] : null;
    if (!member) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

    const boardsRows = await sqlClient`
      select
        b.id,
        b.group_id,
        b.title,
        b.description,
        b.created_by,
        b.created_at,
        b.updated_at,
        coalesce(nullif(u.username_display, ''), nullif(p.full_name, ''), p.username, 'Użytkownik') as created_by_name,
        coalesce(nullif(u.avatar_url, ''), nullif(p.avatar_url, '')) as created_by_avatar_url,
        (select count(*) from public.group_posts gp where gp.board_id = b.id)::int as post_count,
        (select max(gp.created_at) from public.group_posts gp where gp.board_id = b.id) as last_activity
      from public.boards b
      join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
      left join public.profiles p on p.id = b.created_by
      left join public.users u on u.id = b.created_by
      where b.group_id = ${member.group_id}
      order by coalesce((select max(gp.created_at) from public.group_posts gp where gp.board_id = b.id), b.updated_at, b.created_at) desc nulls last, b.created_at desc
    `;

    return NextResponse.json(
      {
        groupId: String(member.group_id),
        groupName: String(member.group_name ?? ''),
        groupAvatarUrl: member.group_avatar_url ?? null,
        ownerId: String(member.owner_id ?? ''),
        role: member.role === 'admin' ? 'admin' : 'member',
        canCreate: String(member.owner_id ?? '') === String(userId),
        boards: (Array.isArray(boardsRows) ? boardsRows : []).map((row: any) => ({
          id: String(row.id),
          groupId: String(row.group_id),
          title: String(row.title ?? 'Tablica'),
          description: row.description ?? null,
          createdAt: String(row.created_at),
          updatedAt: String(row.updated_at),
          createdBy: String(row.created_by ?? ''),
          createdByName: String(row.created_by_name ?? 'Użytkownik'),
          createdByAvatarUrl: row.created_by_avatar_url ?? null,
          postCount: Number(row.post_count ?? 0),
          lastActivity: row.last_activity ?? row.updated_at ?? row.created_at,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('group boards list error', err);
    return NextResponse.json({ error: 'Failed to fetch group boards' }, { status: 500 });
  }
}

export async function POST(request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { groupId } = await context.params;
  if (!groupId) return NextResponse.json({ error: 'Missing group id' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const payload = (body ?? {}) as { title?: unknown; description?: unknown };
  const title = typeof payload.title === 'string' ? payload.title.trim().slice(0, 120) : '';
  const description = typeof payload.description === 'string' ? payload.description.trim().slice(0, 5000) : '';

  try {
    const membershipRows = UUID_RE.test(groupId)
      ? await sqlClient`
          select g.id as group_id, g.name as group_name, g.created_by, gm.role
          from public.groups g
          join public.group_members gm on gm.group_id = g.id and gm.user_id = ${userId}
          where g.id = ${groupId}::uuid
          limit 1
        `
      : await sqlClient`
          select g.id as group_id, g.name as group_name, g.created_by, gm.role
          from public.groups g
          join public.group_members gm on gm.group_id = g.id and gm.user_id = ${userId}
          where g.slug = ${groupId}
          limit 1
        `;

    const member = Array.isArray(membershipRows) && membershipRows.length ? membershipRows[0] : null;
    if (!member) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    if (String(member.created_by ?? '') !== String(userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const createdRows = await sqlClient`
      insert into public.boards (
        group_id,
        title,
        description,
        created_by,
        location,
        start_date,
        end_date,
        travel_description,
        budget,
        checklist,
        details,
        updated_at
      )
      values (
        ${member.group_id},
        ${title || `Tablica ${new Date().toLocaleDateString('pl-PL')}`},
        ${description || null},
        ${userId},
        null,
        null,
        null,
        null,
        null,
        '[]'::jsonb,
        '{}'::jsonb,
        now()
      )
      returning id, group_id, title, description, created_by, created_at, updated_at
    `;

    const row = Array.isArray(createdRows) && createdRows.length ? createdRows[0] : null;
    if (!row) return NextResponse.json({ error: 'Failed to create board' }, { status: 500 });

    return NextResponse.json({
      board: {
        id: String(row.id),
        groupId: String(row.group_id),
        title: String(row.title ?? 'Tablica'),
        description: row.description ?? null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        createdBy: String(row.created_by ?? userId),
        createdByName: 'Ty',
        createdByAvatarUrl: null,
        postCount: 0,
        lastActivity: row.created_at,
      },
    });
  } catch (err) {
    console.error('group board create error', err);
    return NextResponse.json({ error: 'Failed to create board' }, { status: 500 });
  }
}
