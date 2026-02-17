import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { requireDb } from '@/src/db/db';
import { createNotification } from '@/src/db/repositories/notifications.repository';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const params = await context.params;
  const inviteId = params.id;
  if (!UUID_RE.test(inviteId)) return NextResponse.json({ error: 'Invalid invite id' }, { status: 400 });

  try {
    const db = requireDb();

    const inviteRes = await (db as any).execute(sql`
      select
        bi.id,
        bi.board_id,
        bi.from_user_id,
        b.title as board_title,
        g.name as group_name
      from public.board_invites bi
      join public.boards b on b.id = bi.board_id
      join public.groups g on g.id = b.group_id
      where (bi.id = ${inviteId}::uuid or bi.board_id = ${inviteId}::uuid)
        and bi.to_user_id = ${user.id}
        and bi.status = 'pending'
      order by bi.created_at desc
      limit 1
    `);

    const inviteRows = (inviteRes as any).rows ?? inviteRes;
    const invite = Array.isArray(inviteRows) && inviteRows.length > 0 ? inviteRows[0] : null;
    if (!invite) return NextResponse.json({ error: 'Zaproszenie wygasło' }, { status: 404 });

    await (db as any).execute(sql`
      update public.board_invites
      set status = 'rejected', decided_at = now()
      where id = ${inviteId}
    `);

    try {
      await createNotification({
        userId: String(invite.from_user_id),
        actorUserId: user.id,
        type: 'board_invite_rejected',
        title: 'Zaproszenie do tablicy odrzucone',
        message: `${String(invite.board_title ?? 'Tablica')} (${String(invite.group_name ?? 'Grupa')})`,
        entityType: 'board_invite',
        entityId: String(invite.board_id),
        payload: {
          inviteId,
          boardId: String(invite.board_id),
          rejectedBy: user.id,
        },
      });
    } catch (notificationErr) {
      console.error('board invite reject notification error', notificationErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('board invite reject error', err);
    return NextResponse.json({ error: 'Failed to reject invite' }, { status: 500 });
  }
}
