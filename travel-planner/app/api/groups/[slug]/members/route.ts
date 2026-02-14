import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireDb } from "@/src/db/db";
import { sql } from "drizzle-orm";

async function findGroup(db: any, key: string) {
  const res = await db.execute(sql`select id from public.groups where id::text = ${key} or slug = ${key} limit 1`);
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

    const memberCheck = await db.execute(sql`select 1 from public.group_members where group_id = ${group.id} and user_id = ${user.id} limit 1`);
    const memberRows = (memberCheck as any).rows ?? memberCheck;
    // Usuwamy warunek blokujący dostęp, by zawsze zwracać listę (może być pusta)

    const memberRes = await db.execute(sql`
      select
        gm.user_id as id,
        gm.role,
        p.username,
        p.full_name,
        COALESCE(NULLIF(u.avatar_url, ''), NULLIF(p.avatar_url, '')) as avatar_url,
        p.public_id
      from public.group_members gm
      join public.profiles p on p.id = gm.user_id
      left join public.users u on u.id = gm.user_id
      where gm.group_id = ${group.id}
      order by gm.joined_at asc
    `);
    const rows = (memberRes as any).rows ?? memberRes;
    const normalizeAvatarPath = (value: unknown) => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
        return trimmed;
      }
      return `/${trimmed}`;
    };

    const members = Array.isArray(rows)
      ? rows.map((r: any) => ({
          id: String(r.id),
          username: r.username ?? null,
          fullName: r.full_name ?? null,
          avatarUrl: normalizeAvatarPath(r.avatar_url),
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
