import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { requireDb } from 'src/db/db';
import { sql as drizzleSql } from 'drizzle-orm';
import { users } from '../schema';
import { sql } from 'drizzle-orm';

const sanitize = (user: any, profile: any = null) => ({
  id: user.id,
  email: user.email,
  // Prefer the case-preserving display username for UI; fall back to legacy username.
  username: (profile && profile.username_display) ?? (user as any).usernameDisplay ?? user.username,
  usernameDisplay: (profile && profile.username_display) ?? (user as any).usernameDisplay ?? null,
  usernameSlug: (profile && (profile.username_slug ?? null)) ?? (user as any).usernameSlug ?? null,
  publicId: profile ? profile.public_id ?? null : (user as any).publicId ?? null,
  avatarUrl: user.avatarUrl,
  // Keep DB value as-is: null means "no static background selected" so UI can show animated fallback
  backgroundUrl: (user as any).backgroundUrl ?? null,
  createdAt: user.createdAt,
});

export async function createUser({ email, username, password }: { email: string; username: string; password: string }) {
  const normalizedEmail = email.toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);
  const usernameDisplay = username;
  // slug fields removed from repository logic — legacy DB columns may remain but
  // we no longer manage profile_slugs or username_slug/current_slug here.
  const id = uuidv4();

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);

  const usernameSlug = slugify(usernameDisplay);

  const db = requireDb();

  try {
    await (db as any).transaction(async (tx: any) => {
      // insert user — include username_slug to satisfy DB constraints when present
      await tx.execute(
        drizzleSql`INSERT INTO public.users (id, email, username, username_display, username_slug, password_hash, avatar_url, background_url, created_at)
          VALUES (${id}, ${normalizedEmail}, ${usernameDisplay}, ${usernameDisplay}, ${usernameSlug}, ${passwordHash}, default, default, now())`
      );

      // insert profile row (idempotent). Include `username_slug` to satisfy newer DB schemas.
      await tx.execute(
        drizzleSql`INSERT INTO public.profiles (id, username, username_display, username_slug, created_at)
          VALUES (${id}, ${usernameDisplay}, ${usernameDisplay}, ${usernameSlug}, now()) ON CONFLICT (id) DO NOTHING`
      );
    });

    // fetch and return the created user
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!rows[0]) return null;
    // Fetch profile row to include public_id and display username
    const profRes = await (db as any).execute(sql`SELECT public_id, username_display, username, username_slug FROM public.profiles WHERE id = ${id} LIMIT 1`);
    const profRows = (profRes as any).rows ?? profRes;
    const profile = Array.isArray(profRows) && profRows.length > 0 ? profRows[0] : null;
    return sanitize(rows[0], profile);
  } catch (err: any) {
    // bubble up uniqueness errors for caller to surface (e.g., username/email taken)
    if (err && err.code === '23505') throw err;
    console.error('failed to create user/profile/slug transactionally', err);
    throw err;
  }
}

export async function getUserByEmail(email: string) {
  try {
    const row = await requireDb().select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return row[0] ?? null;
  } catch (err) {
    // Fallback for databases that haven't had the `background_url` column added yet.
    // Select a safe subset of columns to avoid SQL errors.
    try {
      const row = await requireDb()
        .select({ id: users.id, email: users.email, username: users.username, passwordHash: users.passwordHash, avatarUrl: users.avatarUrl, createdAt: users.createdAt })
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);
      if (!row[0]) return null;
      // fetch profile fields if available
      try {
        const profRes = await (requireDb() as any).execute(sql`SELECT public_id, username_display, username, username_slug FROM public.profiles WHERE id = ${row[0].id} LIMIT 1`);
        const profRows = (profRes as any).rows ?? profRes;
        const profile = Array.isArray(profRows) && profRows.length > 0 ? profRows[0] : null;
        return sanitize(row[0], profile);
      } catch (inner) {
        return sanitize(row[0]);
      }
    } catch (inner: any) {
      throw inner;
    }
  }
}

export const findByEmail = getUserByEmail;

