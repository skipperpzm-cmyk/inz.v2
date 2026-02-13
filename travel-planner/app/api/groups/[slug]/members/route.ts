import { NextResponse } from "next/server";
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

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const params = await context.params;
  const key = params.slug;
  if (!key) return NextResponse.json({ error: "Missing group" }, { status: 400 });

  try {
    const db = requireDb();
    const group = await findGroup(db, key);
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const memberCheck = await (db as any).execute(
      "select 1 from public.group_members where group_id = $1 and user_id = $2 limit 1",
      [group.id, user.id]
    );
    const memberRows = (memberCheck as any).rows ?? memberCheck;
    if (!Array.isArray(memberRows) || memberRows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const memberRes = await (db as any).execute(
      `select gm.user_id as id, gm.role, p.username, p.full_name, p.avatar_url, p.public_id
       from public.group_members gm
       join public.profiles p on p.id = gm.user_id
       where gm.group_id = $1
       order by gm.joined_at asc`,
      [group.id]
    );
    const rows = (memberRes as any).rows ?? memberRes;
    const members = Array.isArray(rows)
      ? rows.map((r: any) => ({
          id: String(r.id),
          username: r.username ?? null,
          fullName: r.full_name ?? null,
          avatarUrl: r.avatar_url ?? null,
          publicId: r.public_id ?? null,
          role: r.role === "admin" ? "admin" : "member",
        }))
      : [];

    return NextResponse.json(members);
  } catch (err) {
    console.error("group members error", err);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}
