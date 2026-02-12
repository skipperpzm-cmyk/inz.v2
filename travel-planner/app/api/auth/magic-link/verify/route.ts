import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createSession } from '../../../../../src/db/repositories/session.repository';
import { getMagicLinkByTokenHash, markMagicLinkUsed } from '../../../../../src/db/repositories/magicLink.repository';
import { getSessionCookieName } from '../../../../../lib/auth';
import { requireDb } from '../../../../../src/db/db';
import { sql } from 'drizzle-orm';

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const token = payload.token as unknown;

  if (typeof token !== 'string' || token.length < 16) {
    return NextResponse.json({ success: false, message: 'Nieprawidlowy token.' }, { status: 400 });
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const magicLink = await getMagicLinkByTokenHash(tokenHash);
  if (!magicLink) {
    return NextResponse.json({ success: false, message: 'Link wygasl lub jest nieprawidlowy.' }, { status: 400 });
  }
  if (magicLink.usedAt) {
    return NextResponse.json({ success: false, message: 'Link zostal juz wykorzystany.' }, { status: 400 });
  }
  if (magicLink.expiresAt && new Date(magicLink.expiresAt) <= new Date()) {
    return NextResponse.json({ success: false, message: 'Link wygasl.' }, { status: 400 });
  }
  if (!magicLink.userId) {
    return NextResponse.json({ success: false, message: 'Link wygasl lub jest nieprawidlowy.' }, { status: 400 });
  }

  await markMagicLinkUsed(magicLink.id);

  const tokenValue = await createSession(magicLink.userId);

  try {
    const db = requireDb();
    await (db as any).execute(sql`UPDATE public.profiles SET online = true WHERE id = ${magicLink.userId}`);
  } catch (e) {
    // do not block login
  }

  const response = NextResponse.json({ success: true, message: 'Zalogowano.' }, { status: 200 });
  response.cookies.set({
    name: getSessionCookieName(),
    value: tokenValue,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24,
    path: '/',
  });

  return response;
}
