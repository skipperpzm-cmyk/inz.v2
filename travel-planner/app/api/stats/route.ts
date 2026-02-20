import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { sqlClient } from '@/src/db/db';

type StatsMode = 'solo' | 'group';
type RangePreset = '7' | '30' | '90' | 'all' | 'custom';

type TrendPoint = {
  date: string;
  posts: number;
  comments: number;
  onlineSeconds: number;
};

type HeatmapCell = {
  dayOfWeek: number;
  hour: number;
  value: number;
};

type RankingEntry = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  posts: number;
  comments: number;
  onlineSeconds: number;
  reactions: number;
  score: number;
};

type BoardOption = { id: string; title: string };
type GroupUserOption = { id: string; name: string; avatarUrl: string | null };

type SoloStats = {
  kpi: {
    posts: number;
    comments: number;
    onlineSeconds: number;
    completedTrips: number;
    deltas: {
      posts: number;
      comments: number;
      onlineSeconds: number;
      completedTrips: number;
    };
  };
  online: {
    totalSeconds: number;
    avgSessionSeconds: number;
    sessionsCount: number;
    trend: TrendPoint[];
  };
  trips: {
    completedTrips: number;
    totalTripDays: number;
    mostFrequentDirection: string | null;
    longestTripDays: number;
    averageBudget: number | null;
  };
  engagement: {
    mentionsReceived: number;
    reactionsReceived: number;
    averageCommentsOnPosts: number;
    topEmojis: Array<{ emoji: string; count: number }>;
  };
  activityTrend: TrendPoint[];
};

type GroupStats = {
  kpi: {
    posts: number;
    comments: number;
    onlineSeconds: number;
    groupTrips: number;
    mostActiveUser: string | null;
  };
  ranking: RankingEntry[];
  heatmap: HeatmapCell[];
  trips: {
    totalTrips: number;
    totalTripDays: number;
    mostVisitedPlace: string | null;
    averageTripDays: number;
    mostActiveTraveler: string | null;
  };
  interactions: {
    topEmojis: Array<{ emoji: string; count: number }>;
    mostMentionedUser: string | null;
    averageCommentsPerPost: number;
    mostEngagingPost: {
      postId: string;
      excerpt: string;
      commentsCount: number;
    } | null;
  };
};

type StatsResponse = {
  mode: StatsMode;
  filters: {
    range: RangePreset;
    boardId: string;
    startDate: string | null;
    endDate: string | null;
    userId: string;
  };
  options: {
    boards: BoardOption[];
    users: GroupUserOption[];
  };
  solo: SoloStats;
  group: GroupStats;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseRange(raw: string | null): RangePreset {
  if (raw === '7' || raw === '30' || raw === '90' || raw === 'all' || raw === 'custom') return raw;
  return '30';
}

function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  return DATE_RE.test(raw) ? raw : null;
}

function toPercentChange(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return ((current - previous) / previous) * 100;
}

