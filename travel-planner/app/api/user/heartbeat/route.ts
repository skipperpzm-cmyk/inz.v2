import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { setOnlineStatus } from '@/src/db/repositories/profile.repository';

export async function POST() {
  const user = await getCurrentUser();
  if (user) {
    await setOnlineStatus(user.id, true);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: 'User not authenticated' }, { status: 401 });
}
