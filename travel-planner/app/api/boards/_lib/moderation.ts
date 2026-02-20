import { sqlClient } from '@/src/db/db';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BoardAccess = {
  boardId: string;
  groupId: string;
  ownerId: string;
  isArchived: boolean;
  isMember: boolean;
  isOwner: boolean;
  isModerator: boolean;
  canModerate: boolean;
};

export type BoardModeratorUser = {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  publicId: string | null;
  assignedBy: string | null;
  createdAt: string;
};

export type BoardMemberUser = {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  publicId: string | null;
  addedBy: string | null;
  createdAt: string;
};

export async function getBoardAccessForUser(userId: string, boardId: string): Promise<BoardAccess | null> {
  if (!sqlClient || !UUID_RE.test(boardId)) return null;

  const rows = await sqlClient`
    select
      b.id as board_id,
      b.group_id,
      coalesce(nullif(b.details->>'archivedAt', ''), '') <> '' as is_archived,
      g.created_by as owner_id,
      exists (
        select 1
        from public.board_members bm
        where bm.board_id = b.id
          and bm.user_id = ${userId}
      ) as is_member,
      exists (
        select 1
        from public.board_moderators bm
        where bm.board_id = b.id
          and bm.user_id = ${userId}
      ) as is_moderator
    from public.boards b
    join public.groups g on g.id = b.group_id
    where b.id = ${boardId}::uuid
    limit 1
  `;

  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  if (!row) return null;

  const ownerId = String(row.owner_id ?? '');
  const isOwner = ownerId === String(userId);
  const isMember = Boolean(row.is_member);
  const isModerator = Boolean(row.is_moderator);

  return {
    boardId: String(row.board_id),
    groupId: String(row.group_id),
    ownerId,
    isArchived: Boolean(row.is_archived),
    isMember,
    isOwner,
    isModerator,
    canModerate: isOwner || isModerator,
  };
}

export async function isBoardGroupMember(boardId: string, userId: string): Promise<boolean> {
  if (!sqlClient || !UUID_RE.test(boardId)) return false;

  const rows = await sqlClient`
    select 1
    from public.boards b
    join public.group_members gm on gm.group_id = b.group_id
    where b.id = ${boardId}::uuid
      and gm.user_id = ${userId}
    limit 1
  `;

  return Array.isArray(rows) && rows.length > 0;
}

export async function listBoardModerators(boardId: string): Promise<BoardModeratorUser[]> {
  if (!sqlClient || !UUID_RE.test(boardId)) return [];

  const rows = await sqlClient`
    select
      bm.user_id as id,
      p.username,
      p.full_name,
      coalesce(nullif(u.avatar_url, ''), nullif(p.avatar_url, '')) as avatar_url,
      p.public_id,
      bm.assigned_by,
      bm.created_at
    from public.board_moderators bm
    join public.profiles p on p.id = bm.user_id
    left join public.users u on u.id = bm.user_id
    where bm.board_id = ${boardId}::uuid
    order by bm.created_at asc
  `;

  if (!Array.isArray(rows)) return [];
  return rows.map((row: any) => ({
    id: String(row.id),
    username: row.username ?? null,
    fullName: row.full_name ?? null,
    avatarUrl: row.avatar_url ?? null,
    publicId: row.public_id ?? null,
    assignedBy: row.assigned_by ? String(row.assigned_by) : null,
    createdAt: String(row.created_at),
  }));
}

export async function isBoardMember(boardId: string, userId: string): Promise<boolean> {
  if (!sqlClient || !UUID_RE.test(boardId) || !UUID_RE.test(userId)) return false;

  const rows = await sqlClient`
    select 1
    from public.board_members bm
    where bm.board_id = ${boardId}::uuid
      and bm.user_id = ${userId}::uuid
    limit 1
  `;

  return Array.isArray(rows) && rows.length > 0;
}

export async function listBoardMembers(boardId: string): Promise<BoardMemberUser[]> {
  if (!sqlClient || !UUID_RE.test(boardId)) return [];

  const rows = await sqlClient`
    select
      bm.user_id as id,
      p.username,
      p.full_name,
      coalesce(nullif(u.avatar_url, ''), nullif(p.avatar_url, '')) as avatar_url,
      p.public_id,
      bm.added_by,
      bm.created_at
    from public.board_members bm
    join public.profiles p on p.id = bm.user_id
    left join public.users u on u.id = bm.user_id
    where bm.board_id = ${boardId}::uuid
    order by bm.created_at asc
  `;

  if (!Array.isArray(rows)) return [];
  return rows.map((row: any) => ({
    id: String(row.id),
    username: row.username ?? null,
    fullName: row.full_name ?? null,
    avatarUrl: row.avatar_url ?? null,
    publicId: row.public_id ?? null,
    addedBy: row.added_by ? String(row.added_by) : null,
    createdAt: String(row.created_at),
  }));
}
