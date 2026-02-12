import { NextResponse, NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rejectInvite } from '@/src/db/repositories/friendInvites.repository';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const params = await context.params;
  const id = params.id;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    const res = await rejectInvite(id, user.id);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to reject invite' }, { status: 500 });
  }
}
