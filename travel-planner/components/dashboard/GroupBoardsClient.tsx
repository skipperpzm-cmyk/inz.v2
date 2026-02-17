"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import { ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline';
import { useBoards } from '../../hooks/useBoards';
import Button from '../ui/button';
import Modal from '../Modal';
import Tooltip from '../Tooltip';

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function GroupBoardsClient({ groupId }: { groupId: string }) {
  const router = useRouter();
  const {
    activeGroup,
    groupBoards,
    loadingGroupBoards,
    creatingBoard,
    error,
    loadGroupBoards,
    clearGroupBoards,
    createBoard,
    deleteBoard,
    leaveBoard,
  } = useBoards();
  const [deletingBoardId, setDeletingBoardId] = useState<string | null>(null);
  const [confirmDeleteBoardId, setConfirmDeleteBoardId] = useState<string | null>(null);
  const [confirmLeaveBoardId, setConfirmLeaveBoardId] = useState<string | null>(null);
  const [leavingBoardId, setLeavingBoardId] = useState<string | null>(null);
  const [openMenuBoardId, setOpenMenuBoardId] = useState<string | null>(null);
  const [exitingBoardId, setExitingBoardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    clearGroupBoards();
    void loadGroupBoards(groupId, { signal: controller.signal });
    return () => controller.abort();
  }, [clearGroupBoards, groupId, loadGroupBoards]);

  const canCreate = Boolean(activeGroup?.canCreate);

  const handleCreate = async () => {
    const boardId = await createBoard(groupId, {
      title: `Nowa tablica ${new Date().toLocaleDateString('pl-PL')}`,
      description: '',
    });
    if (boardId) {
      router.push(`/dashboard/boards/${encodeURIComponent(groupId)}/${encodeURIComponent(boardId)}`);
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    setOpenMenuBoardId(null);
    setDeletingBoardId(boardId);
    try {
      await deleteBoard(groupId, boardId);
      setConfirmDeleteBoardId(null);
    } finally {
      setDeletingBoardId(null);
      setExitingBoardId(null);
    }
  };

  const beginDeleteBoard = (boardId: string) => {
    setConfirmDeleteBoardId(null);
    setOpenMenuBoardId(null);
    setExitingBoardId(boardId);
    window.setTimeout(() => {
      void handleDeleteBoard(boardId);
    }, 280);
  };

  const handleLeaveBoard = async (boardId: string) => {
    setOpenMenuBoardId(null);
    setLeavingBoardId(boardId);
    try {
      await leaveBoard(groupId, boardId);
      setConfirmLeaveBoardId(null);
    } finally {
      setLeavingBoardId(null);
      setExitingBoardId(null);
    }
  };

  const beginLeaveBoard = (boardId: string) => {
    setConfirmLeaveBoardId(null);
    setOpenMenuBoardId(null);
    setExitingBoardId(boardId);
    window.setTimeout(() => {
      void handleLeaveBoard(boardId);
    }, 220);
  };

  const boardToDelete = groupBoards.find((entry) => String(entry.id ?? '') === String(confirmDeleteBoardId ?? ''));
  const boardToLeave = groupBoards.find((entry) => String(entry.id ?? '') === String(confirmLeaveBoardId ?? ''));
  const filteredBoards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return groupBoards;
    return groupBoards.filter((board) => {
      const title = (board.title || board.boardName || '').toLowerCase();
      const author = (board.createdByName || '').toLowerCase();
      return title.startsWith(query) || author.startsWith(query);
    });
  }, [groupBoards, searchQuery]);

  useEffect(() => {
    if (!openMenuBoardId) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-board-menu="true"]')) return;
      setOpenMenuBoardId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuBoardId]);

  return (
    <div className="space-y-6 lg:pl-6 lg:pr-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_minmax(0,420px)_1fr] md:items-center">
        <div>
          <h1 className="text-3xl font-semibold text-white">Tablice grupy</h1>
          <p className="text-sm text-slate-300 mt-1">
            {activeGroup?.groupName ?? 'Ładowanie grupy...'}
          </p>
        </div>
        <div className="md:justify-self-center w-full max-w-[420px] relative">
          <MagnifyingGlassIcon className="w-5 h-5 text-white/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj tablicy"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/25"
          />
        </div>
        <div className="hidden md:block" />
      </div>

      {canCreate && (
        <div>
          <Button type="button" variant="secondary" disabled={creatingBoard} onClick={handleCreate}>
            {creatingBoard ? 'Tworzenie…' : '+ Nowa tablica'}
          </Button>
        </div>
      )}

      {error && <div className="text-sm text-red-300">{error}</div>}

      {loadingGroupBoards && filteredBoards.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-48 rounded-2xl bg-white/8 animate-pulse border border-white/10" />
          ))}
        </div>
      ) : filteredBoards.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          Brak tablic pasujących do wyszukiwania.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredBoards.map((board) => (
            <Link
              key={String(board.id ?? `${board.groupId}-${board.title ?? 'board'}`)}
              href={`/dashboard/boards/${encodeURIComponent(groupId)}/${encodeURIComponent(String(board.id ?? ''))}`}
              className={`group relative rounded-2xl border border-white/10 bg-white/5 p-4 transition duration-200 hover:scale-[1.02] hover:shadow-glass hover:bg-white/8 ${
                exitingBoardId === String(board.id ?? '') ? 'animate-fadeOutUp pointer-events-none' : ''
              }`}
            >
              {canCreate && board.id && (
                <div className="absolute right-3 top-3 z-20" data-board-menu="true">
                  <button
                    type="button"
                    className="board-actions-trigger app-icon-btn opacity-0 group-hover:opacity-100 focus:opacity-100 hover:opacity-100"
                    aria-label="Więcej akcji"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenMenuBoardId((prev) => (prev === String(board.id) ? null : String(board.id)));
                    }}
                  >
                    <EllipsisVerticalIcon className="h-5 w-5" />
                  </button>
                  <div
                    className={`board-country-menu absolute right-0 mt-[3px] min-w-max whitespace-nowrap rounded-lg border border-slate-600 bg-slate-950 p-1 z-[9999] transform transition-all duration-150 ease-out ${
                      openMenuBoardId === String(board.id)
                        ? 'opacity-100 scale-100 translate-y-0'
                        : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
                    }`}
                  >
                    <div
                      className="board-country-option w-full text-left px-3 py-1 rounded text-xs text-slate-100 transition whitespace-nowrap flex items-center"
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setConfirmDeleteBoardId(String(board.id));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          setConfirmDeleteBoardId(String(board.id));
                        }
                      }}
                    >
                      Usuń tablicę
                    </div>
                  </div>
                </div>
              )}
              {!canCreate && board.id && (
                <div className="absolute right-3 top-3 z-20" data-board-menu="true">
                  <button
                    type="button"
                    className="board-actions-trigger app-icon-btn opacity-0 group-hover:opacity-100 focus:opacity-100 hover:opacity-100"
                    aria-label="Opuść tablicę"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmLeaveBoardId(String(board.id));
                    }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({ text: 'Opuść tablicę', x: rect.left + rect.width / 2, y: rect.bottom + 8 });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    onFocus={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({ text: 'Opuść tablicę', x: rect.left + rect.width / 2, y: rect.bottom + 8 });
                    }}
                    onBlur={() => setTooltip(null)}
                  >
                    <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                  </button>
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white font-medium truncate">{board.title || board.boardName || 'Tablica'}</div>
                  <div className="text-xs text-white/60 mt-1 line-clamp-2">{board.description?.trim() || 'Brak opisu'}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/65">
                <div>
                  <div className="text-white/45">Utworzono</div>
                  <div>{formatDate(board.createdAt ?? null)}</div>
                </div>
                <div>
                  <div className="text-white/45">Autor</div>
                  <div className="truncate">{board.createdByName || 'Użytkownik'}</div>
                </div>
                <div>
                  <div className="text-white/45">Posty</div>
                  <div>{board.postCount ?? 0}</div>
                </div>
                <div>
                  <div className="text-white/45">Aktywność</div>
                  <div>{formatDate(board.lastActivity ?? null)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(confirmDeleteBoardId)}
        onClose={() => {
          if (deletingBoardId) return;
          setConfirmDeleteBoardId(null);
        }}
        title={undefined}
        showCloseButton={true}
      >
        <div className="p-6 max-w-md mx-auto overflow-hidden" style={{ overflow: 'hidden', maxWidth: '400px', maxHeight: '90vh' }}>
          <div className="mb-4 pb-4 border-b border-white/10">
            <div className="text-xl font-semibold text-white text-center">Czy na pewno chcesz usunąć tablicę?</div>
            {boardToDelete && (
              <div className="flex flex-col items-center mt-4">
                <div className="text-base font-medium text-white mt-1 text-center">{boardToDelete.title || boardToDelete.boardName || 'Tablica'}</div>
                <div className="text-xs text-white/50 text-center mt-1 line-clamp-2">{boardToDelete.description?.trim() || 'Brak opisu'}</div>
              </div>
            )}
          </div>
          <div className="flex justify-center gap-2 mt-6">
            <Button
              type="button"
              variant="ghost"
              useTextTheme={false}
              disabled={Boolean(deletingBoardId)}
              onClick={() => setConfirmDeleteBoardId(null)}
            >
              Anuluj
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={!confirmDeleteBoardId || deletingBoardId === confirmDeleteBoardId}
              onClick={() => {
                if (!confirmDeleteBoardId) return;
                beginDeleteBoard(confirmDeleteBoardId);
              }}
            >
              {deletingBoardId === confirmDeleteBoardId || exitingBoardId === confirmDeleteBoardId ? 'Usuwanie…' : 'Usuń'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirmLeaveBoardId)}
        onClose={() => {
          if (leavingBoardId) return;
          setConfirmLeaveBoardId(null);
        }}
        title={undefined}
        showCloseButton={true}
      >
        <div className="p-6 max-w-md mx-auto overflow-hidden" style={{ overflow: 'hidden', maxWidth: '400px', maxHeight: '90vh' }}>
          <div className="mb-4 pb-4 border-b border-white/10">
            <div className="text-xl font-semibold text-white text-center">Czy na pewno chcesz opuścić tablicę?</div>
            {boardToLeave && (
              <div className="flex flex-col items-center mt-4">
                <div className="text-base font-medium text-white mt-1 text-center">{boardToLeave.title || boardToLeave.boardName || 'Tablica'}</div>
                <div className="text-xs text-white/50 text-center mt-1 line-clamp-2">{boardToLeave.description?.trim() || 'Po opuszczeniu stracisz dostęp do tej tablicy.'}</div>
              </div>
            )}
          </div>
          <div className="flex justify-center gap-2 mt-6">
            <Button
              type="button"
              variant="ghost"
              className="app-text-btn-gradient"
              disabled={Boolean(leavingBoardId)}
              onClick={() => setConfirmLeaveBoardId(null)}
            >
              Anuluj
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={!confirmLeaveBoardId || leavingBoardId === confirmLeaveBoardId}
              onClick={() => {
                if (!confirmLeaveBoardId) return;
                beginLeaveBoard(confirmLeaveBoardId);
              }}
            >
              {leavingBoardId === confirmLeaveBoardId || exitingBoardId === confirmLeaveBoardId ? 'Opuszczanie…' : 'Opuść tablicę'}
            </Button>
          </div>
        </div>
      </Modal>

      {tooltip && <Tooltip text={tooltip.text} x={tooltip.x} y={tooltip.y} />}
    </div>
  );
}
