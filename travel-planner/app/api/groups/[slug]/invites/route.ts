import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireDb } from "@/src/db/db";

async function findGroup(db: any, key: string) {
  const res = await (db as any).execute(
    "select id from public.groups where id::text = $1 or slug = $1 limit 1",
    [key]
  );
  const rows = (res as any).rows ?? res;
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const params = await context.params;
  const slug = params.slug;
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  let body: any = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const userIds: string[] = Array.isArray(body?.userIds) ? body.userIds : [];
  if (userIds.length === 0) return NextResponse.json({ error: "Missing userIds" }, { status: 400 });

  try {
    const db = requireDb();
    const group = await findGroup(db, slug);
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const adminCheck = await (db as any).execute(
      "select 1 from public.group_members where group_id = $1 and user_id = $2 and role = $3 limit 1",
      [group.id, user.id, "admin"]
    );
    const adminRows = (adminCheck as any).rows ?? adminCheck;
    if (!Array.isArray(adminRows) || adminRows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let invited = 0;
    for (const targetId of userIds) {
      if (!targetId) continue;
      // Ensure target is a friend
      const friendCheck = await (db as any).execute(
        "select 1 from public.user_friends where user_id = $1 and friend_id = $2 limit 1",
        [user.id, targetId]
      );
      const friendRows = (friendCheck as any).rows ?? friendCheck;
      if (!Array.isArray(friendRows) || friendRows.length === 0) continue;

      // Skip if already member
      const memCheck = await (db as any).execute(
        "select 1 from public.group_members where group_id = $1 and user_id = $2 limit 1",
        [group.id, targetId]
      );
      const memRows = (memCheck as any).rows ?? memCheck;
      if (Array.isArray(memRows) && memRows.length) continue;

      // Insert invite (ignore duplicates)
      await (db as any).execute(
        `insert into public.group_invites (group_id, from_user_id, to_user_id, status, created_at)
         values ($1, $2, $3, 'pending', now())
         on conflict do nothing`,
        [group.id, user.id, targetId]
      );
      invited += 1;
    }

    return NextResponse.json({ invited });
  } catch (err) {
    console.error("group invite create error", err);
    return NextResponse.json({ error: "Failed to invite members" }, { status: 500 });
  }
}
