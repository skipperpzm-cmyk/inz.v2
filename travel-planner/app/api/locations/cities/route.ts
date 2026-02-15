import { NextResponse } from 'next/server';
import { searchWorldCities } from '@/lib/worldCities';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') ?? '';
    const country = url.searchParams.get('country') ?? '';
    const rawLimit = Number(url.searchParams.get('limit') ?? '10');
    const limit = Number.isFinite(rawLimit) ? rawLimit : 10;

    if (!q.trim()) {
      return NextResponse.json({ data: [] });
    }

    const data = searchWorldCities({
      query: q,
      country,
      limit,
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('cities search failed', error);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
