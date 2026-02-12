import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getCurrentUser } from '@/lib/auth';

function base64UrlEncode(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret).update(data).digest('base64');
  const encodedSignature = signature.replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${encodedSignature}`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Missing SUPABASE_JWT_SECRET' }, { status: 500 });
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 60 * 60; // 1 hour
  const payload = {
    aud: 'authenticated',
    sub: user.id,
    role: 'authenticated',
    iat: now,
    exp: now + expiresIn,
  };

  const token = signJwt(payload, secret);
  return NextResponse.json({ token, expiresIn }, { headers: { 'Cache-Control': 'no-store' } });
}
