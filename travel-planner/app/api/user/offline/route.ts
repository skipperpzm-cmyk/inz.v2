import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { setOnlineStatus } from '@/src/db/repositories/profile.repository';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  await setOnlineStatus(user.id, false);
  return NextResponse.json({ ok: true });
}
