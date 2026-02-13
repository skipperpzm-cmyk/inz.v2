import { NextResponse, NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requireDb } from '@/src/db/db';

async function findGroup(db: any, key: string) {
  const res = await (db as any).execute('select id from public.groups where id::text = $1 or slug = $1 limit 1', [key]);
  const rows = (res as any).rows ?? res;
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const params = await context.params;
  const slug = params.slug;
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  let body: any = {};
  try { body = await request.json(); } catch (err) { /* ignore */ }
  const targetUserId = body?.userId;
  if (!targetUserId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  try {
      const db = requireDb();
    const group = await findGroup(db, slug);
    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

    // Ensure requester is admin of group
      const adminCheck = await (db as any).execute('select 1 from public.group_members where group_id = $1 and user_id = $2 and role = $3 limit 1', [group.id, user.id, 'admin']);
      const adminRows = (adminCheck as any).rows ?? adminCheck;
    if (!Array.isArray(adminRows) || adminRows.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      await (db as any).execute('delete from public.group_members where group_id = $1 and user_id = $2', [group.id, targetUserId]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('remove member error', err);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
