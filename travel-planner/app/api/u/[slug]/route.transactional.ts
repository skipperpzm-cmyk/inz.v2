import { NextResponse } from 'next/server';

// Deprecated slug endpoint — return 410 Gone.
export async function GET() {
  return NextResponse.json({ error: 'Slug route removed' }, { status: 410 });
}
