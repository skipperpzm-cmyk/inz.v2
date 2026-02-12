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
    const groupRes = await (db as any).execute('select id from public.groups where slug = $1 limit 1', [slug]);
    const groupRows = (groupRes as any).rows ?? groupRes;
    const group = Array.isArray(groupRows) && groupRows.length ? groupRows[0] : null;
    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    // Check if user is admin and whether they are the last admin
    const roleRes = await (db as any).execute('select role from public.group_members where group_id = $1 and user_id = $2 limit 1', [group.id, user.id]);
    const roleRows = (roleRes as any).rows ?? roleRes;
    const roleRow = Array.isArray(roleRows) && roleRows.length ? roleRows[0] : null;
    const myRole = roleRow ? String(roleRow.role) : null;

    if (myRole === 'admin') {
      const adminsRes = await (db as any).execute('select count(*) as cnt from public.group_members where group_id = $1 and role = $2', [group.id, 'admin']);
      const adminsRows = (adminsRes as any).rows ?? adminsRes;
      const cnt = adminsRows && Array.isArray(adminsRows) && adminsRows.length ? Number(adminsRows[0].cnt ?? adminsRows[0].count ?? 0) : 0;
      if (cnt <= 1) {
        return NextResponse.json({ error: 'Cannot leave group as the last admin' }, { status: 400 });
      }
    }

    await (db as any).execute('delete from public.group_members where group_id = $1 and user_id = $2', [group.id, user.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('leave group error', err);
    return NextResponse.json({ error: 'Failed to leave group' }, { status: 500 });
  }
}
