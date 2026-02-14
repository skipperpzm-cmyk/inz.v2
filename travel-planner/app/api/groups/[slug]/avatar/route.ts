import { NextResponse, NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth";
import { requireDb } from "@/src/db/db";
import { sql } from "drizzle-orm";

async function findGroup(db: any, key: string) {
  const res = await db.execute(sql`select id from public.groups where id::text = ${key} or slug = ${key} limit 1`);
  const rows = (res as any).rows ?? res;
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

type Body = {
  dataUrl: string;
};

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const params = await context.params;
  const key = params.slug;
  if (!key) return NextResponse.json({ error: "Missing group" }, { status: 400 });

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { dataUrl } = body || {};
  if (!dataUrl || typeof dataUrl !== "string") {
    return NextResponse.json({ error: "Missing dataUrl" }, { status: 400 });
  }

  const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "Invalid image data" }, { status: 400 });

  const mime = match[1];
  const b64 = match[2];
  if (!mime.startsWith("image/")) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

  const buffer = Buffer.from(b64, "base64");
  const maxBytes = 2 * 1024 * 1024;
  if (buffer.length > maxBytes) return NextResponse.json({ error: "File too large" }, { status: 413 });

  try {
    const db = requireDb();
    const group = await findGroup(db, key);
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const adminCheck = await db.execute(sql`select 1 from public.group_members where group_id = ${group.id} and user_id = ${user.id} and role = 'admin' limit 1`);
    const adminRows = (adminCheck as any).rows ?? adminCheck;
    if (!Array.isArray(adminRows) || adminRows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ext = mime.split("/")[1].split("+")[0];
    const filename = `${uuidv4()}.${ext}`;
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "groups");
    await fs.mkdir(uploadsDir, { recursive: true });
    const outPath = path.join(uploadsDir, filename);
    await fs.writeFile(outPath, buffer);

    const avatarUrl = `/uploads/groups/${filename}`;
    await db.execute(sql`update public.groups set avatar_url = ${avatarUrl}, updated_at = now() where id = ${group.id}`);

    return NextResponse.json({ avatarUrl });
  } catch (err) {
    console.error("group avatar upload error", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
