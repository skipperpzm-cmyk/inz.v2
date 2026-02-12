import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requireDb } from '@/src/db/db';

function generateSlug(input: string) {
  const s = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'group';
}

function randomSuffix(len = 4) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
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

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : null;
  const is_private = Boolean(body.is_private);

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (name.length > 200) return NextResponse.json({ error: 'Name too long' }, { status: 422 });

  const db = requireDb();

  // Generate unique slug with deterministic attempts, then fallback to random suffix if needed
  let base = generateSlug(name);
  let slug = base;
  try {
    let unique = false;
    // Try deterministic suffixes first (base, base-2, base-3, ...)
    for (let i = 1; i <= 20; i++) {
      const check = await (db as any).execute('select id from public.groups where slug = $1 limit 1', [slug]);
      const rows = (check as any).rows ?? check;
      if (!Array.isArray(rows) || rows.length === 0) {
        unique = true;
        break;
      }
      slug = `${base}-${i + 1}`;
    }

    // If still not unique, append a short random suffix and try a few times
    if (!unique) {
      for (let attempts = 0; attempts < 5; attempts++) {
        const candidate = `${base}-${randomSuffix(4)}`;
        const check = await (db as any).execute('select id from public.groups where slug = $1 limit 1', [candidate]);
        const rows = (check as any).rows ?? check;
        if (!Array.isArray(rows) || rows.length === 0) {
          slug = candidate;
          unique = true;
          // Log fallback usage for operational visibility (do not include sensitive data)
          try { console.info('groups: slug fallback used', { base, slug }); } catch (e) { }
          break;
        }
      }
    }

    if (!unique) throw new Error('Failed to generate unique slug');

    const insertSql = `insert into public.groups (id, name, slug, description, is_private, created_by) values (gen_random_uuid(), $1, $2, $3, $4, $5) returning id, name, slug, description, is_private, created_by, created_at, updated_at`;
    const inserted = await (db as any).execute(insertSql, [name, slug, description, is_private, user.id]);
    const insertedRows = (inserted as any).rows ?? inserted;
    const group = Array.isArray(insertedRows) && insertedRows.length ? insertedRows[0] : null;

    return NextResponse.json({ group });
  } catch (err) {
    console.error('create group error', err);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}
