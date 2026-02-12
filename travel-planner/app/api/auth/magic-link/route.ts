import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'node:crypto';
import { getUserByEmail } from '../../../../src/db/repositories/user.repository';
import { createMagicLinkToken } from '../../../../src/db/repositories/magicLink.repository';
import { sendMagicLinkEmail } from '../../../../lib/mailer';

const MAGIC_LINK_TTL_MINUTES = 60;

function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && /\S+@\S+\.\S+/.test(email);
}

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null;
  return request.headers.get('x-real-ip');
}

function getBaseUrl() {
  return (
    process.env.MAGIC_LINK_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  );
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => ({}));
  const email = payload.email as unknown;

  if (!isValidEmail(email)) {
    return NextResponse.json({ success: false, message: 'Podaj poprawny adres email.' }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  if (user) {
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000);

    await createMagicLinkToken({
      userId: user.id,
      email: user.email,
      tokenHash,
      expiresAt,
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
    });

    const baseUrl = getBaseUrl();
    const link = `${baseUrl.replace(/\/$/, '')}/login?token=${rawToken}`;

    await sendMagicLinkEmail({
      to: user.email,
      link,
      expiresInMinutes: MAGIC_LINK_TTL_MINUTES,
    });
  }

  return NextResponse.json({
    success: true,
    message: 'Jesli konto istnieje, wyslalismy magic link na email.',
  });
}
