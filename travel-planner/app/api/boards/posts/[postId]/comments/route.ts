import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { sqlClient } from '@/src/db/db';

type Params = { params: Promise<{ postId: string }> };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_COMMENT_CONTENT = 2000;
const DEFAULT_COMMENT_LIMIT = 10;
const MAX_COMMENT_LIMIT = 30;

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

export async function GET(request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { postId } = await context.params;
  if (!postId) return NextResponse.json({ error: 'Missing post id' }, { status: 400 });
  if (!UUID_RE.test(postId)) return NextResponse.json({ error: 'Invalid post id' }, { status: 400 });

  const requestUrl = new URL(request.url);
  const limit = toSafeInt(requestUrl.searchParams.get('limit'), DEFAULT_COMMENT_LIMIT, 1, MAX_COMMENT_LIMIT);
  const cursor = decodeCursor(requestUrl.searchParams.get('cursor'));

  try {
    const postRows = await sqlClient`
      select gp.id, gp.board_id
      from public.group_posts gp
      join public.board_members bm on bm.board_id = gp.board_id and bm.user_id = ${userId}
      where gp.id = ${postId}
      limit 1
    `;

    const post = Array.isArray(postRows) && postRows.length ? postRows[0] : null;
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    const rows = await sqlClient`
      select
        gc.id,
        gc.post_id,
            gc.board_id,
        gc.group_id,
        gc.author_id,
        gc.content,
        gc.created_at,
        coalesce(nullif(u.username_display, ''), nullif(p.full_name, ''), p.username, 'Użytkownik') as author_name,
        coalesce(nullif(u.avatar_url, ''), nullif(p.avatar_url, '')) as author_avatar_url
      from public.group_comments gc
      join public.profiles p on p.id = gc.author_id
      left join public.users u on u.id = gc.author_id
      where gc.post_id = ${postId}
        and (
          ${cursor?.createdAt ?? null}::timestamptz is null
          or gc.created_at < ${cursor?.createdAt ?? null}::timestamptz
          or (gc.created_at = ${cursor?.createdAt ?? null}::timestamptz and gc.id::text < ${cursor?.id ?? null}::text)
        )
      order by gc.created_at desc, gc.id desc
      limit ${limit + 1}
    `;

    const list = Array.isArray(rows) ? rows : [];
    const hasMore = list.length > limit;
    const pageRows = hasMore ? list.slice(0, limit) : list;
    const next = hasMore ? list[limit - 1] : null;

    const comments = pageRows
      .map((row: any) => ({
        id: String(row.id),
        postId: String(row.post_id),
        boardId: String(row.board_id),
        groupId: String(row.group_id),
        authorId: String(row.author_id),
        authorName: String(row.author_name ?? 'Użytkownik'),
        authorAvatarUrl: row.author_avatar_url ?? null,
        content: String(row.content ?? ''),
        createdAt: String(row.created_at),
        cursor: encodeCursor(String(row.created_at), String(row.id)),
      }))
      .reverse();

    const nextCursor = next ? encodeCursor(String(next.created_at), String(next.id)) : null;

    return NextResponse.json({ comments, hasMore, nextCursor }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('board comment list error', err);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export async function POST(request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!sqlClient) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

  const { postId } = await context.params;
  if (!postId) return NextResponse.json({ error: 'Missing post id' }, { status: 400 });
  if (!UUID_RE.test(postId)) return NextResponse.json({ error: 'Invalid post id' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const content = typeof (body as { content?: unknown })?.content === 'string'
    ? (body as { content: string }).content.trim()
    : '';
  if (!content) return NextResponse.json({ error: 'Treść komentarza jest wymagana' }, { status: 400 });
  if (content.length > MAX_COMMENT_CONTENT) {
    return NextResponse.json({ error: `Treść komentarza nie może przekraczać ${MAX_COMMENT_CONTENT} znaków` }, { status: 422 });
  }

  try {
    const postRows = await sqlClient`
      select gp.id, gp.group_id, gp.board_id,
             coalesce(nullif(b.details->>'archivedAt', ''), '') <> '' as is_archived
      from public.group_posts gp
      join public.boards b on b.id = gp.board_id
      join public.board_members bm on bm.board_id = gp.board_id and bm.user_id = ${userId}
      where gp.id = ${postId}
      limit 1
    `;

    const post = Array.isArray(postRows) && postRows.length ? postRows[0] : null;
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    if (Boolean(post.is_archived)) {
      return NextResponse.json({ error: 'Archived board is read-only' }, { status: 409 });
    }

    const inserted = await sqlClient`
      insert into public.group_comments (post_id, board_id, group_id, author_id, content)
      values (${post.id}, ${post.board_id}, ${post.group_id}, ${userId}, ${content})
      returning id, post_id, board_id, group_id, author_id, content, created_at
    `;

    const row = Array.isArray(inserted) && inserted.length ? inserted[0] : null;
    if (!row) return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });

    const profileRows = await sqlClient`
      select
        coalesce(nullif(u.username_display, ''), nullif(p.full_name, ''), p.username, 'Użytkownik') as author_name,
        coalesce(nullif(u.avatar_url, ''), nullif(p.avatar_url, '')) as author_avatar_url
      from public.profiles p
      left join public.users u on u.id = p.id
      where p.id = ${userId}
      limit 1
    `;
    const profile = Array.isArray(profileRows) && profileRows.length ? profileRows[0] : null;

    return NextResponse.json({
      comment: {
        id: String(row.id),
        postId: String(row.post_id),
        boardId: String(row.board_id),
        groupId: String(row.group_id),
        authorId: String(row.author_id),
        authorName: String(profile?.author_name ?? 'Użytkownik'),
        authorAvatarUrl: profile?.author_avatar_url ?? null,
        content: String(row.content ?? ''),
        createdAt: row.created_at,
      },
    });
  } catch (err) {
    console.error('board comment create error', err);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}
