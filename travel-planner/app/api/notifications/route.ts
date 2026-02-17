import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  deleteNotifications,
  fetchNotificationsForUser,
  markNotificationsRead,
} from '@/src/db/repositories/notifications.repository';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? '25');
    const offset = Number(url.searchParams.get('offset') ?? '0');
    const data = await fetchNotificationsForUser(user.id, limit, offset);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('notifications GET error', err);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids : undefined;
    await markNotificationsRead(user.id, ids);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('notifications PATCH error', err);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids.map((id: unknown) => String(id ?? '')).filter(Boolean) : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No notification ids provided' }, { status: 400 });
    }

    const result = await deleteNotifications(user.id, ids);
    return NextResponse.json({ ok: true, deletedCount: result.deletedCount });
  } catch (err) {
    console.error('notifications DELETE error', err);
    return NextResponse.json({ error: 'Failed to delete notifications' }, { status: 500 });
  }
}
