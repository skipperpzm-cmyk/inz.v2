import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth';
import { requireDb } from 'src/db/db';
import { sql } from 'drizzle-orm';

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const fieldsToUpdate: Record<string, unknown> = {};

  if (typeof body.username === 'string') {
    const nextUsername = body.username.trim();
    if (!nextUsername) return NextResponse.json({ error: 'Missing username' }, { status: 400 });
    if (nextUsername.length < 3) return NextResponse.json({ error: 'Username too short' }, { status: 422 });
    if (nextUsername.length > 64) return NextResponse.json({ error: 'Username too long' }, { status: 422 });
    // Allow letters, digits, underscore, dot and hyphen; allow uppercase letters
    if (!/^[A-Za-z0-9_.-]+$/.test(nextUsername)) return NextResponse.json({ error: 'Invalid username format' }, { status: 422 });
    // Update display name and legacy `username` only; slug history is deprecated.
    const nextLower = nextUsername.toLowerCase();
    // Basic uniqueness check against legacy `username` columns to avoid clashes.
    try {
      const db = requireDb();
      const conflictProfiles = await (db as any).execute(sql`SELECT id FROM public.profiles WHERE lower(username) = ${nextLower} AND id != ${user.id} LIMIT 1`);
      const rowsProfiles = (conflictProfiles as any).rows ?? conflictProfiles;
      if (Array.isArray(rowsProfiles) && rowsProfiles.length > 0) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
      }
      const conflictUsers = await (db as any).execute(sql`SELECT id FROM public.users WHERE lower(username) = ${nextLower} AND id != ${user.id} LIMIT 1`);
      const rowsUsers = (conflictUsers as any).rows ?? conflictUsers;
      if (Array.isArray(rowsUsers) && rowsUsers.length > 0) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
      }
    } catch (err) {
      console.error('username uniqueness check failed', err);
    }

    fieldsToUpdate['username_display'] = nextUsername;
    fieldsToUpdate['username'] = nextUsername;
  }

  if (typeof body.full_name === 'string') fieldsToUpdate['full_name'] = body.full_name;
  if (Object.prototype.hasOwnProperty.call(body, 'bio')) fieldsToUpdate['bio'] = body.bio ?? null;
  if (typeof body.avatar_url === 'string') fieldsToUpdate['avatar_url'] = body.avatar_url ?? null;

  if (Object.keys(fieldsToUpdate).length === 0) return NextResponse.json({ error: 'No supported fields in request' }, { status: 400 });

  try {
    const db = requireDb();

    // Build the UPDATE for public.profiles using sql-tagged templates
    const assignments: any[] = [];
    for (const [k, v] of Object.entries(fieldsToUpdate)) {
      assignments.push(sql`${sql.raw(k)} = ${v}`);
    }
    // updated_at timestamp
    assignments.push(sql`updated_at = now()`);

    // Perform both updates in a transaction to keep `public.users` and
    // `public.profiles` in sync atomically when username changes.
    let profile: any = null;
    try {
      await (db as any).transaction(async (tx: any) => {
        // If username changed, update legacy columns in public.users if present.
        if (fieldsToUpdate['username_display'] || fieldsToUpdate['username']) {
          const newDisplay = String(fieldsToUpdate['username_display'] ?? fieldsToUpdate['username'] ?? '');
          // Only attempt to update public.users if the expected columns exist there.
          try {
            const pubColCheck = await tx.execute(
              sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name in ('username_display','username')`
            );
            const pubColRows = (pubColCheck as any).rows ?? pubColCheck;
            if (Array.isArray(pubColRows) && pubColRows.length > 0) {
              try {
                await tx.execute(sql`UPDATE public.users SET username_display = ${newDisplay}, username = ${newDisplay} WHERE id = ${user.id}`);
              } catch (innerErr: any) {
                throw innerErr;
              }
            } else {
                // public.users does not contain username_display — skipping public.users update.
              }
          } catch (pubCheckErr) {
            throw pubCheckErr;
          }

          // Best-effort: attempt to update auth.users if available, but do not let failures abort the transaction.
          try {
            const colCheck = await tx.execute(
              sql`select column_name from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name in ('username_display','username')`
            );
            const colRows = (colCheck as any).rows ?? colCheck;
            if (Array.isArray(colRows) && colRows.length > 0) {
              try {
                await tx.execute(sql`UPDATE auth.users SET username_display = ${newDisplay}, username = ${newDisplay} WHERE id = ${user.id}`);
              } catch (inner2) {
                console.error('failed to update auth.users with new username fields', inner2);
              }
            }
          } catch (innerCheckErr) {
            // ignore auth schema checks/failures
          }
        }

        // Update profiles
        const stmt = sql`UPDATE public.profiles SET ${sql.join(assignments, sql`, `)} WHERE id = ${user.id} RETURNING *`;
        const updated = await tx.execute(stmt);
        const updatedRows = (updated as any).rows ?? updated;
        profile = Array.isArray(updatedRows) && updatedRows.length ? updatedRows[0] : null;

        // If username changed, update public.users (display and legacy username)
        if (fieldsToUpdate['username_display'] || fieldsToUpdate['username']) {
          const newDisplay = String(fieldsToUpdate['username_display'] ?? fieldsToUpdate['username'] ?? '');
          // Only attempt to update public.users if the expected columns exist there.
          try {
            const pubColCheck = await tx.execute(
              sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name in ('username_display','username')`
            );
            const pubColRows = (pubColCheck as any).rows ?? pubColCheck;
            if (Array.isArray(pubColRows) && pubColRows.length > 0) {
              try {
                await tx.execute(sql`UPDATE public.users SET username_display = ${newDisplay}, username = ${newDisplay} WHERE id = ${user.id}`);
              } catch (innerErr: any) {
                throw innerErr;
              }
            } else {
              // public.users doesn't have these columns in this DB — skip updating it.
            }
          } catch (pubCheckErr) {
            throw pubCheckErr;
          }

          // Best-effort: attempt to update auth.users if available, but do not let failures abort the transaction.
          try {
            const colCheck = await tx.execute(
              sql`select column_name from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name in ('username_display','username')`
            );
            const colRows = (colCheck as any).rows ?? colCheck;
            if (Array.isArray(colRows) && colRows.length > 0) {
              try {
                await tx.execute(sql`UPDATE auth.users SET username_display = ${newDisplay}, username = ${newDisplay} WHERE id = ${user.id}`);
              } catch (inner2) {
                console.error('failed to update auth.users with new username fields', inner2);
              }
            }
          } catch (innerCheckErr) {
            // ignore auth schema checks/failures
          }
        }
      });
    } catch (err: any) {
      // Handle concurrent UNIQUE violations (username index)
      if (err && err.code === '23505') {
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
      }
      console.error('transaction failed updating profile', err);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    // Profile update committed. Slug-based revalidation removed as slug routing is deprecated.
    return NextResponse.json({ profile });
  } catch (err) {
    console.error('failed to update profile', err);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
