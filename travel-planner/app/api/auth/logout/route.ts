import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { deleteSessionByToken } from 'src/db/repositories/session.repository';
import { getSessionCookieName } from '../../../../lib/auth';
import { requireDb } from 'src/db/db';
import { sql } from 'drizzle-orm';

export async function POST() {
  const cookieStore = await cookies();
  const cookieName = getSessionCookieName();
  const token = cookieStore.get(cookieName)?.value;
  if (token) {
    try {
      console.log('[LOGOUT] token:', token);
      const db = requireDb();
      const sessionRes = await db.execute(sql`SELECT user_id FROM public.sessions WHERE session_token = ${token} LIMIT 1`);
      console.log('[LOGOUT] sessionRes:', sessionRes);
      let userId: string | undefined = undefined;
      if (Array.isArray(sessionRes) && sessionRes.length > 0 && sessionRes[0].user_id) {
        userId = String(sessionRes[0].user_id);
      } else if ('rows' in sessionRes && Array.isArray(sessionRes.rows) && sessionRes.rows.length > 0 && sessionRes.rows[0].user_id) {
        userId = String(sessionRes.rows[0].user_id);
      }
      console.log('[LOGOUT] userId:', userId);
      await deleteSessionByToken(token);
      if (typeof userId === 'string' && userId.length > 0) {
        const updateRes = await db.execute(sql`UPDATE public.profiles SET online = false WHERE id = ${userId}`);
        console.log('[LOGOUT] updateRes:', updateRes);
      }
    } catch (e) {
      console.error('[LOGOUT] error:', e);
    }
  }

  const res = NextResponse.json({ ok: true });
  // Clear cookie
  res.headers.set('Set-Cookie', `${cookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`);
  return res;
}
