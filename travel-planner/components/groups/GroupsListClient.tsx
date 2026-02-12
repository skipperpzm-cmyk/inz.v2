"use client";

import React from 'react';
import Link from 'next/link';
import useUserGroups from '../../hooks/useUserGroups';

export default function GroupsListClient() {
  const { groups, loading, error } = useUserGroups();

  if (loading) return <div className="p-6 bg-white/5 rounded-2xl">Ładowanie...</div>;
  if (error) return <div className="p-6 bg-white/5 rounded-2xl text-red-400">Wystąpił błąd: {String(error.message)}</div>;

  if (!groups || groups.length === 0) {
    return (
      <div className="p-6 bg-white/5 rounded-2xl">
        <div className="text-slate-300">Nie należysz do żadnych grup.</div>
        <div className="mt-4">
          <Link href="/dashboard/groups/new" className="inline-block px-4 py-2 bg-white/6 text-white rounded-lg">Utwórz grupę</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {groups.map((g) => (
        <Link key={g.id} href={`/dashboard/groups/${encodeURIComponent(g.slug)}`} className="block p-4 bg-white/4 rounded-2xl hover:bg-white/6 transition">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-medium">{g.name}</div>
              <div className="text-sm text-slate-400 mt-1">{g.description ?? 'Brak opisu'}</div>
            </div>
            <div className="text-xs text-slate-300 ml-4">{g.is_private ? 'Prywatna' : 'Publiczna'}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
