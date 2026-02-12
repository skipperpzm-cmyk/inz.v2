import { NextResponse } from 'next/server';
// Note: dynamically import `user.repository` inside the handler to allow tests
// to mock the module without causing import-time resolution issues.
import { createSession } from '../../../../src/db/repositories/session.repository';
import { getSessionCookieName } from '../../../../lib/auth';
import { requireDb } from '../../../../src/db/db';
import { sql } from 'drizzle-orm';

function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && /\S+@\S+\.\S+/.test(email);
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const email = payload.email as unknown;
  const password = payload.password as unknown;
  const username = payload.username as unknown;

  if (!isValidEmail(email)) {
    return NextResponse.json({ success: false, message: 'Please provide a valid email address.' }, { status: 400 });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return NextResponse.json({ success: false, message: 'Password must be at least 6 characters.' }, { status: 400 });
  }
  if (typeof username !== 'string' || username.trim().length < 3) {
    return NextResponse.json({ success: false, message: 'Username must be at least 3 characters.' }, { status: 400 });
  }

  // Additional sanitization: enforce a reasonable max length and allowed characters
  const nextUsername = username.trim();
  const USERNAME_MAX = 64;
  if (nextUsername.length > USERNAME_MAX) {
    return NextResponse.json({ success: false, message: 'Username too long.' }, { status: 422 });
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(nextUsername)) {
    return NextResponse.json({ success: false, message: 'Username contains invalid characters.' }, { status: 422 });
  }

  // Check uniqueness
  const mod = await import('../../../../src/db/repositories/user.repository.ts');
  const getUserByEmail = (mod.getUserByEmail as any) ?? (async () => null);
  const _createUser = (mod.createUser as any) ?? (async () => null);
  const existing = await getUserByEmail(email as string);
  if (existing) {
    return NextResponse.json({ success: false, message: 'An account with that email already exists.' }, { status: 409 });
  }

  // Username uniqueness (case-insensitive) — check public.users and public.profiles
  try {
    const nextLower = nextUsername.toLowerCase();
    const db = requireDb();
    // Check uniqueness against legacy `username` case-insensitively
    const conflict = await (db as any).execute(sql`SELECT id FROM public.users WHERE lower(username) = ${nextLower} LIMIT 1`);
    const conflictRows = (conflict as any).rows ?? conflict;
    if (Array.isArray(conflictRows) && conflictRows.length > 0) {
      return NextResponse.json({ success: false, message: 'Username already taken.' }, { status: 409 });
    }
    const conflictP = await (db as any).execute(sql`SELECT id FROM public.profiles WHERE lower(username) = ${nextLower} LIMIT 1`);
    const conflictPRows = (conflictP as any).rows ?? conflictP;
    if (Array.isArray(conflictPRows) && conflictPRows.length > 0) {
      return NextResponse.json({ success: false, message: 'Username already taken.' }, { status: 409 });
    }
  } catch (err) {
    console.error('username uniqueness check failed during registration', err);
    // fallback to relying on DB unique index to prevent duplicates
  }

  // No nickname handling: usernames are the primary public identifier and must be unique.

  const created = await _createUser({ email: email as string, password: password as string, username: nextUsername });
  if (!created) {
    return NextResponse.json({ success: false, message: 'Unable to create account.' }, { status: 500 });
  }

  // Create a session so the user is logged in immediately after registering.
  try {
    const token = await createSession(created.id);
    const response = NextResponse.json({ success: true, message: 'Account created.' }, { status: 201 });
    response.cookies.set({
      name: getSessionCookieName(),
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24,
      path: '/',
    });
    return response;
  } catch (err) {
    console.error('failed to create session after registration', err);
    return NextResponse.json({ success: true, message: 'Account created.' }, { status: 201 });
  }
}
