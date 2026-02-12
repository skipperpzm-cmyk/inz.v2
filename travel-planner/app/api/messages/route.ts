import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  createDirectMessage,
  createGroupMessage,
  fetchDirectMessages,
  fetchGroupMessages,
} from '@/src/db/repositories/message.repository';

function normalizeError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (message === 'Not friends') return { status: 403, message };
  if (message === 'Not a group member') return { status: 403, message };
  return { status: 500, message: 'Server error' };
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const url = new URL(req.url);
  const friendId = url.searchParams.get('friendId');
  const groupId = url.searchParams.get('groupId');
  const limit = url.searchParams.get('limit');

  if ((friendId && groupId) || (!friendId && !groupId)) {
    return NextResponse.json({ error: 'Provide friendId or groupId' }, { status: 400 });
  }

  try {
    if (friendId) {
      const messages = await fetchDirectMessages(user.id, friendId, limit ? Number(limit) : undefined);
      return NextResponse.json({ messages });
    }
    const messages = await fetchGroupMessages(user.id, String(groupId), limit ? Number(limit) : undefined);
    return NextResponse.json({ messages });
  } catch (err) {
    const normalized = normalizeError(err);
    return NextResponse.json({ error: normalized.message }, { status: normalized.status });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const friendId = typeof body?.friendId === 'string' ? body.friendId : null;
  const groupId = typeof body?.groupId === 'string' ? body.groupId : null;
  const content = typeof body?.content === 'string' ? body.content.trim() : '';

  if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 });
  if (content.length > 2000) return NextResponse.json({ error: 'Content too long' }, { status: 422 });
  if ((friendId && groupId) || (!friendId && !groupId)) {
    return NextResponse.json({ error: 'Provide friendId or groupId' }, { status: 400 });
  }

  try {
    if (friendId) {
      const message = await createDirectMessage(user.id, friendId, content);
      return NextResponse.json({ message });
    }
    const message = await createGroupMessage(user.id, String(groupId), content);
    return NextResponse.json({ message });
  } catch (err) {
    const normalized = normalizeError(err);
    return NextResponse.json({ error: normalized.message }, { status: normalized.status });
  }
}
