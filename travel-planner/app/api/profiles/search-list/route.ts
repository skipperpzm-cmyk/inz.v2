import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findFriendsByPartialName, findFriendsByPartialPublicId } from 'src/db/repositories/user.repository';
import { logAddFriend } from 'src/db/repositories/addFriendLogs.repository';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  const limit = url.searchParams.get('limit');
  const trimmed = q.trim();

  if (trimmed.length < 2) return NextResponse.json({ data: [] });
  const isDigitsOnly = /^\d+$/.test(trimmed);
  const take = limit ? Number(limit) : 10;

  try {
    // Log add-friend search
    await logAddFriend(user.id, trimmed);
    const data = isDigitsOnly
      ? await findFriendsByPartialPublicId(trimmed, take)
      : await findFriendsByPartialName(trimmed, take);
    return NextResponse.json({ data });
  } catch (err) {
    console.error('profiles search-list failed', err);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
