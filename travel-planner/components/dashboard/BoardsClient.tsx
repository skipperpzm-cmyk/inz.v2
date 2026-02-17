"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Tooltip from '../Tooltip';
import Link from 'next/link';
import { useBoards } from '../../hooks/useBoards';

function formatLastActivity(value?: string | null) {
  if (!value) return 'Brak aktywności';
  try {
    return new Date(value).toLocaleString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

export default function BoardsClient() {
  const { groups, loadingGroups, error, loadGroups } = useBoards();
  const [searchQuery, setSearchQuery] = useState('');
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter((group) => group.groupName.toLowerCase().startsWith(query));
  }, [groups, searchQuery]);

  return (
    <div className="space-y-6 lg:pl-6 lg:pr-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_minmax(0,420px)_1fr] md:items-center">
        <div>
          <h1 className="text-3xl font-semibold text-white">Tablice</h1>
          <p className="text-sm text-slate-300">Wybierz grupę, aby otworzyć listę wszystkich tablic podróży.</p>
        </div>
        <div className="md:justify-self-center w-full max-w-[420px] relative">
          <MagnifyingGlassIcon className="w-5 h-5 text-white/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj grupy"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/25"
          />
        </div>
        <div className="hidden md:block" />
      </div>

      {error && <div className="text-sm text-red-300">{error}</div>}

      {loadingGroups && filteredGroups.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-44 rounded-2xl bg-white/8 animate-pulse border border-white/10" />
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          Brak grup pasujących do wyszukiwania.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredGroups.map((group) => (
            <Link
              key={group.groupId}
              href={`/dashboard/boards/${encodeURIComponent(group.groupId)}`}
              className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition duration-200 hover:scale-[1.02] hover:shadow-glass hover:bg-white/8"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {group.groupAvatarUrl ? (
                    <img src={group.groupAvatarUrl} alt={group.groupName} className="w-11 h-11 rounded-full object-cover border border-white/15" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white font-semibold text-sm">
                      {group.groupName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-white font-medium truncate">{group.groupName}</div>
                    <div className="text-xs text-white/50 mt-0.5">{group.memberCount} członków</div>
                  </div>
                </div>
                <span
                  className="inline-flex min-w-6 h-6 items-center justify-center rounded-full bg-emerald-500 text-white text-xs px-2 cursor-pointer"
                  onMouseEnter={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({
                      text: 'Liczba tablic',
                      x: rect.left + rect.width / 2,
                      y: rect.bottom + 8
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {group.boardCount}
                </span>
                {tooltip && <Tooltip text={tooltip.text} x={tooltip.x} y={tooltip.y} />}
              </div>
              <div className="mt-5 text-xs text-white/60">Ostatnia aktywność</div>
              <div className="text-sm text-white/85 mt-1">{formatLastActivity(group.lastActivity)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
