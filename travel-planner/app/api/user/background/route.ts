import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth';
import { updateBackgroundUrl } from 'src/db/repositories/user.repository';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: { backgroundUrl?: string | null } = {};
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    // Accept explicit null to clear user's background
    const next = body.backgroundUrl ?? null;
    await updateBackgroundUrl(user.id, next as any);
    return NextResponse.json({ success: true, backgroundUrl: next });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update background' }, { status: 500 });
  }
}
