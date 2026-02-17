import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sqlClient } from "@/src/db/db";
import { createNotification } from "@/src/db/repositories/notifications.repository";

type DbClient = NonNullable<typeof sqlClient>;

async function findGroup(db: DbClient, key: string) {
  const rows = await db`
    select id from public.groups where id::text = ${key} or slug = ${key} limit 1
  `;
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export const POST = async (
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) => {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { slug } = await context.params;
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // ignore invalid body
  }

  const userIds: string[] = Array.isArray(body?.userIds) ? body.userIds : [];
  if (userIds.length === 0) {
    return NextResponse.json({ error: "Missing userIds" }, { status: 400 });
  }

  const db = sqlClient;
  if (!db) {
    console.error("sqlClient is null. Check DATABASE_URL.");
    return NextResponse.json({ error: "Database connection error" }, { status: 500 });
  }

  try {
    const group = await findGroup(db, slug);
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const adminRows = await db`
      select 1
      from public.group_members
      where group_id = ${group.id} and user_id = ${user.id} and role = 'admin'
      limit 1
    `;
    if (!Array.isArray(adminRows) || adminRows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let invited = 0;
    for (const targetId of userIds) {
      if (!targetId) continue;

      const friendRows = await db`
        select 1
        from public.user_friends
        where user_id = ${user.id} and friend_id = ${targetId}
        limit 1
      `;
      if (!Array.isArray(friendRows) || friendRows.length === 0) continue;

      const memberRows = await db`
        select 1
        from public.group_members
        where group_id = ${group.id} and user_id = ${targetId}
        limit 1
      `;
      if (Array.isArray(memberRows) && memberRows.length > 0) continue;

      const insertRows = await db`
        insert into public.group_invites (group_id, from_user_id, to_user_id, status, created_at)
        values (${group.id}, ${user.id}, ${targetId}, 'pending', now())
        on conflict do nothing
        returning id
      `;

      if (Array.isArray(insertRows) && insertRows.length > 0) {
        invited += 1;
        const inviteId = String(insertRows[0].id);
        try {
          await createNotification({
            userId: targetId,
            actorUserId: user.id,
            type: 'group_invite',
            title: 'Nowe zaproszenie do grupy',
            message: 'Otrzymano zaproszenie do grupy.',
            entityType: 'group_invite',
            entityId: inviteId,
            payload: {
              inviteId,
              groupId: String(group.id),
              groupSlug: slug,
              fromUserId: user.id,
              toUserId: targetId,
            },
          });
        } catch (notificationErr) {
          console.error('Failed to create group invite notification', notificationErr);
        }
      }
    }

    return NextResponse.json({ invited });
  } catch (err) {
    console.error("group invite create error", err);
    return NextResponse.json({ error: "Failed to invite members" }, { status: 500 });
  }
};
