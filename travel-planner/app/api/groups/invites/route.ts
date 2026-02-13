import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireDb } from "@/src/db/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json([], { status: 200 });

  try {
    const db = requireDb();
    // UWAGA: interpolacja user.id jest bezpieczna, bo to nasz własny ID z sesji
    const res = await (db as any).execute(
      `select
        gi.id,
        gi.group_id,
        gi.from_user_id,
        gi.created_at,
        g.name as group_name,
        p.username,
        p.full_name,
        p.avatar_url,
        p.public_id
      from public.group_invites gi
      join public.groups g on g.id = gi.group_id
      join public.profiles p on p.id = gi.from_user_id
      where gi.to_user_id = '${user.id}' and gi.status = 'pending'
      order by gi.created_at desc`
    );
    const rows = (res as any).rows ?? res;
    const data = Array.isArray(rows) ? rows : [];
    const mapped = data.map((r: any) => ({
      id: String(r.id),
      groupId: String(r.group_id),
      groupName: String(r.group_name ?? ""),
      fromUserId: String(r.from_user_id),
      fromName: r.full_name ?? r.username ?? null,
      fromAvatarUrl: r.avatar_url ?? null,
      fromPublicId: r.public_id ?? null,
      createdAt: r.created_at ?? null,
    }));
    return NextResponse.json(mapped);
  } catch (err) {
    console.error("group invites list error", err);
    return NextResponse.json({ error: "Failed to fetch group invites" }, { status: 500 });
  }
}
