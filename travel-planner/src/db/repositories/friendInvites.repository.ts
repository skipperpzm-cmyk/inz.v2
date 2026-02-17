import { requireDb } from 'src/db/db';
import { sql } from 'drizzle-orm';
import { createNotification } from 'src/db/repositories/notifications.repository';

export type InviteRow = {
  id: string;
  from_user_id: string;
  from_name?: string | null;
  from_public_id?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
};

export async function fetchPendingInvitesForUser(userId: string) {
  const db = requireDb();
  const res = await (db as any).execute(
     sql`SELECT fi.id, fi.from_user_id, COALESCE(p.username_display, p.full_name, p.username) as from_name, p.public_id as from_public_id, COALESCE(u.avatar_url, p.avatar_url) AS avatar_url, fi.created_at
      FROM public.friend_invites fi
      LEFT JOIN public.profiles p ON p.id = fi.from_user_id
      LEFT JOIN public.users u ON u.id = fi.from_user_id
      WHERE fi.to_user_id = ${userId} AND fi.status = 'pending'
      ORDER BY fi.created_at DESC`
  );
  const rows = (res as any).rows ?? res;
  return Array.isArray(rows) ? rows : [];
}

/**
 * Fetch pending invites where the user is either the recipient or the sender.
 * Returns fields for both sides so the client can render incoming and outgoing invites.
 */
export async function fetchPendingInvitesForUserWithBothSides(userId: string) {
  const db = requireDb();
  const res = await (db as any).execute(
    sql`SELECT fi.id, fi.from_user_id, fi.to_user_id,
         COALESCE(p_from.username_display, p_from.full_name, p_from.username) as from_name,
         p_from.public_id as from_public_id,
         COALESCE(u_from.avatar_url, p_from.avatar_url) AS from_avatar_url,
         COALESCE(p_to.username_display, p_to.full_name, p_to.username) as to_name,
         p_to.public_id as to_public_id,
         COALESCE(u_to.avatar_url, p_to.avatar_url) AS to_avatar_url,
         fi.created_at
      FROM public.friend_invites fi
      LEFT JOIN public.profiles p_from ON p_from.id = fi.from_user_id
      LEFT JOIN public.users u_from ON u_from.id = fi.from_user_id
      LEFT JOIN public.profiles p_to ON p_to.id = fi.to_user_id
      LEFT JOIN public.users u_to ON u_to.id = fi.to_user_id
      WHERE (fi.to_user_id = ${userId} OR fi.from_user_id = ${userId}) AND fi.status = 'pending'
      ORDER BY fi.created_at DESC`
  );
  const rows = (res as any).rows ?? res;
  return Array.isArray(rows) ? rows : [];
}

export async function acceptInvite(inviteId: string, currentUserId: string) {
  const db = requireDb();

  // Ensure invite exists, belongs to current user, and is pending
  const check = await (db as any).execute(
    sql`SELECT id, from_user_id, to_user_id, status FROM public.friend_invites WHERE id = ${inviteId} LIMIT 1`
  );
  const rows = (check as any).rows ?? check;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Invite not found');
  const invite = rows[0];
  if (invite.to_user_id !== currentUserId) throw new Error('Forbidden');
  if (invite.status !== 'pending') throw new Error('Invite is not pending');

  await (db as any).transaction(async (tx: any) => {
    const updated = await tx.execute(
      sql`UPDATE public.friend_invites SET status = 'accepted' WHERE id = ${inviteId} AND status = 'pending' RETURNING id`
    );
    const updatedRows = (updated as any).rows ?? updated;
    if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
      throw new Error('Invite is not pending');
    }

    await tx.execute(
      sql`INSERT INTO public.user_friends (user_id, friend_id)
       VALUES (${currentUserId}, ${invite.from_user_id})
       ON CONFLICT DO NOTHING`
    );

    await tx.execute(
      sql`INSERT INTO public.user_friends (user_id, friend_id)
       VALUES (${invite.from_user_id}, ${currentUserId})
       ON CONFLICT DO NOTHING`
    );
  });

  return { accepted: true };
}

export async function rejectInvite(inviteId: string, currentUserId: string) {
  const db = requireDb();
  const check = await (db as any).execute(sql`SELECT id, to_user_id FROM public.friend_invites WHERE id = ${inviteId} LIMIT 1`);
  const rows = (check as any).rows ?? check;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Invite not found');
  const invite = rows[0];
  if (invite.to_user_id !== currentUserId) throw new Error('Forbidden');

  await (db as any).execute(sql`UPDATE public.friend_invites SET status = 'rejected' WHERE id = ${inviteId}`);
  return { rejected: true };
}

export async function cancelInvite(inviteId: string, currentUserId: string) {
  const db = requireDb();
  const check = await (db as any).execute(sql`SELECT id, from_user_id FROM public.friend_invites WHERE id = ${inviteId} LIMIT 1`);
  const rows = (check as any).rows ?? check;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Invite not found');
  const invite = rows[0];
  if (invite.from_user_id !== currentUserId) throw new Error('Forbidden');

  await (db as any).execute(sql`UPDATE public.friend_invites SET status = 'cancelled' WHERE id = ${inviteId}`);
  return { cancelled: true };
}

export async function createInvite(fromUserId: string, toUserId: string) {
  const db = requireDb();

  if (fromUserId === toUserId) throw new Error('Cannot invite yourself');

  // check already friends
  const exist = await (db as any).execute(
    sql`SELECT 1 FROM public.user_friends WHERE user_id = ${fromUserId} AND friend_id = ${toUserId} LIMIT 1`
  );
  const existRows = (exist as any).rows ?? exist;
  if (Array.isArray(existRows) && existRows.length > 0) throw new Error('Already friends');

  try {
    const res = await (db as any).execute(
      sql`INSERT INTO public.friend_invites (from_user_id, to_user_id) VALUES (${fromUserId}, ${toUserId}) RETURNING id, from_user_id, to_user_id, status, created_at`
    );
    const rows = (res as any).rows ?? res;
    const created = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    if (created?.id) {
      try {
        await createNotification({
          userId: toUserId,
          actorUserId: fromUserId,
          type: 'friend_invite',
          title: 'Nowe zaproszenie do znajomych',
          message: 'Ktoś zaprosił Cię do znajomych.',
          entityType: 'friend_invite',
          entityId: String(created.id),
          payload: { inviteId: String(created.id), fromUserId, toUserId },
        });
      } catch (notificationErr) {
        console.error('Failed to create friend invite notification', notificationErr);
      }
    }

    return created;
  } catch (err: any) {
    // unique constraint (duplicate pending) will surface as error — normalize message
    if (err?.message && err.message.includes('uq_friend_invites_from_to_pending')) {
      throw new Error('Invite already pending');
    }
    throw err;
  }
}
