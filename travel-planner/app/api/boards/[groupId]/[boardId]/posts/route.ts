import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { sqlClient } from '@/src/db/db';

type Params = { params: Promise<{ groupId: string; boardId: string }> };

const MAX_POST_CONTENT = 5000;
const MAX_MENTIONS = 20;
const MAX_MENTION_LENGTH = 80;
const MAX_ATTACHMENTS = 8;
const MAX_ATTACHMENT_NAME = 180;
const MAX_ATTACHMENT_MIME = 120;
const MAX_DATA_URL_LENGTH = 4_000_000;
const DEFAULT_POST_LIMIT = 20;
const MAX_POST_LIMIT = 50;
const DEFAULT_COMMENT_LIMIT = 10;
const MAX_COMMENT_LIMIT = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toNormalized(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function sanitizeString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

type NormalizedAttachment = {
  id: string;
  name: string;
  kind: 'image' | 'file';
  mimeType: string | null;
  dataUrl: string | null;
};

function normalizeAttachments(value: unknown): NormalizedAttachment[] {
  if (!Array.isArray(value)) return [];

  const list: NormalizedAttachment[] = [];
  for (const entry of value.slice(0, MAX_ATTACHMENTS)) {
    const raw = entry as Record<string, unknown>;
    const kind = raw?.kind === 'image' ? 'image' : 'file';
    const id = sanitizeString(raw?.id, 64) || `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const name = sanitizeString(raw?.name, MAX_ATTACHMENT_NAME) || (kind === 'image' ? 'Obraz' : 'Załącznik');
    const mimeType = sanitizeString(raw?.mimeType, MAX_ATTACHMENT_MIME) || null;
    const dataUrlRaw = typeof raw?.dataUrl === 'string' ? raw.dataUrl : '';
    const dataUrl = dataUrlRaw && dataUrlRaw.length <= MAX_DATA_URL_LENGTH && dataUrlRaw.startsWith('data:')
      ? dataUrlRaw
      : null;

    list.push({ id, name, kind, mimeType, dataUrl });
  }

  return list;
}


function parseMentionNames(content: string, value: unknown): string[] {
  const fromPayload = Array.isArray(value)
    ? value
        .map((entry) => sanitizeString(entry, MAX_MENTION_LENGTH))
        .filter(Boolean)
    : [];

  const fromContent = Array.from(content.matchAll(/@([\p{L}\p{N}_.-]{1,40})/gu))
    .map((match) => (match[1] ?? '').trim())
    .filter(Boolean);

  return Array.from(new Set([...fromPayload, ...fromContent])).slice(0, MAX_MENTIONS);
}


function toSafeInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function encodeCursor(createdAt: string, id: string) {
  return Buffer.from(`${createdAt}|${id}`).toString('base64url');
}

function decodeCursor(cursor: string | null): { createdAt: string; id: string } | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const [createdAt, id] = decoded.split('|');
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

async function resolveBoardAccess(userId: string, groupIdOrSlug: string, boardId: string) {
  if (!sqlClient) return null;
  if (!UUID_RE.test(boardId)) return null;

  const rows = UUID_RE.test(groupIdOrSlug)
    ? await sqlClient`
        select b.id as board_id, b.group_id, g.created_by, gm.role,
               coalesce(nullif(b.details->>'archivedAt', ''), '') <> '' as is_archived
        from public.boards b
        join public.groups g on g.id = b.group_id
        join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
        left join public.group_members gm on gm.group_id = b.group_id and gm.user_id = ${userId}
        where b.id = ${boardId}::uuid and g.id = ${groupIdOrSlug}::uuid
        limit 1
      `
    : await sqlClient`
      select b.id as board_id, b.group_id, g.created_by, gm.role,
           coalesce(nullif(b.details->>'archivedAt', ''), '') <> '' as is_archived
        from public.boards b
        join public.groups g on g.id = b.group_id
        join public.board_members bm on bm.board_id = b.id and bm.user_id = ${userId}
        left join public.group_members gm on gm.group_id = b.group_id and gm.user_id = ${userId}
        where b.id = ${boardId}::uuid and g.slug = ${groupIdOrSlug}
        limit 1
      `;

  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function GET(request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
  const client = sqlClient;

  const { groupId, boardId } = await context.params;
  if (!groupId || !boardId) return NextResponse.json({ error: 'Missing route params' }, { status: 400 });

  const requestUrl = new URL(request.url);
  const limit = toSafeInt(requestUrl.searchParams.get('limit'), DEFAULT_POST_LIMIT, 1, MAX_POST_LIMIT);
  const commentLimit = toSafeInt(requestUrl.searchParams.get('commentLimit'), DEFAULT_COMMENT_LIMIT, 1, MAX_COMMENT_LIMIT);
  const cursor = decodeCursor(requestUrl.searchParams.get('cursor'));

  try {
    const access = await resolveBoardAccess(userId, groupId, boardId);
    if (!access) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

    const postRows = await client`
      select
        gp.id,
        gp.board_id,
        gp.group_id,
        gp.author_id,
        gp.content,
        gp.attachments,
        gp.created_at,
        coalesce(nullif(u.username_display, ''), nullif(p.full_name, ''), p.username, 'Użytkownik') as author_name,
        coalesce(nullif(u.avatar_url, ''), nullif(p.avatar_url, '')) as author_avatar_url
      from public.group_posts gp
      join public.profiles p on p.id = gp.author_id
      left join public.users u on u.id = gp.author_id
      where gp.board_id = ${access.board_id}
        and (
          ${cursor?.createdAt ?? null}::timestamptz is null
          or gp.created_at < ${cursor?.createdAt ?? null}::timestamptz
          or (gp.created_at = ${cursor?.createdAt ?? null}::timestamptz and gp.id::text < ${cursor?.id ?? null}::text)
        )
      order by gp.created_at desc, gp.id desc
      limit ${limit + 1}
    `;

    const allPosts = Array.isArray(postRows) ? postRows : [];
    const hasMore = allPosts.length > limit;
    const pageRows = hasMore ? allPosts.slice(0, limit) : allPosts;
    const next = hasMore ? allPosts[limit - 1] : null;
    const nextCursor = next ? encodeCursor(String(next.created_at), String(next.id)) : null;

    const posts = await Promise.all(
      pageRows.map(async (row: any) => {
        const limitedCommentsRows = await client`
          select
            gc.id,
            gc.post_id,
            gc.board_id,
            gc.group_id,
            gc.author_id,
            gc.content,
            gc.created_at,
            coalesce(nullif(u.username_display, ''), nullif(p.full_name, ''), p.username, 'Użytkownik') as author_name,
            coalesce(nullif(u.avatar_url, ''), nullif(p.avatar_url, '')) as author_avatar_url,
            count(*) over()::int as total_count
          from public.group_comments gc
          join public.profiles p on p.id = gc.author_id
          left join public.users u on u.id = gc.author_id
          where gc.post_id = ${row.id}
          order by gc.created_at desc, gc.id desc
          limit ${commentLimit}
        `;

        const limited = Array.isArray(limitedCommentsRows) ? limitedCommentsRows : [];
        const totalCount = limited.length > 0 ? Number(limited[0].total_count ?? 0) : 0;
        const comments = limited
          .map((commentRow: any) => ({
            id: String(commentRow.id),
            postId: String(commentRow.post_id),
            boardId: String(commentRow.board_id),
            groupId: String(commentRow.group_id),
            authorId: String(commentRow.author_id),
            authorName: String(commentRow.author_name ?? 'Użytkownik'),
            authorAvatarUrl: commentRow.author_avatar_url ?? null,
            content: String(commentRow.content ?? ''),
            createdAt: String(commentRow.created_at),
            cursor: encodeCursor(String(commentRow.created_at), String(commentRow.id)),
          }))
          .reverse();

        const commentsNextCursor = comments.length > 0
          ? encodeCursor(String(limited[limited.length - 1].created_at), String(limited[limited.length - 1].id))
          : null;

        return {
          id: String(row.id),
          boardId: String(row.board_id),
          groupId: String(row.group_id),
          authorId: String(row.author_id),
          authorName: String(row.author_name ?? 'Użytkownik'),
          authorAvatarUrl: row.author_avatar_url ?? null,
          content: String(row.content ?? ''),
          attachments: normalizeAttachments(row.attachments),
          mentions: await (async () => {
            const mentionRows = await client`
              select
                pm.mentioned_user_id,
                p.username,
                coalesce(nullif(u.username_display, ''), nullif(p.full_name, ''), p.username, 'Użytkownik') as display_name
              from public.group_post_mentions pm
              join public.profiles p on p.id = pm.mentioned_user_id
              left join public.users u on u.id = pm.mentioned_user_id
              where pm.post_id = ${row.id}
              order by pm.created_at asc
            `;

            const list = Array.isArray(mentionRows) ? mentionRows : [];
            return list.map((mention: any) => ({
              userId: String(mention.mentioned_user_id),
              name: String(mention.display_name ?? 'Użytkownik'),
              username: mention.username ?? null,
            }));
          })(),
          createdAt: String(row.created_at),
          comments,
          commentsCount: totalCount,
          hasMoreComments: totalCount > comments.length,
          commentsNextCursor,
        };
      })
    );

    return NextResponse.json({ posts, hasMore, nextCursor }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('board posts get error', err);
    return NextResponse.json({ error: 'Failed to fetch board posts' }, { status: 500 });
  }
}

export async function POST(request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
  const client = sqlClient;

  const { groupId, boardId } = await context.params;
  if (!groupId || !boardId) return NextResponse.json({ error: 'Missing route params' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const content = typeof (body as { content?: unknown })?.content === 'string'
    ? (body as { content: string }).content.trim()
    : '';
  const mentionNames = parseMentionNames(content, (body as { mentions?: unknown })?.mentions);
  const attachments = normalizeAttachments((body as { attachments?: unknown })?.attachments);

  if (!content && attachments.length === 0) {
    return NextResponse.json({ error: 'Post musi zawierać treść lub załącznik' }, { status: 400 });
  }
  if (content.length > MAX_POST_CONTENT) {
    return NextResponse.json({ error: `Treść posta nie może przekraczać ${MAX_POST_CONTENT} znaków` }, { status: 422 });
  }

  try {
    const access = await resolveBoardAccess(userId, groupId, boardId);
    if (!access) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    if (Boolean(access.is_archived)) {
      return NextResponse.json({ error: 'Archived board is read-only' }, { status: 409 });
    }

    const inserted = await client`
      insert into public.group_posts (board_id, group_id, author_id, content, attachments)
      values (${access.board_id}, ${access.group_id}, ${userId}, ${content}, ${JSON.stringify(attachments)}::jsonb)
      returning id, board_id, group_id, author_id, content, attachments, created_at
    `;

    const postRow = Array.isArray(inserted) && inserted.length ? inserted[0] : null;
    if (!postRow) return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });

    const profileRows = await client`
      select
        coalesce(nullif(u.username_display, ''), nullif(p.full_name, ''), p.username, 'Użytkownik') as author_name,
        coalesce(nullif(u.avatar_url, ''), nullif(p.avatar_url, '')) as author_avatar_url
      from public.profiles p
      left join public.users u on u.id = p.id
      where p.id = ${userId}
      limit 1
    `;

    const profile = Array.isArray(profileRows) && profileRows.length ? profileRows[0] : null;

    const memberRows = await client`
      select
        bm.user_id,
        p.username,
        p.full_name,
        u.username_display
      from public.board_members bm
      join public.profiles p on p.id = bm.user_id
      left join public.users u on u.id = bm.user_id
      where bm.board_id = ${access.board_id}
    `;

    const memberList = Array.isArray(memberRows) ? memberRows : [];
    const mentionLookup = new Map<string, string>();
    memberList.forEach((member: any) => {
      const userIdValue = String(member.user_id);
      const names = [member.username_display, member.full_name, member.username]
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(Boolean);
      names.forEach((name) => {
        mentionLookup.set(toNormalized(name), userIdValue);
      });
    });

    const mentionedUserIds = Array.from(new Set(
      mentionNames
        .map((name) => mentionLookup.get(toNormalized(name)) ?? null)
        .filter((id): id is string => Boolean(id) && id !== userId)
    ));

    for (const mentionedUserId of mentionedUserIds) {
      await client`
        insert into public.group_post_mentions (post_id, board_id, group_id, mentioned_user_id, created_by)
        values (${postRow.id}, ${access.board_id}, ${access.group_id}, ${mentionedUserId}, ${userId})
        on conflict (post_id, mentioned_user_id) do nothing
      `;

      const notificationPayload = JSON.stringify({
        boardId: String(access.board_id),
        groupId: String(access.group_id),
        postId: String(postRow.id),
      });

      await client`
        insert into public.notifications (
          user_id,
          actor_user_id,
          type,
          title,
          message,
          entity_type,
          entity_id,
          payload,
          created_at
        )
        values (
          ${mentionedUserId},
          ${userId},
          'board_post_mention',
          'Wzmianka w poście',
          ${`${String(profile?.author_name ?? 'Użytkownik')} wspomniał(a) Cię w poście.`},
          'group_post',
          ${postRow.id},
          ${notificationPayload}::jsonb,
          now()
        )
      `;
    }

    const mentionRows = await client`
      select
        pm.mentioned_user_id,
        p.username,
        coalesce(nullif(u.username_display, ''), nullif(p.full_name, ''), p.username, 'Użytkownik') as display_name
      from public.group_post_mentions pm
      join public.profiles p on p.id = pm.mentioned_user_id
      left join public.users u on u.id = pm.mentioned_user_id
      where pm.post_id = ${postRow.id}
      order by pm.created_at asc
    `;

    const mentions = (Array.isArray(mentionRows) ? mentionRows : []).map((mention: any) => ({
      userId: String(mention.mentioned_user_id),
      name: String(mention.display_name ?? 'Użytkownik'),
      username: mention.username ?? null,
    }));

    return NextResponse.json({
      post: {
        id: String(postRow.id),
        boardId: String(postRow.board_id),
        groupId: String(postRow.group_id),
        authorId: String(postRow.author_id),
        authorName: String(profile?.author_name ?? 'Użytkownik'),
        authorAvatarUrl: profile?.author_avatar_url ?? null,
        content: String(postRow.content ?? ''),
        attachments: normalizeAttachments(postRow.attachments),
        mentions,
        createdAt: postRow.created_at,
        comments: [],
      },
    });
  } catch (err) {
    console.error('board posts create error', err);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}
