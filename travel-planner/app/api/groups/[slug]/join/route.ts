import { NextResponse, NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requireDb } from '@/src/db/db';

async function findGroup(db: any, key: string) {
  const res = await (db as any).execute('select id, is_private from public.groups where id::text = $1 or slug = $1 limit 1', [key]);
  const rows = (res as any).rows ?? res;
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const params = await context.params;
  const slug = params.slug;
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  try {
    const db = requireDb();
    const group = await findGroup(db, slug);
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
