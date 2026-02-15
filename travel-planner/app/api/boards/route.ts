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
        coalesce(nullif(gb.board_name, ''), g.name) as board_name,
        g.avatar_url as group_avatar_url,
        (select count(*) from public.group_members gm2 where gm2.group_id = g.id)::int as member_count,
        gb.updated_at as board_updated_at,
        (select max(gp.created_at) from public.group_posts gp where gp.group_id = g.id) as last_post_at,
        0::int as new_posts_count
      from public.groups g
      join public.group_members gm on gm.group_id = g.id and gm.user_id = ${userId}
      left join public.group_boards gb on gb.group_id = g.id
      order by coalesce((select max(gp.created_at) from public.group_posts gp where gp.group_id = g.id), gb.updated_at, g.updated_at) desc nulls last, g.name asc
    `;

    const data = Array.isArray(rows) ? rows : [];
    const mapped = data.map((r: any) => ({
      groupId: String(r.group_id),
      groupName: String(r.group_name ?? ''),
      boardName: String(r.board_name ?? r.group_name ?? ''),
      groupAvatarUrl: r.group_avatar_url ?? null,
      memberCount: Number(r.member_count ?? 0),
      lastActivity: r.last_post_at ?? r.board_updated_at ?? null,
      newPostsCount: Number(r.new_posts_count ?? 0),
    }));

    return NextResponse.json(mapped, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('boards list error', err);
    return NextResponse.json({ error: 'Failed to fetch boards' }, { status: 500 });
  }
}
