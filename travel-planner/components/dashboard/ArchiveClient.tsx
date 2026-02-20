"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowPathIcon, ArrowUturnLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

type ArchivedBoardItem = {
  boardId: string;
  groupId: string;
  boardName: string;
  groupName: string;
  groupAvatarUrl?: string | null;
  memberCount: number;
  archivedAt?: string | null;
  lastActivity?: string | null;
};

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

export default function ArchiveClient() {
  const [items, setItems] = useState<ArchivedBoardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [restoringBoardId, setRestoringBoardId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/boards/archive', {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Nie udało się pobrać archiwum tablic');
        const payload = await response.json();
        if (!cancelled) {
          setItems(Array.isArray(payload) ? payload : []);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Nie udało się pobrać archiwum tablic');
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => {
      const groupName = item.groupName.toLowerCase();
      const boardName = item.boardName.toLowerCase();
      return groupName.startsWith(query) || boardName.startsWith(query);
    });
  }, [items, searchQuery]);

  const handleRestoreBoard = async (item: ArchivedBoardItem) => {
    if (restoringBoardId) return;
    setRestoringBoardId(item.boardId);
    setError(null);

    try {
      const response = await fetch(`/api/boards/${encodeURIComponent(item.groupId)}/${encodeURIComponent(item.boardId)}/archive`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) {
        throw new Error(payload?.error || 'Nie udało się przywrócić tablicy.');
      }

      setItems((prev) => prev.filter((entry) => entry.boardId !== item.boardId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się przywrócić tablicy.');
    } finally {
      setRestoringBoardId(null);
    }
  };

  return (
    <div className="space-y-6 lg:pl-6 lg:pr-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_minmax(0,420px)_1fr] md:items-center">
        <div>
          <h1 className="text-3xl font-semibold text-white">Archiwum</h1>
          <p className="text-sm text-slate-300">Przeglądaj zarchiwizowane tablice podróży.</p>
        </div>
        <div className="md:justify-self-center w-full max-w-[420px] relative">
          <MagnifyingGlassIcon className="w-5 h-5 text-white/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj w archiwum"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/25"
          />
        </div>
        <div className="hidden md:block" />
      </div>

      {error && <div className="text-sm text-red-300">{error}</div>}

      {loading && filteredItems.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-44 rounded-2xl bg-white/8 animate-pulse border border-white/10" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          Brak zarchiwizowanych tablic pasujących do wyszukiwania.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div key={item.boardId} className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition duration-200 hover:scale-[1.02] hover:shadow-glass hover:bg-white/8">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {item.groupAvatarUrl ? (
                    <img src={item.groupAvatarUrl} alt={item.groupName} className="w-11 h-11 rounded-full object-cover border border-white/15" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white font-semibold text-sm">
                      {item.groupName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-white font-medium truncate">{item.boardName}</div>
                    <div className="text-xs text-white/50 mt-0.5 truncate">{item.groupName} · {item.memberCount} członków</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleRestoreBoard(item);
                  }}
                  disabled={restoringBoardId === item.boardId}
                  className="app-icon-btn app-icon-btn-sm"
                  title={restoringBoardId === item.boardId ? 'Przywracanie…' : 'Przywróć tablicę'}
                  aria-label={restoringBoardId === item.boardId ? 'Przywracanie tablicy' : 'Przywróć tablicę'}
                >
                  {restoringBoardId === item.boardId ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <ArrowUturnLeftIcon className="h-4 w-4" />}
                </button>
              </div>
              <Link
                href={`/dashboard/boards/${encodeURIComponent(item.groupId)}/${encodeURIComponent(item.boardId)}`}
                className="mt-5 block"
              >
                <div className="text-xs text-white/60">Data archiwizacji</div>
                <div className="text-sm text-white/85 mt-1">{formatLastActivity(item.archivedAt ?? item.lastActivity)}</div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
