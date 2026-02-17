import { sql } from 'drizzle-orm';
import { requireDb } from 'src/db/db';

type CreateNotificationInput = {
  userId: string;
  actorUserId?: string | null;
  type: string;
  title: string;
  message?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
};

export async function createNotification(input: CreateNotificationInput) {
  const db = requireDb();
  const payloadJson = JSON.stringify(input.payload ?? {});

  const res = await (db as any).execute(sql`
    insert into public.notifications (
      user_id,
      actor_user_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      payload,
      created_at
    )
    values (
      ${input.userId},
      ${input.actorUserId ?? null},
      ${input.type},
      ${input.title},
      ${input.message ?? null},
      ${input.entityType ?? null},
      ${input.entityId ?? null},
      ${payloadJson}::jsonb,
      now()
    )
    returning id
  `);

  const rows = (res as any).rows ?? res;
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

export async function fetchNotificationsForUser(userId: string, limit = 25, offset = 0) {
  const db = requireDb();
  const safeLimit = Math.min(100, Math.max(1, Number(limit || 25)));
  const safeOffset = Math.max(0, Number(offset || 0));

  const res = await (db as any).execute(sql`
    select
      n.id,
      n.type,
      n.title,
      n.message,
      n.entity_type,
      n.entity_id,
      n.payload,
      n.read_at,
      n.created_at,
      n.actor_user_id,
      bi.id as board_invite_id,
      p.username as actor_username,
      p.full_name as actor_full_name,
      p.public_id as actor_public_id,
      coalesce(nullif(u.avatar_url, ''), nullif(p.avatar_url, '')) as actor_avatar_url
    from public.notifications n
    left join public.board_invites bi
      on n.type = 'board_invite'
      and bi.board_id = n.entity_id
      and bi.to_user_id = n.user_id
      and bi.status = 'pending'
    left join public.profiles p on p.id = n.actor_user_id
    left join public.users u on u.id = n.actor_user_id
    where n.user_id = ${userId}
    order by n.created_at desc
    limit ${safeLimit}
    offset ${safeOffset}
  `);

  const rows = (res as any).rows ?? res;
  const list = Array.isArray(rows) ? rows : [];

  const unreadRes = await (db as any).execute(sql`
    select count(*)::int as unread_count
    from public.notifications
    where user_id = ${userId} and read_at is null
  `);
  const unreadRows = (unreadRes as any).rows ?? unreadRes;
  const unreadCount = Array.isArray(unreadRows) && unreadRows.length > 0
    ? Number(unreadRows[0]?.unread_count ?? 0)
    : 0;

  return {
    unreadCount,
    items: list.map((row: any) => ({
      payload: (() => {
        const payload = row.payload ?? {};
        if (row.type !== 'board_invite') return payload;
        if (payload && typeof payload === 'object' && typeof payload.inviteId === 'string' && payload.inviteId.trim()) {
          return payload;
        }
        const boardInviteId = row.board_invite_id ? String(row.board_invite_id) : '';
        if (!boardInviteId) return payload;
        return {
          ...(typeof payload === 'object' && payload ? payload : {}),
          inviteId: boardInviteId,
        };
      })(),
      id: String(row.id),
      type: String(row.type ?? 'system'),
      title: String(row.title ?? ''),
      message: row.message ?? null,
      entityType: row.entity_type ?? null,
      entityId: row.entity_id ? String(row.entity_id) : null,
      readAt: row.read_at ?? null,
      createdAt: row.created_at ?? null,
      actor: row.actor_user_id
        ? {
            id: String(row.actor_user_id),
            username: row.actor_username ?? null,
            fullName: row.actor_full_name ?? null,
            publicId: row.actor_public_id ?? null,
            avatarUrl: row.actor_avatar_url ?? null,
          }
        : null,
    })),
  };
}

export async function markNotificationsRead(userId: string, notificationIds?: string[]) {
  const db = requireDb();
  const ids = Array.isArray(notificationIds)
    ? notificationIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  if (ids.length === 0) {
    await (db as any).execute(sql`
      update public.notifications
      set read_at = now()
      where user_id = ${userId} and read_at is null
    `);
    return;
  }

  await (db as any).execute(sql`
    update public.notifications
    set read_at = now()
    where user_id = ${userId} and id::text = any(${ids}) and read_at is null
  `);
}
