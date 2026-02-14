import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requireDb } from '@/src/db/db';
import { sql } from 'drizzle-orm';

async function findGroup(db: any, key: string) {
  const res = await (db as any).execute(
    sql`select id, created_by from public.groups where id::text = ${key} or slug = ${key} limit 1`
  );
  const rows = (res as any).rows ?? res;
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function handleDelete(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const params = await context.params;
  const slug = params.slug;
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  try {
    const db = requireDb();
    const group = await findGroup(db, slug);
    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

    if (String(group.created_by ?? '') !== String(user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await (db as any).transaction(async (tx: any) => {
      await tx.execute(sql`delete from public.group_invites where group_id = ${group.id}`);
      await tx.execute(sql`delete from public.group_members where group_id = ${group.id}`);
      await tx.execute(sql`delete from public.groups where id = ${group.id}`);
    });

    return NextResponse.json({ success: true, groupId: String(group.id) });
  } catch (err) {
    console.error('delete group error', err);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return handleDelete(request, context);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return handleDelete(request, context);
}
