import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireDb } from "@/src/db/db";
import { sql } from "drizzle-orm";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const params = await context.params;
  const inviteId = params.id;
  if (!inviteId) return NextResponse.json({ error: "Missing invite id" }, { status: 400 });

  try {
    const db = requireDb();
    const inviteRes = await (db as any).execute(
      sql`select gi.id, gi.group_id, gi.to_user_id, g.name as group_name
          from public.group_invites gi
          join public.groups g on g.id = gi.group_id
          where gi.id = ${inviteId} and gi.to_user_id = ${user.id} and gi.status = 'pending'
          limit 1`
    );
    const inviteRows = (inviteRes as any).rows ?? inviteRes;
    const invite = Array.isArray(inviteRows) && inviteRows.length ? inviteRows[0] : null;
    if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

    await (db as any).execute(
      sql`insert into public.group_members (group_id, user_id, role, joined_at)
          values (${invite.group_id}, ${user.id}, 'member', now())
          ON CONFLICT (group_id, user_id) DO NOTHING`
    );

    await (db as any).execute(
      sql`delete from public.group_invites where id = ${inviteId} and to_user_id = ${user.id}`
    );

    return NextResponse.json({
      groupId: String(invite.group_id),
      groupName: String(invite.group_name ?? ""),
    });
  } catch (err) {
    console.error("group invite accept error", err);
    return NextResponse.json({ error: "Failed to accept invite" }, { status: 500 });
  }
}
