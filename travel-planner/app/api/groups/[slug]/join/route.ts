import { NextResponse, NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requireDb } from '@/src/db/db';

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const params = await context.params;
  const slug = params.slug;
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  try {
    const db = requireDb();
    const groupRes = await (db as any).execute('select id, is_private from public.groups where slug = $1 limit 1', [slug]);
    const groupRows = (groupRes as any).rows ?? groupRes;
    const group = Array.isArray(groupRows) && groupRows.length ? groupRows[0] : null;
    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

    if (group.is_private) return NextResponse.json({ error: 'Cannot join private group' }, { status: 403 });

    // Insert membership as member; prevent duplicates
    await (db as any).execute(
      `insert into public.group_members (group_id, user_id, role, joined_at)
       values ($1, $2, 'member', now())
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [group.id, user.id]
    );

    // Return the inserted (or existing) member with profile info
    const memberRes = await (db as any).execute(
      `select gm.user_id as id, gm.role, p.username, p.full_name, p.avatar_url
       from public.group_members gm
       join public.profiles p on p.id = gm.user_id
       where gm.group_id = $1 and gm.user_id = $2 limit 1`,
      [group.id, user.id]
    );
    const memberRows = (memberRes as any).rows ?? memberRes;
    const member = Array.isArray(memberRows) && memberRows.length ? memberRows[0] : null;

    return NextResponse.json({ member });
  } catch (err) {
    console.error('join group error', err);
    return NextResponse.json({ error: 'Failed to join group' }, { status: 500 });
  }
}
