import React from 'react';
import { notFound, redirect } from 'next/navigation';
import DashboardLayoutComp from '../../../../components/layout/DashboardLayout';
import { getCurrentUser } from '../../../../lib/auth';
import { requireDb } from 'src/db/db';
import type { UserRow } from 'src/db/schema';
import GroupMembersList from '../../../../components/groups/GroupMembersList';

type Member = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  public_id?: string | null;
  role: 'member' | 'admin';
};

export default async function GroupPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  if (!slug) return notFound();

  const user = await getCurrentUser();
  // Allow unauthenticated users to view public groups; show prompt when they try to join.

  const db = requireDb();

  // Fetch group by slug
  const groupRes = await (db as any).execute('select id, name, slug, description, is_private, created_by from public.groups where slug = $1 limit 1', [slug]);
  const groupRows = (groupRes as any).rows ?? groupRes;
  const group = Array.isArray(groupRows) && groupRows.length ? groupRows[0] : null;
  if (!group) return notFound();

  const isPrivate = Boolean(group.is_private);

  // If private, ensure current user is a member
  if (isPrivate) {
    if (!user) return notFound();
    const memCheck = await (db as any).execute('select 1 from public.group_members where group_id = $1 and user_id = $2 limit 1', [group.id, user.id]);
    const memRows = (memCheck as any).rows ?? memCheck;
    if (!Array.isArray(memRows) || memRows.length === 0) return notFound();
  }

  // Fetch members JOIN profiles
  const membersRes = await (db as any).execute(
    `select gm.user_id as id, gm.role, p.username, p.full_name, p.avatar_url, p.public_id
     from public.group_members gm
     join public.profiles p on p.id = gm.user_id
     where gm.group_id = $1
     order by gm.joined_at asc`,
    [group.id]
  );
  const membersRows = (membersRes as any).rows ?? membersRes;
  const members: Member[] = (Array.isArray(membersRows) ? membersRows : []).map((r: any) => ({
    id: r.id,
    username: r.username,
    full_name: r.full_name,
    avatar_url: r.avatar_url,
    public_id: r.public_id,
    role: r.role === 'admin' ? 'admin' : 'member',
  }));

  // Determine logged-in user's role
  const meRow = user ? members.find((m) => m.id === user.id) : undefined;
  const myRole = meRow ? meRow.role : null;

  return (
    <DashboardLayoutComp user={user}>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white">{group.name}</h1>
          <p className="text-sm text-slate-300 mt-2">{group.description ?? 'Brak opisu'}</p>
          <div className="text-xs text-slate-400 mt-2">{group.is_private ? 'Prywatna' : 'Publiczna'}</div>
        </div>

        <GroupMembersList members={members} groupSlug={slug} myUserId={user ? user.id : null} myRole={myRole} isPrivate={Boolean(group.is_private)} />
      </div>
    </DashboardLayoutComp>
  );
}
