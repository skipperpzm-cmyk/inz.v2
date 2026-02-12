import { NextResponse } from 'next/server';
import { validateUserCredentials } from '../../../../src/db/repositories/user.repository';
import { createSession } from '../../../../src/db/repositories/session.repository';
import { requireDb } from '../../../../src/db/db';
import { sql } from 'drizzle-orm';
import { getSessionCookieName } from '../../../../lib/auth';

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const email = payload.email as unknown;
  const password = payload.password as unknown;

  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ success: false, message: 'Email and password are required.' }, { status: 400 });
  }

  const result = await validateUserCredentials(email, password);
  if (!result.valid || !result.user) {
    return NextResponse.json({ success: false, message: 'Invalid credentials.' }, { status: 401 });
  }

  const user = result.user;
  const token = await createSession(user.id);

  // Set online=true in profiles table
  try {
    const db = requireDb();
    await (db as any).execute(sql`UPDATE public.profiles SET online = true WHERE id = ${user.id}`);
  } catch (e) {
    // Optionally log error, but do not block login
  }
  const response = NextResponse.json({ success: true, message: 'Authenticated.' }, { status: 200 });
  response.cookies.set({
    name: getSessionCookieName(),
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 60 * 60 * 24,
    path: '/',
  });

  return response;
}
