import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requireDb } from '@/src/db/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const db = requireDb();

  // Pobierz znajomych (dwukierunkowo)
  const res = await db.execute(sql`
    SELECT p.id,
      COALESCE(p.username_display, p.full_name, p.username) as name,
      p.public_id,
      COALESCE(u.avatar_url, p.avatar_url) as avatar_url,
      p.online
    FROM public.user_friends uf
    JOIN public.profiles p ON p.id = uf.friend_id
    LEFT JOIN public.users u ON u.id = uf.friend_id
    WHERE uf.user_id = ${user.id}
    UNION
    SELECT p.id,
      COALESCE(p.username_display, p.full_name, p.username) as name,
      p.public_id,
      COALESCE(u.avatar_url, p.avatar_url) as avatar_url,
      p.online
    FROM public.user_friends uf
    JOIN public.profiles p ON p.id = uf.user_id
    LEFT JOIN public.users u ON u.id = uf.user_id
    WHERE uf.friend_id = ${user.id}
  `);
  // Zamiast res.rows ?? res, po prostu użyj res (drizzle zwraca tablicę)
  return NextResponse.json(Array.isArray(res) ? res : []);
}
