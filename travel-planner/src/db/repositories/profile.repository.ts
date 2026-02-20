import { sql } from 'drizzle-orm';
import { requireDb } from 'src/db/db';

function isMissingUserSessionsTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.toLowerCase().includes('relation "public.user_sessions" does not exist');
}

// Update live presence fields for a profile row.
export async function setOnlineStatus(userId: string, online: boolean) {
  const db = requireDb();

  await db.execute(
    sql`UPDATE public.profiles SET online = ${online}, last_online_at = now() WHERE id = ${userId}`
  );

  try {
    if (online) {
      await db.execute(sql`
        update public.user_sessions
        set
          session_end = coalesce(session_end, last_seen_at, now()),
          updated_at = now(),
          duration_seconds = greatest(
            0,
            extract(epoch from (coalesce(session_end, last_seen_at, now()) - session_start))::int
          )
        where user_id = ${userId}
          and session_end is null
          and coalesce(last_seen_at, session_start) < now() - interval '5 minutes'
      `);

      await db.execute(sql`
        update public.user_sessions
        set last_seen_at = now(), updated_at = now()
        where user_id = ${userId}
          and session_end is null
      `);

      await db.execute(sql`
        insert into public.user_sessions (user_id, session_start, last_seen_at, source)
        select ${userId}, now(), now(), 'heartbeat'
        where not exists (
          select 1
          from public.user_sessions us
          where us.user_id = ${userId}
            and us.session_end is null
        )
      `);

      return;
    }

    await db.execute(sql`
      update public.user_sessions
      set
        session_end = now(),
        last_seen_at = coalesce(last_seen_at, now()),
        updated_at = now(),
        duration_seconds = greatest(0, extract(epoch from (now() - session_start))::int)
      where user_id = ${userId}
        and session_end is null
    `);
  } catch (error) {
    if (isMissingUserSessionsTable(error)) return;
    throw error;
  }
}
