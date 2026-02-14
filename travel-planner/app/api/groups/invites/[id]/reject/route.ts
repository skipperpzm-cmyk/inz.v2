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
    await (db as any).execute(
      sql`delete from public.group_invites where id = ${inviteId} and to_user_id = ${user.id}`
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("group invite reject error", err);
    return NextResponse.json({ error: "Failed to reject invite" }, { status: 500 });
  }
}