export async function getUserById(id: string) {
  try {
    const row = await requireDb().select().from(users).where(eq(users.id, id)).limit(1);
    if (!row[0]) return null;
    // fetch profile row to include public_id and display username
    try {
      const profRes = await (requireDb() as any).execute(sql`SELECT public_id, username_display, username, username_slug FROM public.profiles WHERE id = ${id} LIMIT 1`);
      const profRows = (profRes as any).rows ?? profRes;
      const profile = Array.isArray(profRows) && profRows.length > 0 ? profRows[0] : null;
      return profile ? sanitize(row[0], profile) : sanitize(row[0]);
    } catch (inner) {
      return sanitize(row[0]);
    }
  } catch (err) {
    // Fallback when `background_url` column is missing in the DB.
    try {
      const row = await requireDb()
        .select({ id: users.id, email: users.email, username: users.username, passwordHash: users.passwordHash, avatarUrl: users.avatarUrl, createdAt: users.createdAt })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return row[0]
        ? sanitize({
            id: row[0].id,
            email: row[0].email,
            username: row[0].username,
            avatarUrl: row[0].avatarUrl,
            // ensure missing background_url yields null so UI falls back to animated
            backgroundUrl: null as any,
            createdAt: row[0].createdAt,
            passwordHash: (row[0] as any).passwordHash,
          } as any)
        : null;
    } catch (inner: any) {
      throw inner;
    }
  }
}

/**
 * Fetch a profile by its stable public_id (8-digit string).
 * Returns profile fields joined with user fields when available.
 */
export async function getProfileByPublicId(publicId: string) {
  try {
    const db = requireDb();
    const res = await (db as any).execute(
      // Prefer the user's `avatar_url` from the `users` table; fall back to the profile-level `avatar_url` if present.
      sql`SELECT p.id, p.public_id, p.username, p.username_display, p.username_slug, p.full_name, COALESCE(u.avatar_url, p.avatar_url) AS avatar_url, p.bio, u.email
            FROM public.profiles p
            JOIN public.users u ON p.id = u.id
            WHERE p.public_id = ${publicId} LIMIT 1`
    );
    const rows = (res as any).rows ?? res;
    if (Array.isArray(rows) && rows.length > 0) return rows[0];
    return null;
  } catch (err) {
    throw err;
  }
}

/**
 * Find a single profile by a case-insensitive display name or full name.
 * Returns null when no match found.
 */
export async function findProfileByName(name: string) {
  try {
    const db = requireDb();
    const res = await (db as any).execute(
      sql`SELECT p.id, p.public_id, p.username_display, p.username, p.username_slug, p.full_name, COALESCE(u.avatar_url, p.avatar_url) AS avatar_url, p.bio, u.email
            FROM public.profiles p
            JOIN public.users u ON p.id = u.id
            WHERE lower(p.username_display) = lower(${name}) OR lower(p.full_name) = lower(${name})
            LIMIT 1`
    );
    const rows = (res as any).rows ?? res;
    if (Array.isArray(rows) && rows.length > 0) return rows[0];
    return null;
  } catch (err) {
    throw err;
  }
}

export async function updateAvatarUrl(id: string, avatarUrl: string) {
  const updated = await requireDb()
    .update(users)
    .set({ avatarUrl })
    .where(eq(users.id, id))
    .returning();
  return updated[0] ? sanitize(updated[0]) : null;
}

export async function updateBackgroundUrl(id: string, backgroundUrl: string | null) {
  const updated = await requireDb()
    .update(users)
    .set({ backgroundUrl })
    .where(eq(users.id, id))
    .returning();
  return updated[0] ? sanitize(updated[0]) : null;
}

export async function updateUsername(id: string, username: string) {
  const usernameDisplay = username;
  const db = requireDb();
  let out: any = null;
  try {
    await (db as any).transaction(async (tx: any) => {
      // Update users table (keep display name in users)
      const updated = await tx.update(users).set({ usernameDisplay }).where(eq(users.id, id)).returning();
      out = updated[0] ? sanitize(updated[0]) : null;

      // Update the profiles table display name/legacy username.
      await tx.execute(sql`UPDATE public.profiles SET username = ${usernameDisplay}, username_display = ${usernameDisplay}, updated_at = now() WHERE id = ${id}`);
    });
  } catch (err: any) {
    if (err && err.code === '23505') {
      throw err;
    }
    console.error('failed to update username in transaction', err);
    throw err;
  }

  return out;
}

