import { NextResponse } from 'next/server';
import { findProfilesByName } from 'src/db/repositories/user.repository';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  if (!q.trim()) return NextResponse.json({ error: 'missing query' }, { status: 400 });
  try {
    const profiles = await findProfilesByName(q.trim());
    return NextResponse.json({ data: profiles });
  } catch (err) {
    console.error('profile search failed', err);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
