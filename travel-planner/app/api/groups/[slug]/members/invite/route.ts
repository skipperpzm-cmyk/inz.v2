import { NextResponse, NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requireDb } from '@/src/db/db';
import { getServiceSupabase } from '@/lib/supabaseClient';

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const params = await context.params;
  const slug = params.slug;
  let body: any = {};
  try { body = await request.json(); } catch (e) { /* ignore */ }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !isValidEmail(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });

    try {
      const db = requireDb();
      // Find group
      const groupRes = await (db as any).execute('select id from public.groups where slug = $1 limit 1', [slug]);
      const groupRows = (groupRes as any).rows ?? groupRes;
      const group = Array.isArray(groupRows) && groupRows.length ? groupRows[0] : null;
      if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

      // Ensure requester is admin
      const adminCheck = await (db as any).execute('select 1 from public.group_members where group_id = $1 and user_id = $2 and role = $3 limit 1', [group.id, user.id, 'admin']);
      const adminRows = (adminCheck as any).rows ?? adminCheck;
      if (!Array.isArray(adminRows) || adminRows.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      // Lookup user in auth.users by email using DB. If that fails (restricted DB user),
      // fall back to service-role Supabase admin lookup.
      let targetId: string | null = null;
      try {
        const userRes = await (db as any).execute('select id from auth.users where lower(email) = $1 limit 1', [email]);
        const userRows = (userRes as any).rows ?? userRes;
        const target = Array.isArray(userRows) && userRows.length ? userRows[0] : null;
        if (target) targetId = target.id;
      } catch (err) {
        // ignore and try service key
      }

      if (!targetId) {
        try {
          const svc = getServiceSupabase();
          // Use admin API to find user by email
          // `auth.admin.getUserByEmail` is available in newer supabase-js versions
          // Fallback to querying the `auth.users` table if admin helper unavailable.
          // Try admin helper first
          // @ts-ignore
          const adminRes = await svc.auth.admin.getUserByEmail(email).catch(() => null);
          if (adminRes && adminRes.user && adminRes.user.id) {
            targetId = adminRes.user.id;
          } else {
            // Try direct SQL via service client
            const { data: rows } = await svc.from('auth.users').select('id').eq('email', email).limit(1).maybeSingle() as any;
            if (rows && rows.id) targetId = rows.id;
          }
        } catch (err) {
          // ignore; will handle not found below
        }
      }

      if (!targetId) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      // Check existing membership
      const memCheck = await (db as any).execute('select 1 from public.group_members where group_id = $1 and user_id = $2 limit 1', [group.id, targetId]);
      const memRows = (memCheck as any).rows ?? memCheck;
      if (Array.isArray(memRows) && memRows.length) return NextResponse.json({ error: 'User already a member' }, { status: 400 });

      // Insert membership as member
      await (db as any).execute(
        `insert into public.group_members (group_id, user_id, role, joined_at) values ($1, $2, 'member', now())`,
        [group.id, targetId]
      );

      // Return the inserted (or existing) member with profile info
      const memberRes = await (db as any).execute(
        `select gm.user_id as id, gm.role, p.username, p.full_name, p.avatar_url
         from public.group_members gm
         join public.profiles p on p.id = gm.user_id
         where gm.group_id = $1 and gm.user_id = $2 limit 1`,
        [group.id, targetId]
      );
      const memberRows = (memberRes as any).rows ?? memberRes;
      const member = Array.isArray(memberRows) && memberRows.length ? memberRows[0] : null;

      return NextResponse.json({ member });
    } catch (err) {
      console.error('invite group member error', err);
      return NextResponse.json({ error: 'Failed to invite member' }, { status: 500 });
    }
  }
