import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateUserCredentials } from '../../../../src/db/repositories/user.repository';
import { createSession } from '../../../../src/db/repositories/session.repository';
import { requireDb } from '../../../../src/db/db';
import { sql } from 'drizzle-orm';
import { getSessionCookieName } from '../../../../lib/auth';
import { isConnectTimeoutError } from '@/lib/db-errors';

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: 'Podaj poprawny email i hasło.' }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const result = await validateUserCredentials(email, password);
    if (!result.valid || !result.user) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy email lub hasło.' }, { status: 401 });
    }

    const user = result.user;
    const token = await createSession(user.id);

    // Set online=true in profiles table
    const db = requireDb();
    try {
      await (db as any).execute(sql`UPDATE public.profiles SET online = true WHERE id = ${user.id}`);
    } catch {
      // do not block successful auth if profile update fails
    }

    const response = NextResponse.json({ success: true, message: 'Zalogowano.' }, { status: 200 });
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
  } catch (error: any) {
    if (isConnectTimeoutError(error)) {
      return NextResponse.json({ success: false, message: 'Baza danych nie odpowiada. Spróbuj ponownie za chwilę.' }, { status: 503 });
    }
    console.error('Login route failed', error);
    return NextResponse.json({ success: false, message: 'Nie udało się zalogować.' }, { status: 500 });
  }
}
