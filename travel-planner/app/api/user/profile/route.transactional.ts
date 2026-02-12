import { NextResponse } from 'next/server';

// Transactional slug endpoint removed — return 410 Gone to indicate deprecation.
export async function PATCH() {
  return NextResponse.json({ error: 'Transactional slug endpoint removed' }, { status: 410 });
}
