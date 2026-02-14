import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionCookieName } from '@/lib/auth';
import { sqlClient } from '@/src/db/db';

type Params = { params: Promise<{ groupId: string }> };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: Params) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(getSessionCookieName())?.value;
  if (!sessionToken) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { groupId } = await context.params;
  if (!groupId) return NextResponse.json({ error: 'Missing group id' }, { status: 400 });

  try {
    const rows = UUID_RE.test(groupId)
      ? await sqlClient`
          select
            g.id as group_id,
            g.name as group_name,
            g.avatar_url as group_avatar_url,
            g.created_by as owner_id,
            gm.role,
            gb.location,
            gb.start_date,
            gb.end_date,
            gb.description,
            gb.budget,
            gb.checklist,
            gb.updated_at
          from public.sessions s
          join public.group_members gm on gm.user_id = s.user_id
          join public.groups g on g.id = gm.group_id
          left join public.group_boards gb on gb.group_id = g.id
          where s.session_token = ${sessionToken}
            and (s.expires_at is null or s.expires_at > now())
            and g.id = ${groupId}::uuid
          limit 1
        `
      : await sqlClient`
          select
            g.id as group_id,
            g.name as group_name,
            g.avatar_url as group_avatar_url,
            g.created_by as owner_id,
            gm.role,
            gb.location,
            gb.start_date,
            gb.end_date,
            gb.description,
            gb.budget,
            gb.checklist,
            gb.updated_at
          from public.sessions s
          join public.group_members gm on gm.user_id = s.user_id
          join public.groups g on g.id = gm.group_id
          left join public.group_boards gb on gb.group_id = g.id
          where s.session_token = ${sessionToken}
            and (s.expires_at is null or s.expires_at > now())
            and g.slug = ${groupId}
          limit 1
        `;

    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!row) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

    return NextResponse.json(
      {
        groupId: String(row.group_id),
        groupName: String(row.group_name ?? ''),
        groupAvatarUrl: row.group_avatar_url ?? null,
        ownerId: String(row.owner_id ?? ''),
        role: row.role === 'admin' ? 'admin' : 'member',
        travelInfo: {
          location: row.location ?? null,
          startDate: row.start_date ?? null,
          endDate: row.end_date ?? null,
          description: row.description ?? null,
          budget: row.budget != null ? Number(row.budget) : null,
          checklist: Array.isArray(row.checklist) ? row.checklist : [],
          updatedAt: row.updated_at ?? null,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('board detail error', err);
    return NextResponse.json({ error: 'Failed to fetch board detail' }, { status: 500 });
  }
}
