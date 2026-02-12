import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../../lib/auth';
import { updateAvatarUrl } from '../../../../../src/db/repositories/user.repository';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { path: avatarPath } = body as { path?: string };
    if (!avatarPath || typeof avatarPath !== 'string') {
      return NextResponse.json({ error: 'Missing avatar path' }, { status: 400 });
    }

    // Basic normalization: ensure it points under /avatars
    if (!avatarPath.startsWith('/avatars/')) {
      return NextResponse.json({ error: 'Invalid avatar path' }, { status: 400 });
    }

    const updated = await updateAvatarUrl(user.id, avatarPath);
    return NextResponse.json({ avatarUrl: updated?.avatarUrl ?? avatarPath });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return NextResponse.json({ error: 'Failed to set avatar' }, { status: 500 });
  }
}