function parseEmojiTop(rows: Array<{ content: string | null | undefined }>, limit = 5): Array<{ emoji: string; count: number }> {
  const counts = new Map<string, number>();
  const emojiRe = /[\p{Extended_Pictographic}]/gu;

  for (const row of rows) {
    const content = String(row.content ?? '');
    const matches = content.match(emojiRe);
    if (!matches) continue;
    for (const m of matches) {
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([emoji, count]) => ({ emoji, count }));
}

function normalizeDateWindow(range: RangePreset, startDate: string | null, endDate: string | null): { fromIso: string | null; toIsoExclusive: string | null } {
  if (range === 'all') return { fromIso: null, toIsoExclusive: null };

  if (range === 'custom') {
    if (!startDate || !endDate) return { fromIso: null, toIsoExclusive: null };
    const from = new Date(`${startDate}T00:00:00.000Z`);
    const to = new Date(`${endDate}T00:00:00.000Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      return { fromIso: null, toIsoExclusive: null };
    }
    return {
      fromIso: startDate,
      toIsoExclusive: new Date(to.getTime() + DAY_MS).toISOString().slice(0, 10),
    };
  }

  const days = Number(range);
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(todayUtc.getTime() - (Math.max(1, days) - 1) * DAY_MS);
  const toExclusive = new Date(todayUtc.getTime() + DAY_MS);

  return {
    fromIso: from.toISOString().slice(0, 10),
    toIsoExclusive: toExclusive.toISOString().slice(0, 10),
  };
}

async function getAccessibleBoards(userId: string, boardId: string | null): Promise<BoardOption[]> {
  if (!sqlClient) return [];
  const rows = await sqlClient`
    select b.id, b.title
    from public.boards b
    join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
    where coalesce(nullif(b.details->>'archivedAt', ''), '') = ''
      and (${boardId}::uuid is null or b.id = ${boardId}::uuid)
    order by b.title asc
  `;

  return (Array.isArray(rows) ? rows : []).map((row: any) => ({
    id: String(row.id),
    title: String(row.title ?? 'Tablica'),
  }));
}

async function getGroupUsers(userId: string, boardId: string | null): Promise<GroupUserOption[]> {
  if (!sqlClient) return [];
  const rows = await sqlClient`
    with scoped_groups as (
      select distinct b.group_id
      from public.boards b
      join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
      where coalesce(nullif(b.details->>'archivedAt', ''), '') = ''
        and (${boardId}::uuid is null or b.id = ${boardId}::uuid)
    )
    select distinct p.id,
      coalesce(nullif(u.username_display, ''), nullif(p.full_name, ''), p.username, 'Użytkownik') as name,
      coalesce(nullif(u.avatar_url, ''), nullif(p.avatar_url, '')) as avatar_url
    from public.group_members gm
    join scoped_groups sg on sg.group_id = gm.group_id
    join public.profiles p on p.id = gm.user_id
    left join public.users u on u.id = p.id
    order by name asc
  `;

  return (Array.isArray(rows) ? rows : []).map((row: any) => ({
    id: String(row.id),
    name: String(row.name ?? 'Użytkownik'),
    avatarUrl: row.avatar_url ?? null,
  }));
}

async function hasUserSessionsTable(): Promise<boolean> {
  if (!sqlClient) return false;
  const rows = await sqlClient`select to_regclass('public.user_sessions')::text as tbl`;
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  return Boolean(row?.tbl);
}

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const url = new URL(request.url);
  const modeParam = (url.searchParams.get('mode') ?? 'solo').toLowerCase();
  const mode: StatsMode = modeParam === 'group' ? 'group' : 'solo';
  const range = parseRange(url.searchParams.get('range'));
  const boardIdRaw = url.searchParams.get('boardId') ?? 'all';
  const boardId = UUID_RE.test(boardIdRaw) ? boardIdRaw : null;
  const startDate = parseDate(url.searchParams.get('startDate'));
  const endDate = parseDate(url.searchParams.get('endDate'));
  const groupUserIdRaw = url.searchParams.get('userId') ?? 'all';
  const groupUserId = UUID_RE.test(groupUserIdRaw) ? groupUserIdRaw : null;

  const { fromIso, toIsoExclusive } = normalizeDateWindow(range, startDate, endDate);

  const hasUserSessions = await hasUserSessionsTable();
  const [boards, users] = await Promise.all([
    getAccessibleBoards(userId, boardId),
    getGroupUsers(userId, boardId),
  ]);

  const sessionWindowFilter = hasUserSessions
    ? sqlClient`
      and (${fromIso}::date is null or us.session_start >= ${fromIso}::date)
      and (${toIsoExclusive}::date is null or us.session_start < ${toIsoExclusive}::date)
    `
    : null;

  const [soloKpiRows, soloKpiPrevRows, soloTripsRows, soloMentionsRows, soloCommentsOnPostsRows, soloTrendRows, groupKpiRows, groupRankingRows, groupHeatmapRows, groupTripsRows, groupMostMentionedRows, groupMostEngagingRows, soloEmojiRows, groupEmojiRows, soloOnlineRows, groupOnlineRows] = await Promise.all([
    sqlClient`
      with accessible_boards as (
        select b.id, b.group_id
        from public.boards b
        join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
        where coalesce(nullif(b.details->>'archivedAt', ''), '') = ''
          and (${boardId}::uuid is null or b.id = ${boardId}::uuid)
      )
      select
        (select count(*)::int from public.group_posts gp join accessible_boards ab on ab.id = gp.board_id where gp.author_id = ${userId} and (${fromIso}::date is null or gp.created_at >= ${fromIso}::date) and (${toIsoExclusive}::date is null or gp.created_at < ${toIsoExclusive}::date)) as posts,
        (select count(*)::int from public.group_comments gc join accessible_boards ab on ab.id = gc.board_id where gc.author_id = ${userId} and (${fromIso}::date is null or gc.created_at >= ${fromIso}::date) and (${toIsoExclusive}::date is null or gc.created_at < ${toIsoExclusive}::date)) as comments,
        (select count(*)::int from public.boards b join accessible_boards ab on ab.id = b.id where b.created_by = ${userId} and coalesce((b.details->>'status') = 'completed', false) and (${fromIso}::date is null or coalesce(b.end_date, b.created_at::date) >= ${fromIso}::date) and (${toIsoExclusive}::date is null or coalesce(b.end_date, b.created_at::date) < ${toIsoExclusive}::date)) as completed_trips
    `,
    sqlClient`
      with accessible_boards as (
        select b.id, b.group_id
        from public.boards b
        join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
        where coalesce(nullif(b.details->>'archivedAt', ''), '') = ''
          and (${boardId}::uuid is null or b.id = ${boardId}::uuid)
      ),
      bounds as (
        select
          case
            when ${fromIso}::date is null or ${toIsoExclusive}::date is null then null::date
            else (${fromIso}::date - (${toIsoExclusive}::date - ${fromIso}::date))
          end as prev_from,
          ${fromIso}::date as prev_to
      )
      select
        (select count(*)::int from public.group_posts gp join accessible_boards ab on ab.id = gp.board_id, bounds b where gp.author_id = ${userId} and (b.prev_from is null or gp.created_at >= b.prev_from) and (b.prev_to is null or gp.created_at < b.prev_to)) as posts,
        (select count(*)::int from public.group_comments gc join accessible_boards ab on ab.id = gc.board_id, bounds b where gc.author_id = ${userId} and (b.prev_from is null or gc.created_at >= b.prev_from) and (b.prev_to is null or gc.created_at < b.prev_to)) as comments,
        (select count(*)::int from public.boards bo join accessible_boards ab on ab.id = bo.id, bounds b where bo.created_by = ${userId} and coalesce((bo.details->>'status') = 'completed', false) and (b.prev_from is null or coalesce(bo.end_date, bo.created_at::date) >= b.prev_from) and (b.prev_to is null or coalesce(bo.end_date, bo.created_at::date) < b.prev_to)) as completed_trips
    `,
    sqlClient`
      with accessible_boards as (
        select b.id
        from public.boards b
        join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
        where coalesce(nullif(b.details->>'archivedAt', ''), '') = ''
          and (${boardId}::uuid is null or b.id = ${boardId}::uuid)
      ),
      my_boards as (
        select b.*
        from public.boards b
        join accessible_boards ab on ab.id = b.id
        where b.created_by = ${userId}
      )
      select
        count(*)::int as completed_trips,
        coalesce(sum(greatest(1, (coalesce(end_date, start_date) - coalesce(start_date, end_date) + 1))), 0)::int as total_trip_days,
        (
          select mb.location
          from my_boards mb
          where nullif(trim(mb.location), '') is not null
          group by mb.location
          order by count(*) desc, mb.location asc
          limit 1
        ) as most_frequent_direction,
        coalesce(max(greatest(1, (coalesce(end_date, start_date) - coalesce(start_date, end_date) + 1))), 0)::int as longest_trip_days,
        avg(nullif(regexp_replace(coalesce(budget::text, ''), '[^0-9.-]', '', 'g'), '')::numeric)::numeric(12,2) as average_budget
      from my_boards
      where coalesce((details->>'status') = 'completed', false)
        and (${fromIso}::date is null or coalesce(end_date, created_at::date) >= ${fromIso}::date)
        and (${toIsoExclusive}::date is null or coalesce(end_date, created_at::date) < ${toIsoExclusive}::date)
    `,
    sqlClient`
      with accessible_boards as (
        select b.id
        from public.boards b
        join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
        where coalesce(nullif(b.details->>'archivedAt', ''), '') = ''
          and (${boardId}::uuid is null or b.id = ${boardId}::uuid)
      )
      select count(*)::int as mentions_received
      from public.group_post_mentions gpm
      join accessible_boards ab on ab.id = gpm.board_id
      where gpm.mentioned_user_id = ${userId}
        and (${fromIso}::date is null or gpm.created_at >= ${fromIso}::date)
        and (${toIsoExclusive}::date is null or gpm.created_at < ${toIsoExclusive}::date)
    `,
    sqlClient`
      with accessible_boards as (
        select b.id
        from public.boards b
        join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
        where coalesce(nullif(b.details->>'archivedAt', ''), '') = ''
          and (${boardId}::uuid is null or b.id = ${boardId}::uuid)
      ),
      my_posts as (
        select gp.id
        from public.group_posts gp
        join accessible_boards ab on ab.id = gp.board_id
        where gp.author_id = ${userId}
          and (${fromIso}::date is null or gp.created_at >= ${fromIso}::date)
          and (${toIsoExclusive}::date is null or gp.created_at < ${toIsoExclusive}::date)
      )
      select
        count(mp.id)::int as posts_count,
        count(gc.id)::int as comments_count
      from my_posts mp
      left join public.group_comments gc on gc.post_id = mp.id
    `,
    hasUserSessions
      ? sqlClient`
      with accessible_boards as (
        select b.id
        from public.boards b
        join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
        where coalesce(nullif(b.details->>'archivedAt', ''), '') = ''
          and (${boardId}::uuid is null or b.id = ${boardId}::uuid)
      ),
      posts as (
        select date_trunc('day', gp.created_at)::date as day, count(*)::int as cnt
        from public.group_posts gp
        join accessible_boards ab on ab.id = gp.board_id
        where gp.author_id = ${userId}
          and (${fromIso}::date is null or gp.created_at >= ${fromIso}::date)
          and (${toIsoExclusive}::date is null or gp.created_at < ${toIsoExclusive}::date)
        group by 1
      ),
      comments as (
        select date_trunc('day', gc.created_at)::date as day, count(*)::int as cnt
        from public.group_comments gc
        join accessible_boards ab on ab.id = gc.board_id
        where gc.author_id = ${userId}
          and (${fromIso}::date is null or gc.created_at >= ${fromIso}::date)
          and (${toIsoExclusive}::date is null or gc.created_at < ${toIsoExclusive}::date)
        group by 1
      ),
      sessions as (
        select
          date_trunc('day', us.session_start)::date as day,
          coalesce(sum(coalesce(us.duration_seconds, extract(epoch from (coalesce(us.session_end, least(now(), coalesce(us.last_seen_at, us.session_start))) - us.session_start)))), 0)::bigint as seconds
        from public.user_sessions us
        where ${hasUserSessions}
          and us.user_id = ${userId}
          ${sessionWindowFilter ?? sqlClient``}
        group by 1
      ),
      union_days as (
        select day from posts
        union
        select day from comments
        union
        select day from sessions
      )
      select
        ud.day::text as day,
        coalesce(p.cnt, 0)::int as posts,
        coalesce(c.cnt, 0)::int as comments,
        coalesce(s.seconds, 0)::bigint as online_seconds
      from union_days ud
      left join posts p on p.day = ud.day
      left join comments c on c.day = ud.day
      left join sessions s on s.day = ud.day
      order by ud.day asc
    `
      : sqlClient`
      with accessible_boards as (
        select b.id
        from public.boards b
        join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
        where coalesce(nullif(b.details->>'archivedAt', ''), '') = ''
          and (${boardId}::uuid is null or b.id = ${boardId}::uuid)
      ),
      posts as (
        select date_trunc('day', gp.created_at)::date as day, count(*)::int as cnt
        from public.group_posts gp
        join accessible_boards ab on ab.id = gp.board_id
        where gp.author_id = ${userId}
          and (${fromIso}::date is null or gp.created_at >= ${fromIso}::date)
          and (${toIsoExclusive}::date is null or gp.created_at < ${toIsoExclusive}::date)
        group by 1
      ),
      comments as (
        select date_trunc('day', gc.created_at)::date as day, count(*)::int as cnt
        from public.group_comments gc
        join accessible_boards ab on ab.id = gc.board_id
        where gc.author_id = ${userId}
          and (${fromIso}::date is null or gc.created_at >= ${fromIso}::date)
          and (${toIsoExclusive}::date is null or gc.created_at < ${toIsoExclusive}::date)
        group by 1
      ),
      union_days as (
        select day from posts
        union
        select day from comments
      )
      select
        ud.day::text as day,
        coalesce(p.cnt, 0)::int as posts,
        coalesce(c.cnt, 0)::int as comments,
        0::bigint as online_seconds
      from union_days ud
      left join posts p on p.day = ud.day
      left join comments c on c.day = ud.day
      order by ud.day asc
    `,
    sqlClient`
      with accessible_boards as (
        select b.id, b.group_id
        from public.boards b
        join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
        where coalesce(nullif(b.details->>'archivedAt', ''), '') = ''
          and (${boardId}::uuid is null or b.id = ${boardId}::uuid)
      ),
      scoped_posts as (
        select gp.*
        from public.group_posts gp
        join accessible_boards ab on ab.id = gp.board_id
        where (${groupUserId}::uuid is null or gp.author_id = ${groupUserId}::uuid)
          and (${fromIso}::date is null or gp.created_at >= ${fromIso}::date)
          and (${toIsoExclusive}::date is null or gp.created_at < ${toIsoExclusive}::date)
      ),
      scoped_comments as (
        select gc.*
        from public.group_comments gc
        join accessible_boards ab on ab.id = gc.board_id
        where (${groupUserId}::uuid is null or gc.author_id = ${groupUserId}::uuid)
          and (${fromIso}::date is null or gc.created_at >= ${fromIso}::date)
          and (${toIsoExclusive}::date is null or gc.created_at < ${toIsoExclusive}::date)
      ),
      scoped_boards as (
        select b.*
        from public.boards b
        join accessible_boards ab on ab.id = b.id
      ),
      active_user as (
        select coalesce(nullif(u.username_display, ''), nullif(p.full_name, ''), p.username, 'Użytkownik') as name
        from (
          select gp.author_id as user_id, count(*)::int as points
          from scoped_posts gp
          group by gp.author_id
          order by points desc
          limit 1
        ) best
        join public.profiles p on p.id = best.user_id
        left join public.users u on u.id = p.id
      )
      select
        (select count(*)::int from scoped_posts) as posts,
        (select count(*)::int from scoped_comments) as comments,
        (select count(*)::int from scoped_boards b where coalesce((b.details->>'status') = 'completed', false)) as trips,
        (select name from active_user limit 1) as most_active_user
    `,
    hasUserSessions
      ? sqlClient`
      with accessible_boards as (
        select b.id, b.group_id
        from public.boards b
        join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
        where coalesce(nullif(b.details->>'archivedAt', ''), '') = ''
          and (${boardId}::uuid is null or b.id = ${boardId}::uuid)
      ),
      post_counts as (
        select gp.author_id as user_id, count(*)::int as posts
        from public.group_posts gp
        join accessible_boards ab on ab.id = gp.board_id
        where (${groupUserId}::uuid is null or gp.author_id = ${groupUserId}::uuid)
          and (${fromIso}::date is null or gp.created_at >= ${fromIso}::date)
          and (${toIsoExclusive}::date is null or gp.created_at < ${toIsoExclusive}::date)
        group by gp.author_id
      ),
      comment_counts as (
        select gc.author_id as user_id, count(*)::int as comments
        from public.group_comments gc
        join accessible_boards ab on ab.id = gc.board_id
        where (${groupUserId}::uuid is null or gc.author_id = ${groupUserId}::uuid)
          and (${fromIso}::date is null or gc.created_at >= ${fromIso}::date)
          and (${toIsoExclusive}::date is null or gc.created_at < ${toIsoExclusive}::date)
        group by gc.author_id
      ),
      session_counts as (
        select
          us.user_id,
          coalesce(sum(coalesce(us.duration_seconds, extract(epoch from (coalesce(us.session_end, least(now(), coalesce(us.last_seen_at, us.session_start))) - us.session_start)))), 0)::bigint as online_seconds
        from public.user_sessions us
        where ${hasUserSessions}
          and (${groupUserId}::uuid is null or us.user_id = ${groupUserId}::uuid)
          ${sessionWindowFilter ?? sqlClient``}
        group by us.user_id
      ),
      all_users as (
        select user_id from post_counts
        union
        select user_id from comment_counts
        union
        select user_id from session_counts
      )
      select
        au.user_id,
        coalesce(nullif(u.username_display, ''), nullif(p.full_name, ''), p.username, 'Użytkownik') as name,
        coalesce(nullif(u.avatar_url, ''), nullif(p.avatar_url, '')) as avatar_url,
        coalesce(pc.posts, 0)::int as posts,
        coalesce(cc.comments, 0)::int as comments,
        coalesce(sc.online_seconds, 0)::bigint as online_seconds
      from all_users au
      join public.profiles p on p.id = au.user_id
      left join public.users u on u.id = p.id
      left join post_counts pc on pc.user_id = au.user_id
      left join comment_counts cc on cc.user_id = au.user_id
      left join session_counts sc on sc.user_id = au.user_id
      order by (coalesce(pc.posts, 0) * 3 + coalesce(cc.comments, 0) * 2 + (coalesce(sc.online_seconds, 0) / 10.0)) desc
      limit 5
    `
      : sqlClient`
      with accessible_boards as (
        select b.id, b.group_id
        from public.boards b
        join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
        where coalesce(nullif(b.details->>'archivedAt', ''), '') = ''
          and (${boardId}::uuid is null or b.id = ${boardId}::uuid)
      ),
      post_counts as (
        select gp.author_id as user_id, count(*)::int as posts
        from public.group_posts gp
        join accessible_boards ab on ab.id = gp.board_id
        where (${groupUserId}::uuid is null or gp.author_id = ${groupUserId}::uuid)
          and (${fromIso}::date is null or gp.created_at >= ${fromIso}::date)
          and (${toIsoExclusive}::date is null or gp.created_at < ${toIsoExclusive}::date)
        group by gp.author_id
      ),
      comment_counts as (
        select gc.author_id as user_id, count(*)::int as comments
        from public.group_comments gc
        join accessible_boards ab on ab.id = gc.board_id
        where (${groupUserId}::uuid is null or gc.author_id = ${groupUserId}::uuid)
          and (${fromIso}::date is null or gc.created_at >= ${fromIso}::date)
          and (${toIsoExclusive}::date is null or gc.created_at < ${toIsoExclusive}::date)
        group by gc.author_id
      ),
      all_users as (
        select user_id from post_counts
        union
        select user_id from comment_counts
      )
      select
        au.user_id,
        coalesce(nullif(u.username_display, ''), nullif(p.full_name, ''), p.username, 'Użytkownik') as name,
        coalesce(nullif(u.avatar_url, ''), nullif(p.avatar_url, '')) as avatar_url,
        coalesce(pc.posts, 0)::int as posts,
        coalesce(cc.comments, 0)::int as comments,
        0::bigint as online_seconds
      from all_users au
      join public.profiles p on p.id = au.user_id
      left join public.users u on u.id = p.id
      left join post_counts pc on pc.user_id = au.user_id
      left join comment_counts cc on cc.user_id = au.user_id
      order by (coalesce(pc.posts, 0) * 3 + coalesce(cc.comments, 0) * 2) desc
      limit 5
    `,
    hasUserSessions
      ? sqlClient`
      with accessible_boards as (
        select b.id
        from public.boards b
        join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
        where coalesce(nullif(b.details->>'archivedAt', ''), '') = ''
          and (${boardId}::uuid is null or b.id = ${boardId}::uuid)
      ),
      post_heat as (
        select extract(dow from gp.created_at)::int as dow, extract(hour from gp.created_at)::int as hr, count(*)::int as val
        from public.group_posts gp
        join accessible_boards ab on ab.id = gp.board_id
        where (${groupUserId}::uuid is null or gp.author_id = ${groupUserId}::uuid)
          and (${fromIso}::date is null or gp.created_at >= ${fromIso}::date)
          and (${toIsoExclusive}::date is null or gp.created_at < ${toIsoExclusive}::date)
        group by 1,2
      ),
      comment_heat as (
        select extract(dow from gc.created_at)::int as dow, extract(hour from gc.created_at)::int as hr, count(*)::int as val
        from public.group_comments gc
        join accessible_boards ab on ab.id = gc.board_id
        where (${groupUserId}::uuid is null or gc.author_id = ${groupUserId}::uuid)
          and (${fromIso}::date is null or gc.created_at >= ${fromIso}::date)
          and (${toIsoExclusive}::date is null or gc.created_at < ${toIsoExclusive}::date)
        group by 1,2
      ),
      session_heat as (
        select extract(dow from us.session_start)::int as dow, extract(hour from us.session_start)::int as hr, count(*)::int as val
        from public.user_sessions us
        where ${hasUserSessions}
          and (${groupUserId}::uuid is null or us.user_id = ${groupUserId}::uuid)
          ${sessionWindowFilter ?? sqlClient``}
        group by 1,2
      ),
      all_heat as (
        select dow, hr, val from post_heat
        union all
        select dow, hr, val from comment_heat
        union all
        select dow, hr, val from session_heat
      )
      select dow, hr, sum(val)::int as value
      from all_heat
      group by dow, hr
      order by dow asc, hr asc
    `
      : sqlClient`
      with accessible_boards as (
        select b.id
        from public.boards b
        join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
        where coalesce(nullif(b.details->>'archivedAt', ''), '') = ''
          and (${boardId}::uuid is null or b.id = ${boardId}::uuid)
      ),
      post_heat as (
        select extract(dow from gp.created_at)::int as dow, extract(hour from gp.created_at)::int as hr, count(*)::int as val
        from public.group_posts gp
        join accessible_boards ab on ab.id = gp.board_id
        where (${groupUserId}::uuid is null or gp.author_id = ${groupUserId}::uuid)
          and (${fromIso}::date is null or gp.created_at >= ${fromIso}::date)
          and (${toIsoExclusive}::date is null or gp.created_at < ${toIsoExclusive}::date)
        group by 1,2
      ),
      comment_heat as (
        select extract(dow from gc.created_at)::int as dow, extract(hour from gc.created_at)::int as hr, count(*)::int as val
        from public.group_comments gc
        join accessible_boards ab on ab.id = gc.board_id
        where (${groupUserId}::uuid is null or gc.author_id = ${groupUserId}::uuid)
          and (${fromIso}::date is null or gc.created_at >= ${fromIso}::date)
          and (${toIsoExclusive}::date is null or gc.created_at < ${toIsoExclusive}::date)
        group by 1,2
      ),
      all_heat as (
        select dow, hr, val from post_heat
        union all
        select dow, hr, val from comment_heat
      )
      select dow, hr, sum(val)::int as value
      from all_heat
      group by dow, hr
      order by dow asc, hr asc
    `,
    sqlClient`
      with accessible_boards as (
        select b.id
        from public.boards b
        join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
        where coalesce(nullif(b.details->>'archivedAt', ''), '') = ''
          and (${boardId}::uuid is null or b.id = ${boardId}::uuid)
      )
      select
        count(*)::int as total_trips,
        coalesce(sum(greatest(1, (coalesce(b.end_date, b.start_date) - coalesce(b.start_date, b.end_date) + 1))), 0)::int as total_trip_days,
        (
          select b2.location
          from public.boards b2
          join accessible_boards ab2 on ab2.id = b2.id
          where nullif(trim(b2.location), '') is not null
          group by b2.location
          order by count(*) desc, b2.location asc
          limit 1
        ) as most_visited_place,
        coalesce(avg(greatest(1, (coalesce(b.end_date, b.start_date) - coalesce(b.start_date, b.end_date) + 1)))::numeric, 0)::numeric(12,2) as average_trip_days,
        (
          select coalesce(nullif(u.username_display, ''), nullif(p.full_name, ''), p.username, 'Użytkownik')
          from public.boards bx
          join accessible_boards abx on abx.id = bx.id
          join public.profiles p on p.id = bx.created_by
          left join public.users u on u.id = p.id
          group by bx.created_by, p.username, p.full_name, u.username_display
          order by count(*) desc
          limit 1
        ) as most_active_traveler
      from public.boards b
      join accessible_boards ab on ab.id = b.id
      where coalesce((b.details->>'status') = 'completed', false)
        and (${fromIso}::date is null or coalesce(b.end_date, b.created_at::date) >= ${fromIso}::date)
        and (${toIsoExclusive}::date is null or coalesce(b.end_date, b.created_at::date) < ${toIsoExclusive}::date)
    `,
    sqlClient`
      with accessible_boards as (
        select b.id
        from public.boards b
        join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
        where coalesce(nullif(b.details->>'archivedAt', ''), '') = ''
          and (${boardId}::uuid is null or b.id = ${boardId}::uuid)
      )
      select
        coalesce(nullif(u.username_display, ''), nullif(p.full_name, ''), p.username, 'Użytkownik') as name
      from public.group_post_mentions gpm
      join accessible_boards ab on ab.id = gpm.board_id
      join public.profiles p on p.id = gpm.mentioned_user_id
      left join public.users u on u.id = p.id
      where (${fromIso}::date is null or gpm.created_at >= ${fromIso}::date)
        and (${toIsoExclusive}::date is null or gpm.created_at < ${toIsoExclusive}::date)
      group by p.id, p.username, p.full_name, u.username_display
      order by count(*) desc, name asc
      limit 1
    `,
    sqlClient`
      with accessible_boards as (
        select b.id
        from public.boards b
        join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
        where coalesce(nullif(b.details->>'archivedAt', ''), '') = ''
          and (${boardId}::uuid is null or b.id = ${boardId}::uuid)
      )
      select
        gp.id as post_id,
        left(gp.content, 140) as excerpt,
        count(gc.id)::int as comments_count
      from public.group_posts gp
      join accessible_boards ab on ab.id = gp.board_id
      left join public.group_comments gc on gc.post_id = gp.id
      where (${fromIso}::date is null or gp.created_at >= ${fromIso}::date)
        and (${toIsoExclusive}::date is null or gp.created_at < ${toIsoExclusive}::date)
      group by gp.id, gp.content
      order by comments_count desc, gp.created_at desc
      limit 1
    `,
    sqlClient`
      with accessible_boards as (
        select b.id
        from public.boards b
        join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
        where coalesce(nullif(b.details->>'archivedAt', ''), '') = ''
          and (${boardId}::uuid is null or b.id = ${boardId}::uuid)
      )
      select gp.content
      from public.group_posts gp
      join accessible_boards ab on ab.id = gp.board_id
      where gp.author_id = ${userId}
        and (${fromIso}::date is null or gp.created_at >= ${fromIso}::date)
        and (${toIsoExclusive}::date is null or gp.created_at < ${toIsoExclusive}::date)
      union all
      select gc.content
      from public.group_comments gc
      join accessible_boards ab on ab.id = gc.board_id
      where gc.author_id = ${userId}
        and (${fromIso}::date is null or gc.created_at >= ${fromIso}::date)
        and (${toIsoExclusive}::date is null or gc.created_at < ${toIsoExclusive}::date)
    `,
    sqlClient`
      with accessible_boards as (
        select b.id
        from public.boards b
        join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
        where coalesce(nullif(b.details->>'archivedAt', ''), '') = ''
          and (${boardId}::uuid is null or b.id = ${boardId}::uuid)
      )
      select gp.content
      from public.group_posts gp
      join accessible_boards ab on ab.id = gp.board_id
      where (${groupUserId}::uuid is null or gp.author_id = ${groupUserId}::uuid)
        and (${fromIso}::date is null or gp.created_at >= ${fromIso}::date)
        and (${toIsoExclusive}::date is null or gp.created_at < ${toIsoExclusive}::date)
      union all
      select gc.content
      from public.group_comments gc
      join accessible_boards ab on ab.id = gc.board_id
      where (${groupUserId}::uuid is null or gc.author_id = ${groupUserId}::uuid)
        and (${fromIso}::date is null or gc.created_at >= ${fromIso}::date)
        and (${toIsoExclusive}::date is null or gc.created_at < ${toIsoExclusive}::date)
    `,
    hasUserSessions
      ? sqlClient`
        select
          coalesce(sum(coalesce(us.duration_seconds, extract(epoch from (coalesce(us.session_end, least(now(), coalesce(us.last_seen_at, us.session_start))) - us.session_start)))), 0)::bigint as total_seconds,
          coalesce(avg(coalesce(us.duration_seconds, extract(epoch from (coalesce(us.session_end, least(now(), coalesce(us.last_seen_at, us.session_start))) - us.session_start)))), 0)::numeric(12,2) as avg_seconds,
          count(*)::int as sessions_count
        from public.user_sessions us
        where us.user_id = ${userId}
          ${sessionWindowFilter ?? sqlClient``}
      `
      : Promise.resolve([{ total_seconds: 0, avg_seconds: 0, sessions_count: 0 }]),
    hasUserSessions
      ? sqlClient`
        select
          coalesce(sum(coalesce(us.duration_seconds, extract(epoch from (coalesce(us.session_end, least(now(), coalesce(us.last_seen_at, us.session_start))) - us.session_start)))), 0)::bigint as total_seconds
        from public.user_sessions us
        where (${groupUserId}::uuid is null or us.user_id = ${groupUserId}::uuid)
          ${sessionWindowFilter ?? sqlClient``}
      `
      : Promise.resolve([{ total_seconds: 0 }]),
  ]);

  const soloKpi = Array.isArray(soloKpiRows) && soloKpiRows.length ? soloKpiRows[0] : { posts: 0, comments: 0, completed_trips: 0 };
  const soloKpiPrev = Array.isArray(soloKpiPrevRows) && soloKpiPrevRows.length ? soloKpiPrevRows[0] : { posts: 0, comments: 0, completed_trips: 0 };
  const soloTrips = Array.isArray(soloTripsRows) && soloTripsRows.length ? soloTripsRows[0] : null;
  const soloMentions = Array.isArray(soloMentionsRows) && soloMentionsRows.length ? soloMentionsRows[0] : { mentions_received: 0 };
  const soloCommentsOnPosts = Array.isArray(soloCommentsOnPostsRows) && soloCommentsOnPostsRows.length ? soloCommentsOnPostsRows[0] : { posts_count: 0, comments_count: 0 };
  const groupKpi = Array.isArray(groupKpiRows) && groupKpiRows.length ? groupKpiRows[0] : null;
  const groupTrips = Array.isArray(groupTripsRows) && groupTripsRows.length ? groupTripsRows[0] : null;
  const mostMentioned = Array.isArray(groupMostMentionedRows) && groupMostMentionedRows.length ? groupMostMentionedRows[0] : null;
  const mostEngaging = Array.isArray(groupMostEngagingRows) && groupMostEngagingRows.length ? groupMostEngagingRows[0] : null;
  const soloOnline = Array.isArray(soloOnlineRows) && soloOnlineRows.length ? soloOnlineRows[0] : { total_seconds: 0, avg_seconds: 0, sessions_count: 0 };
  const groupOnline = Array.isArray(groupOnlineRows) && groupOnlineRows.length ? groupOnlineRows[0] : { total_seconds: 0 };

  const trend: TrendPoint[] = (Array.isArray(soloTrendRows) ? soloTrendRows : []).map((row: any) => ({
    date: String(row.day),
    posts: asNumber(row.posts),
    comments: asNumber(row.comments),
    onlineSeconds: asNumber(row.online_seconds),
  }));

  const ranking: RankingEntry[] = (Array.isArray(groupRankingRows) ? groupRankingRows : []).map((row: any) => {
    const posts = asNumber(row.posts);
    const comments = asNumber(row.comments);
    const onlineSeconds = asNumber(row.online_seconds);
    const reactions = 0;
    const score = posts * 3 + comments * 2 + reactions + onlineSeconds / 10;
    return {
      userId: String(row.user_id),
      name: String(row.name ?? 'Użytkownik'),
      avatarUrl: row.avatar_url ?? null,
      posts,
      comments,
      onlineSeconds,
      reactions,
      score: Math.round(score),
    };
  });

  const heatmap: HeatmapCell[] = (Array.isArray(groupHeatmapRows) ? groupHeatmapRows : []).map((row: any) => ({
    dayOfWeek: asNumber(row.dow),
    hour: asNumber(row.hr),
    value: asNumber(row.value),
  }));

  const soloEmojiTop = parseEmojiTop((Array.isArray(soloEmojiRows) ? soloEmojiRows : []) as Array<{ content: string | null }>);
  const groupEmojiTop = parseEmojiTop((Array.isArray(groupEmojiRows) ? groupEmojiRows : []) as Array<{ content: string | null }>);

  const soloPosts = asNumber(soloKpi.posts);
  const soloCommentsCount = asNumber(soloKpi.comments);
  const soloCompletedTrips = asNumber(soloKpi.completed_trips);
  const soloOnlineSeconds = asNumber(soloOnline.total_seconds);

  const soloPreviousPosts = asNumber(soloKpiPrev.posts);
  const soloPreviousComments = asNumber(soloKpiPrev.comments);
  const soloPreviousTrips = asNumber(soloKpiPrev.completed_trips);

  const soloAverageCommentsOnPosts = asNumber(soloCommentsOnPosts.posts_count) > 0
    ? asNumber(soloCommentsOnPosts.comments_count) / asNumber(soloCommentsOnPosts.posts_count)
    : 0;

  const response: StatsResponse = {
    mode,
    filters: {
      range,
      boardId: boardId ?? 'all',
      startDate,
      endDate,
      userId: groupUserId ?? 'all',
    },
    options: {
      boards,
      users,
    },
    solo: {
      kpi: {
        posts: soloPosts,
        comments: soloCommentsCount,
        onlineSeconds: soloOnlineSeconds,
        completedTrips: soloCompletedTrips,
        deltas: {
          posts: toPercentChange(soloPosts, soloPreviousPosts),
          comments: toPercentChange(soloCommentsCount, soloPreviousComments),
          onlineSeconds: 0,
          completedTrips: toPercentChange(soloCompletedTrips, soloPreviousTrips),
        },
      },
      online: {
        totalSeconds: soloOnlineSeconds,
        avgSessionSeconds: asNumber(soloOnline.avg_seconds),
        sessionsCount: asNumber(soloOnline.sessions_count),
        trend,
      },
      trips: {
        completedTrips: asNumber(soloTrips?.completed_trips),
        totalTripDays: asNumber(soloTrips?.total_trip_days),
        mostFrequentDirection: soloTrips?.most_frequent_direction ?? null,
        longestTripDays: asNumber(soloTrips?.longest_trip_days),
        averageBudget: soloTrips?.average_budget == null ? null : asNumber(soloTrips.average_budget),
      },
      engagement: {
        mentionsReceived: asNumber(soloMentions.mentions_received),
        reactionsReceived: 0,
        averageCommentsOnPosts: Number(soloAverageCommentsOnPosts.toFixed(2)),
        topEmojis: soloEmojiTop,
      },
      activityTrend: trend,
    },
    group: {
      kpi: {
        posts: asNumber(groupKpi?.posts),
        comments: asNumber(groupKpi?.comments),
        onlineSeconds: asNumber(groupOnline.total_seconds),
        groupTrips: asNumber(groupKpi?.trips),
        mostActiveUser: groupKpi?.most_active_user ?? null,
      },
      ranking,
      heatmap,
      trips: {
        totalTrips: asNumber(groupTrips?.total_trips),
        totalTripDays: asNumber(groupTrips?.total_trip_days),
        mostVisitedPlace: groupTrips?.most_visited_place ?? null,
        averageTripDays: asNumber(groupTrips?.average_trip_days),
        mostActiveTraveler: groupTrips?.most_active_traveler ?? null,
      },
      interactions: {
        topEmojis: groupEmojiTop,
        mostMentionedUser: mostMentioned?.name ?? null,
        averageCommentsPerPost: asNumber(groupKpi?.posts) > 0 ? Number((asNumber(groupKpi?.comments) / asNumber(groupKpi?.posts)).toFixed(2)) : 0,
        mostEngagingPost: mostEngaging
          ? {
              postId: String(mostEngaging.post_id),
              excerpt: String(mostEngaging.excerpt ?? ''),
              commentsCount: asNumber(mostEngaging.comments_count),
            }
          : null,
      },
    },
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=30',
    },
  });
}
