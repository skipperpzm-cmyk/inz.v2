import { NextResponse } from 'next/server';
import { getCurrentUserWithReason } from '../../../../lib/auth';
import { updateUsername, updateBackgroundUrl } from 'src/db/repositories/user.repository';
import { setOnlineStatus } from 'src/db/repositories/profile.repository';

export async function GET() {
  const auth = await getCurrentUserWithReason();
  if (!auth.user) {
    if (auth.reason === 'db-timeout') {
      return NextResponse.json(
        { error: 'Auth lookup timeout', code: 'AUTH_DB_TIMEOUT', retryable: true },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const user = auth.user;
  // Return minimal public info. Slug fields removed from API surface.
  return NextResponse.json({
    id: user.id,
    email: user.email,
    username: user.username,
    usernameDisplay: (user as any).usernameDisplay ?? null,
    publicId: (user as any).publicId ?? null,
    avatarUrl: user.avatarUrl,
    backgroundUrl: (user as any).backgroundUrl ?? null,
  });
}

export async function PATCH(req: Request) {
  const auth = await getCurrentUserWithReason();
  if (!auth.user) {
    if (auth.reason === 'db-timeout') {
      return NextResponse.json(
        { error: 'Auth lookup timeout', code: 'AUTH_DB_TIMEOUT', retryable: true },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const user = auth.user;

  let body: { username?: string; backgroundUrl?: string | null; heartbeat?: boolean } = {} as any;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Heartbeat: update online and last_online_at
  if (body.heartbeat === true) {
    try {
      await setOnlineStatus(user.id, true);
      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json({ error: 'Failed to update heartbeat' }, { status: 500 });
    }
  }

  // Handle username updates
  if (typeof body.username === 'string') {
    const nextUsername = body.username?.trim();
    if (!nextUsername) return NextResponse.json({ error: 'Missing username' }, { status: 400 });
    if (nextUsername.length < 3) return NextResponse.json({ error: 'Username too short' }, { status: 422 });
    if (nextUsername.length > 64) return NextResponse.json({ error: 'Username too long' }, { status: 422 });

    const updated = await updateUsername(user.id, nextUsername);
    return NextResponse.json({ username: updated?.username ?? nextUsername });
  }

  // Handle backgroundUrl updates (nullable)
  if (Object.prototype.hasOwnProperty.call(body, 'backgroundUrl')) {
    try {
      const next = (body as any).backgroundUrl ?? null;
      // best-effort persistence
      try {
        await updateBackgroundUrl(user.id, next as any);
      } catch (err) {
        // ignore DB update errors — still return success to client
      }
      return NextResponse.json({ backgroundUrl: next });
    } catch (err) {
      return NextResponse.json({ error: 'Failed to update background' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'No supported fields in request' }, { status: 400 });
}
