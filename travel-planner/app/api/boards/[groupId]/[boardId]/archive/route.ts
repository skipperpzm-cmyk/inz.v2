import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { sqlClient } from '@/src/db/db';
import { getBoardAccessForUser } from '../../../_lib/moderation';

type Params = { params: Promise<{ groupId: string; boardId: string }> };

export async function POST(_request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { boardId } = await context.params;
  if (!boardId) return NextResponse.json({ error: 'Missing board id' }, { status: 400 });

  try {
    const access = await getBoardAccessForUser(userId, boardId);
    if (!access) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    if (!access.isMember || !access.canModerate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await sqlClient`
      update public.boards
      set
        details = coalesce(details, '{}'::jsonb) || jsonb_build_object('archivedAt', (now() at time zone 'utc')),
        updated_at = now()
      where id = ${access.boardId}::uuid
      returning id, details->>'archivedAt' as archived_at
    `;

    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!row) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

    return NextResponse.json({
      success: true,
      boardId: String(row.id),
      archivedAt: row.archived_at ?? null,
    });
  } catch (err) {
    console.error('board archive error', err);
    return NextResponse.json({ error: 'Failed to archive board' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { boardId } = await context.params;
  if (!boardId) return NextResponse.json({ error: 'Missing board id' }, { status: 400 });

  try {
    const access = await getBoardAccessForUser(userId, boardId);
    if (!access) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    if (!access.isMember || !access.canModerate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await sqlClient`
      update public.boards
      set
        details = coalesce(details, '{}'::jsonb) - 'archivedAt',
        updated_at = now()
      where id = ${access.boardId}::uuid
      returning id
    `;

    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!row) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

    return NextResponse.json({
      success: true,
      boardId: String(row.id),
    });
  } catch (err) {
    console.error('board restore error', err);
    return NextResponse.json({ error: 'Failed to restore board' }, { status: 500 });
  }
}
