import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { sqlClient } from '@/src/db/db';

type Params = { params: Promise<{ groupId: string }> };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PUT(request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { groupId } = await context.params;
  if (!groupId) return NextResponse.json({ error: 'Missing group id' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const membership = UUID_RE.test(groupId)
      ? await sqlClient`
          select g.id as group_id, g.created_by, gm.role
          from public.groups g
          join public.group_members gm on gm.group_id = g.id and gm.user_id = ${userId}
          where g.id = ${groupId}::uuid
          limit 1
        `
      : await sqlClient`
          select g.id as group_id, g.created_by, gm.role
          from public.groups g
          join public.group_members gm on gm.group_id = g.id and gm.user_id = ${userId}
          where g.slug = ${groupId}
          limit 1
        `;

    const member = Array.isArray(membership) && membership.length ? membership[0] : null;
    if (!member) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

    if (String(member.created_by ?? '') !== String(userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload = (body ?? {}) as {
      checklist?: unknown;
      location?: unknown;
      startDate?: unknown;
      endDate?: unknown;
      description?: unknown;
      budget?: unknown;
    };

    const checklist = Array.isArray(payload.checklist)
      ? payload.checklist.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 200)
      : [];

    const location = typeof payload.location === 'string' ? payload.location.trim().slice(0, 200) : null;
    const startDate = typeof payload.startDate === 'string' && DATE_RE.test(payload.startDate) ? payload.startDate : null;
    const endDate = typeof payload.endDate === 'string' && DATE_RE.test(payload.endDate) ? payload.endDate : null;
    const description = typeof payload.description === 'string' ? payload.description.trim().slice(0, 5000) : null;
    const parsedBudget = payload.budget == null || payload.budget === '' ? null : Number(payload.budget);
    const budget = parsedBudget == null ? null : Number.isFinite(parsedBudget) ? parsedBudget : null;

    if (startDate && endDate && startDate > endDate) {
      return NextResponse.json({ error: 'Data końca nie może być wcześniejsza niż data startu' }, { status: 422 });
    }

    await sqlClient`
      insert into public.group_boards (group_id, location, start_date, end_date, description, budget, checklist)
      values (${member.group_id}, ${location}, ${startDate}, ${endDate}, ${description}, ${budget}, ${JSON.stringify(checklist)}::jsonb)
      on conflict (group_id)
      do update set
        location = excluded.location,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        description = excluded.description,
        budget = excluded.budget,
        checklist = excluded.checklist,
        updated_at = now()
    `;

    const updated = await sqlClient`
      select location, start_date, end_date, description, budget, checklist, updated_at
      from public.group_boards
      where group_id = ${member.group_id}
      limit 1
    `;

    const row = Array.isArray(updated) && updated.length ? updated[0] : null;

    return NextResponse.json({
      travelInfo: {
        location: row?.location ?? null,
        startDate: row?.start_date ?? null,
        endDate: row?.end_date ?? null,
        description: row?.description ?? null,
        budget: row?.budget != null ? Number(row.budget) : null,
        checklist: Array.isArray(row?.checklist) ? row.checklist : checklist,
        updatedAt: row?.updated_at ?? null,
      },
    });
  } catch (err) {
    console.error('board info update error', err);
    return NextResponse.json({ error: 'Failed to update board info' }, { status: 500 });
  }
}
