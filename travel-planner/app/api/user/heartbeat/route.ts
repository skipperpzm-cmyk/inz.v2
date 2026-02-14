import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { isConnectTimeoutError } from '@/lib/db-errors';
import { setOnlineStatus } from '@/src/db/repositories/profile.repository';

export async function POST() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'User not authenticated' }, { status: 401 });
    }

    await setOnlineStatus(userId, true);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (isConnectTimeoutError(error)) {
      console.warn('Heartbeat skipped due to DB timeout');
      return NextResponse.json({ ok: false, skipped: true }, { status: 202 });
    }
    console.warn('Heartbeat skipped due to backend error');
    return NextResponse.json({ ok: false, skipped: true }, { status: 202 });
  }
}
