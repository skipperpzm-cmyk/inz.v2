import { NextResponse, NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requireDb } from '@/src/db/db';
function isValidPublicId(value: string) {
  return /^\d{8}$/.test(value);
}

async function findGroup(db: any, key: string) {
  const res = await (db as any).execute(
    'select id from public.groups where id::text = $1 or slug = $1 limit 1',
    [key]
  );
  const rows = (res as any).rows ?? res;
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const params = await context.params;
  const slug = params.slug;
  let body: any = {};
  try { body = await request.json(); } catch (e) { /* ignore */ }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  const publicId = typeof body?.publicId === 'string' ? body.publicId.trim() : '';
  if (!publicId || !isValidPublicId(publicId)) return NextResponse.json({ error: 'Invalid public ID' }, { status: 400 });

  try {
    const db = requireDb();
    // Find group by id or slug
    const group = await findGroup(db, slug);
    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

      // Ensure requester is admin
      const adminCheck = await (db as any).execute('select 1 from public.group_members where group_id = $1 and user_id = $2 and role = $3 limit 1', [group.id, user.id, 'admin']);
      const adminRows = (adminCheck as any).rows ?? adminCheck;
      if (!Array.isArray(adminRows) || adminRows.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      // Lookup user by public ID in profiles
      const userRes = await (db as any).execute('select id from public.profiles where public_id = $1 limit 1', [publicId]);
      const userRows = (userRes as any).rows ?? userRes;
      const target = Array.isArray(userRows) && userRows.length ? userRows[0] : null;
      const targetId: string | null = target ? target.id : null;
      if (!targetId) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      // Ensure target is a friend of current user
      const friendCheck = await (db as any).execute(
        'select 1 from public.user_friends where user_id = $1 and friend_id = $2 limit 1',
        [user.id, targetId]
      );
      const friendRows = (friendCheck as any).rows ?? friendCheck;
      if (!Array.isArray(friendRows) || friendRows.length === 0) {
        return NextResponse.json({ error: 'User is not your friend' }, { status: 403 });
      }

      // Check existing membership
      const memCheck = await (db as any).execute('select 1 from public.group_members where group_id = $1 and user_id = $2 limit 1', [group.id, targetId]);
      const memRows = (memCheck as any).rows ?? memCheck;
      if (Array.isArray(memRows) && memRows.length) return NextResponse.json({ error: 'User already a member' }, { status: 400 });

      // Insert invite as pending (ignore duplicates)
      await (db as any).execute(
        `insert into public.group_invites (group_id, from_user_id, to_user_id, status, created_at)
         values ($1, $2, $3, 'pending', now())
         on conflict do nothing`,
        [group.id, user.id, targetId]
      );

    return NextResponse.json({ invited: true });
  } catch (err) {
    console.error('invite group member error', err);
    return NextResponse.json({ error: 'Failed to invite member' }, { status: 500 });
  }
}
