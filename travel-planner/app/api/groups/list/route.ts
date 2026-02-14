import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sqlClient } from "@/src/db/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json([], { status: 200 });

  try {
    if (!sqlClient) throw new Error('Database client not initialized');
    const rows = await sqlClient`
      select
        g.id,
        g.name,
        g.avatar_url,
        g.slug,
        g.description,
        g.is_private,
        g.created_by,
        gm.role,
        (select count(*) from public.group_members gm2 where gm2.group_id = g.id) as member_count
      from public.groups g
      join public.group_members gm on gm.group_id = g.id
      where gm.user_id = ${user.id}
      order by g.name asc
    `;
    const data = Array.isArray(rows) ? rows : (rows as any).rows ?? [];
    const mapped = Array.isArray(data)
      ? data.map((r: any) => ({
          id: String(r.id),
          name: String(r.name ?? ""),
          avatarUrl: r.avatar_url ?? null,
          slug: r.slug ?? null,
          description: r.description ?? null,
          isPrivate: Boolean(r.is_private),
          memberCount: Number(r.member_count ?? r.count ?? 0),
          role: r.role === "admin" ? "admin" : "member",
          createdBy: r.created_by ? String(r.created_by) : undefined,
        }))
      : [];

    return NextResponse.json(mapped);
  } catch (err) {
    console.error("groups list error", err);
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 });
  }
}