export async function validateUserCredentials(email: string, password: string) {
  // Fetch password hash directly to avoid returning sanitized user without the hash.
  try {
    const rows = await requireDb()
      .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    if (!rows[0]) return { valid: false, user: null };
    const ok = await bcrypt.compare(password, rows[0].passwordHash ?? '');
    if (!ok) return { valid: false, user: null };
    // Return sanitized user (includes profile public_id if available)
    const user = await getUserById(rows[0].id);
    return { valid: ok, user: user ?? null };
  } catch (err) {
    throw err;
  }
}

export async function searchFriends(query: string, limit = 10) {
  const q = query.trim();
  if (!q) return [];
  const take = Math.min(Math.max(Number(limit) || 10, 1), 20);
  const lower = q.toLowerCase();
  const like = `%${lower}%`;
  const digitsOnly = /^\d+$/.test(q);

  const db = requireDb();
  const res = await (db as any).execute(
    sql`SELECT p.id, p.public_id,
        COALESCE(p.username_display, p.full_name, p.username) AS name,
        COALESCE(u.avatar_url, p.avatar_url) AS avatar_url
      FROM public.profiles p
      LEFT JOIN public.users u ON u.id = p.id
      WHERE lower(p.username_display) LIKE ${like}
         OR lower(p.full_name) LIKE ${like}
         OR lower(p.username) LIKE ${like}
         OR (${digitsOnly} AND p.public_id::text LIKE ${`%${q}%`})
      ORDER BY p.username_display NULLS LAST
      LIMIT ${take}`
  );
  const rows = (res as any).rows ?? res;
  return Array.isArray(rows) ? rows : [];
}

export type AddFriendRow = {
  id: string;
  public_id: string | null;
  name: string | null;
  avatar_url: string | null;
};

export async function findFriendsByPartialPublicId(partialId: string, limit = 10): Promise<AddFriendRow[]> {
  const q = partialId.trim();
  if (!q) return [];
  const take = Math.min(Math.max(Number(limit) || 10, 1), 20);
  const db = requireDb();
  const res = await (db as any).execute(
    sql`SELECT p.id, p.public_id,
        COALESCE(p.username_display, p.full_name, p.username) AS name,
        COALESCE(u.avatar_url, p.avatar_url) AS avatar_url
      FROM public.profiles p
      LEFT JOIN public.users u ON u.id = p.id
      WHERE p.public_id::text LIKE ${`${q}%`}
      ORDER BY p.public_id ASC
      LIMIT ${take}`
  );
  const rows = (res as any).rows ?? res;
  return Array.isArray(rows) ? rows : [];
}

export async function findFriendsByPartialName(partialName: string, limit = 10): Promise<AddFriendRow[]> {
  const q = partialName.trim();
  if (!q) return [];
  const take = Math.min(Math.max(Number(limit) || 10, 1), 20);
  const like = `%${q.toLowerCase()}%`;
  const db = requireDb();
  const res = await (db as any).execute(
    sql`SELECT p.id, p.public_id,
        COALESCE(p.username_display, p.full_name, p.username) AS name,
        COALESCE(u.avatar_url, p.avatar_url) AS avatar_url
      FROM public.profiles p
      LEFT JOIN public.users u ON u.id = p.id
      WHERE lower(p.username_display) LIKE ${like}
         OR lower(p.full_name) LIKE ${like}
         OR lower(p.username) LIKE ${like}
      ORDER BY p.username_display NULLS LAST
      LIMIT ${take}`
  );
  const rows = (res as any).rows ?? res;
  return Array.isArray(rows) ? rows : [];
}

export async function findProfilesByName(name: string) {
  try {
    const db = requireDb();
    const res = await (db as any).execute(
      sql`SELECT p.id, p.public_id, p.username_display, p.username, p.username_slug, p.full_name, COALESCE(u.avatar_url, p.avatar_url) AS avatar_url, p.bio, u.email
            FROM public.profiles p
            JOIN public.users u ON p.id = u.id
            WHERE lower(p.username_display) LIKE lower(${`%${name}%`}) OR lower(p.full_name) LIKE lower(${`%${name}%`})`
    );
    const rows = (res as any).rows ?? res;
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    throw err;
  }
}
