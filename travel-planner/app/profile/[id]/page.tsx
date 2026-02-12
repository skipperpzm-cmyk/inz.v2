import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchPublicProfileByPublicIdServer } from '../../../lib/profileLookup';
import { getServerSupabase } from '../../../lib/supabaseClient';

type Params = { params: { id: string } };

export default async function Page({ params }: Params) {
  const id = String(params.id ?? '').trim();
  if (!id) return notFound();

  // Fetch profile by public_id (8-digit stable public identifier)
  const { data: profile, error: profileErr } = await fetchPublicProfileByPublicIdServer(id) as any;
  if (profileErr) {
    console.error('Profile lookup error', profileErr);
    return notFound();
  }
  if (!profile) return notFound();

  const profileId = profile.id as string;

  const supabase = getServerSupabase();

  const { data: trips, error: tripsErr } = await supabase
    .from('trips')
    .select('id, title, slug, start_date, end_date, cover_url')
    .eq('user_id', profileId)
    .eq('is_public', true)
    .order('start_date', { ascending: false })
    .limit(20);
  const tripsCount = Array.isArray(trips) ? trips.length : 0;
  if (tripsErr) console.error('Public trips fetch error', tripsErr);

  const { data: memberRows, error: memErr } = await supabase.from('group_members').select('group_id').eq('user_id', profileId);
  const groupIds = (memberRows ?? []).map((r: any) => r.group_id).filter(Boolean);
  let groups: any[] = [];
  if (groupIds.length > 0) {
    const { data: groupsData, error: groupsErr } = await supabase.from('groups').select('id, name, is_private').in('id', groupIds).eq('is_private', false).order('name', { ascending: true }).limit(20);
    if (groupsErr) console.error('Groups fetch error', groupsErr);
    groups = groupsData ?? [];
  }

  const groupsCount = groups.length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <div className="w-24 h-24 rounded-full bg-white/6 overflow-hidden flex items-center justify-center text-3xl font-semibold">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={profile.username_display ?? profile.username} className="w-full h-full object-cover" />
            ) : (
              <span>{((profile.username_display ?? profile.username) ?? '').slice(0, 2).toUpperCase()}</span>
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-semibold">{profile.full_name ?? (profile.username_display ?? profile.username)}</h1>
              <div className="text-sm text-slate-400">@{profile.username_display ?? profile.username}</div>
            </div>
            {profile.bio && <p className="mt-2 text-slate-300">{profile.bio}</p>}
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-white/5 rounded-2xl shadow-glass">
            <div className="text-sm text-slate-400">Trips</div>
            <div className="text-2xl font-bold">{tripsCount}</div>
          </div>
          <div className="p-4 bg-white/5 rounded-2xl shadow-glass">
            <div className="text-sm text-slate-400">Public groups</div>
            <div className="text-2xl font-bold">{groupsCount}</div>
          </div>
          <div className="p-4 bg-white/5 rounded-2xl shadow-glass">
            <div className="text-sm text-slate-400">Member since</div>
            <div className="text-2xl font-bold">{new Date().getFullYear()}</div>
          </div>
        </div>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Public trips</h2>
          <div className="space-y-3 mb-4">
            {trips && trips.length > 0 ? (
              trips.map((t: any) => (
                <Link key={t.id} href={`/trips/${t.id}`} className="block p-4 bg-white/5 rounded-lg hover:shadow-lg transition">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-12 bg-white/6 rounded overflow-hidden flex-shrink-0">
                      {t.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.cover_url} alt={t.title} className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{t.title}</div>
                      {t.start_date && <div className="text-sm text-slate-400">{new Date(t.start_date).toLocaleDateString()}</div>}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-400">No public trips.</p>
            )}
          </div>

          <h2 className="text-lg font-semibold mb-3">Groups</h2>
          <div className="space-y-3">
            {groups.length === 0 ? (
              <p className="text-sm text-slate-400">No public groups to show.</p>
            ) : (
              groups.map((g) => (
                <Link key={g.id} href={`/groups/${g.id}`} className="block p-4 bg-white/5 rounded-lg hover:shadow-lg transition flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold">{g.name}</div>
                    <div className="text-sm text-slate-400">{g.is_private ? 'Private' : 'Public'}</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
