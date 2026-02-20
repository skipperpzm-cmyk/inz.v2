import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { sqlClient } from '@/src/db/db';
import { getBoardAccessForUser } from '../../../_lib/moderation';

type Params = { params: Promise<{ groupId: string; boardId: string }> };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PUT(request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { boardId } = await context.params;
  if (!boardId) return NextResponse.json({ error: 'Missing board id' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const access = await getBoardAccessForUser(userId, boardId);
    if (!access) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    if (!access.isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (access.isArchived) return NextResponse.json({ error: 'Archived board is read-only' }, { status: 409 });

    if (!access.canModerate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload = (body ?? {}) as {
      checklist?: unknown;
      location?: unknown;
      startDate?: unknown;
      endDate?: unknown;
      description?: unknown;
      budget?: unknown;
      details?: unknown;
      boardName?: unknown;
    };

    const checklist = Array.isArray(payload.checklist)
      ? payload.checklist.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 200)
      : [];
    const details = payload.details && typeof payload.details === 'object'
      ? payload.details as Record<string, unknown>
      : {};

    const location = typeof payload.location === 'string' ? payload.location.trim().slice(0, 200) : null;
    const startDate = typeof payload.startDate === 'string' && DATE_RE.test(payload.startDate) ? payload.startDate : null;
    const endDate = typeof payload.endDate === 'string' && DATE_RE.test(payload.endDate) ? payload.endDate : null;
    const travelDescription = typeof payload.description === 'string' ? payload.description.trim().slice(0, 5000) : null;
    const boardName = typeof payload.boardName === 'string' ? payload.boardName.trim().slice(0, 120) : null;
    const parsedBudget = payload.budget == null || payload.budget === '' ? null : Number(payload.budget);
    const budget = parsedBudget == null ? null : Number.isFinite(parsedBudget) ? parsedBudget : null;

    if (startDate && endDate && startDate > endDate) {
      return NextResponse.json({ error: 'Data końca nie może być wcześniejsza niż data startu' }, { status: 422 });
    }

    const updateRows = await sqlClient`
      update public.boards
      set
        title = coalesce(${boardName}, title),
        location = ${location},
        start_date = ${startDate},
        end_date = ${endDate},
        travel_description = ${travelDescription},
        budget = ${budget},
        checklist = ${JSON.stringify(checklist)}::jsonb,
        details = ${JSON.stringify(details)}::jsonb,
        updated_at = now()
      where id = ${boardId}::uuid
      returning title, location, start_date, end_date, travel_description, budget, checklist, details, updated_at
    `;

    const row = Array.isArray(updateRows) && updateRows.length ? updateRows[0] : null;
    if (!row) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

    return NextResponse.json({
      boardName: row.title,
      travelInfo: {
        location: row.location ?? null,
        startDate: row.start_date ?? null,
        endDate: row.end_date ?? null,
        description: row.travel_description ?? null,
        budget: row.budget != null ? Number(row.budget) : null,
        checklist: Array.isArray(row.checklist) ? row.checklist : checklist,
        details: row.details && typeof row.details === 'object' ? row.details : details,
        updatedAt: row.updated_at ?? null,
      },
    });
  } catch (err) {
    console.error('board info update error', err);
    return NextResponse.json({ error: 'Failed to update board info' }, { status: 500 });
  }
}
