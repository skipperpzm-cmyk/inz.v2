import { NextResponse, NextRequest } from "next/server";
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
  const key = params.slug;
  if (!key) return NextResponse.json({ error: "Missing group" }, { status: 400 });

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (name.length > 200) return NextResponse.json({ error: "Name too long" }, { status: 422 });

  try {
    const db = requireDb();
    const group = await findGroup(db, key);
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const adminCheck = await (db as any).execute(
      "select 1 from public.group_members where group_id = $1 and user_id = $2 and role = $3 limit 1",
      [group.id, user.id, "admin"]
    );
    const adminRows = (adminCheck as any).rows ?? adminCheck;
    if (!Array.isArray(adminRows) || adminRows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await (db as any).execute("update public.groups set name = $1, updated_at = now() where id = $2", [name, group.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("rename group error", err);
    return NextResponse.json({ error: "Failed to rename group" }, { status: 500 });
  }
}
