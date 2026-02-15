"use client";
import React, { useEffect } from 'react';
import Link from 'next/link';
import { useBoard } from '../../hooks/useBoard';

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
  const { boards, loading, error, loadBoards } = useBoard();

  useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  return (
    <div className="space-y-6 lg:pl-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-white">Tablice</h1>
        <p className="text-sm text-slate-300">Wybierz tablicę grupy, aby przejść do timeline i informacji o podróży.</p>
      </div>

      {error && <div className="text-sm text-red-300">{error}</div>}

      {loading && boards.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-44 rounded-2xl bg-white/8 animate-pulse border border-white/10" />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          Nie należysz jeszcze do żadnej grupy z aktywną tablicą.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {boards.map((board) => (
            <Link
              key={board.groupId}
              href={`/dashboard/boards/${encodeURIComponent(board.groupId)}`}
              className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition duration-200 hover:scale-[1.02] hover:shadow-glass hover:bg-white/8"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {board.groupAvatarUrl ? (
                    <img src={board.groupAvatarUrl} alt={board.groupName} className="w-11 h-11 rounded-full object-cover border border-white/15" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white font-semibold text-sm">
                      {board.boardName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-white font-medium truncate">{board.boardName}</div>
                    <div className="text-xs text-white/60 mt-1">Grupa: {board.groupName}</div>
                    <div className="text-xs text-white/50 mt-0.5">{board.memberCount} członków</div>
                  </div>
                </div>
                {board.newPostsCount > 0 && (
                  <span className="inline-flex min-w-6 h-6 items-center justify-center rounded-full bg-emerald-500 text-white text-xs px-2">
                    {board.newPostsCount}
                  </span>
                )}
              </div>
              <div className="mt-5 text-xs text-white/60">Ostatnia aktywność</div>
              <div className="text-sm text-white/85 mt-1">{formatLastActivity(board.lastActivity)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
