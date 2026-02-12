import { NextResponse, NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { cancelInvite } from '@/src/db/repositories/friendInvites.repository';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const params = await context.params;
  const inviteId = params?.id;
  if (!inviteId) return NextResponse.json({ error: 'Missing invite id' }, { status: 400 });

  try {
    const res = await cancelInvite(inviteId, user.id);
    return NextResponse.json(res);
  } catch (err: any) {
    if (err?.message === 'Invite not found') return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    if (err?.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: err?.message ?? 'Failed to cancel invite' }, { status: 500 });
  }
}
