import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { sqlClient } from '@/src/db/db';

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json([], { status: 200 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  try {
    const rows = await sqlClient`
      select
        b.id,
        b.group_id,
        b.title,
        b.updated_at,
        b.details->>'archivedAt' as archived_at,
        g.name as group_name,
        g.avatar_url as group_avatar_url,
        (select count(*) from public.group_members gm2 where gm2.group_id = g.id)::int as member_count
      from public.boards b
      join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
      join public.groups g on g.id = b.group_id
      where coalesce(nullif(b.details->>'archivedAt', ''), '') <> ''
      order by coalesce((b.details->>'archivedAt')::timestamptz, b.updated_at) desc
    `;

    const data = Array.isArray(rows) ? rows : [];
    return NextResponse.json(
      data.map((row: any) => ({
        boardId: String(row.id),
        groupId: String(row.group_id),
        boardName: String(row.title ?? 'Tablica'),
        groupName: String(row.group_name ?? ''),
        groupAvatarUrl: row.group_avatar_url ?? null,
        memberCount: Number(row.member_count ?? 0),
        archivedAt: row.archived_at ?? null,
        lastActivity: row.archived_at ?? row.updated_at ?? null,
      })),
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('boards archive list error', err);
    return NextResponse.json({ error: 'Failed to fetch archived boards' }, { status: 500 });
  }
}
