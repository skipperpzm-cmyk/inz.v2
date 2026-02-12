import { NextRequest, NextResponse } from 'next/server';
import { getProfileByPublicId } from 'src/db/repositories/user.repository';

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const params = await context.params;
  const slug = params?.slug ?? '';
  // If the incoming segment is the new 8-digit public_id, fetch that profile.
  if (/^\d{8}$/.test(slug)) {
    try {
      const profile = await getProfileByPublicId(slug);
      if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ profile });
    } catch (err) {
      console.error('failed to fetch profile by public_id', err);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }

  // Non-numeric legacy slug route removed — indicate gone.
  return NextResponse.json({ error: 'Slug route removed' }, { status: 410 });
}
