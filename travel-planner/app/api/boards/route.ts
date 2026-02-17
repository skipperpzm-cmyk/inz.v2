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
        g.id as group_id,
        g.name as group_name,
        g.avatar_url as group_avatar_url,
        (select count(*) from public.group_members gm2 where gm2.group_id = g.id)::int as member_count,
        count(distinct case when bm.id is not null then b.id end)::int as board_count,
        max(case when bm.id is not null then coalesce(gp.created_at, b.updated_at, b.created_at) end) as last_activity
      from public.groups g
      join public.group_members gm on gm.group_id = g.id and gm.user_id = ${userId}
      left join public.boards b on b.group_id = g.id
      left join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
      left join public.group_posts gp on gp.board_id = b.id
      group by g.id, g.name, g.avatar_url
      order by max(coalesce(gp.created_at, b.updated_at, b.created_at, g.updated_at)) desc nulls last, g.name asc
    `;

    const data = Array.isArray(rows) ? rows : [];
    const mapped = data.map((r: any) => ({
      groupId: String(r.group_id),
      groupName: String(r.group_name ?? ''),
      groupAvatarUrl: r.group_avatar_url ?? null,
      memberCount: Number(r.member_count ?? 0),
      boardCount: Number(r.board_count ?? 0),
      lastActivity: r.last_activity ?? null,
    }));

    return NextResponse.json(mapped, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('boards list error', err);
    return NextResponse.json({ error: 'Failed to fetch boards' }, { status: 500 });
  }
}
