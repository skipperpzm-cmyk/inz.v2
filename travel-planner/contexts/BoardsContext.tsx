"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { BoardGroupListItem, BoardListItem } from '../types/board';
import { getBrowserSupabase } from '../lib/supabaseClient';

type GroupBoardsResponse = {
  groupId: string;
  groupName: string;
  groupAvatarUrl?: string | null;
  ownerId: string;
  role: 'admin' | 'member';
  canCreate?: boolean;
  boards: BoardListItem[];
};

type BoardsContextValue = {
  groups: BoardGroupListItem[];
  groupBoards: BoardListItem[];
  activeGroup: Omit<GroupBoardsResponse, 'boards'> | null;
  loadingGroups: boolean;
  loadingGroupBoards: boolean;
  creatingBoard: boolean;
  error: string | null;
  loadGroups: (opts?: { signal?: AbortSignal }) => Promise<void>;
  loadGroupBoards: (groupId: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  createBoard: (groupId: string, payload?: { title?: string; description?: string }, opts?: { signal?: AbortSignal }) => Promise<string | null>;
  deleteBoard: (groupId: string, boardId: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  leaveBoard: (groupId: string, boardId: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  clearGroupBoards: () => void;
};

const BoardsContext = createContext<BoardsContextValue | null>(null);

export function BoardsProvider({ children }: { children: React.ReactNode }) {
  const [groups, setGroups] = useState<BoardGroupListItem[]>([]);
  const [groupBoards, setGroupBoards] = useState<BoardListItem[]>([]);
  const [activeGroup, setActiveGroup] = useState<Omit<GroupBoardsResponse, 'boards'> | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingGroupBoards, setLoadingGroupBoards] = useState(false);
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groupsAbortRef = useRef<AbortController | null>(null);
  const groupBoardsAbortRef = useRef<AbortController | null>(null);

  const clearGroupBoards = useCallback(() => {
    setGroupBoards([]);
    setActiveGroup(null);
  }, []);

  const loadGroups = useCallback(async (opts?: { signal?: AbortSignal }) => {
    groupsAbortRef.current?.abort();
    const controller = opts?.signal ? null : new AbortController();
    if (controller) groupsAbortRef.current = controller;

    setLoadingGroups(true);
    setError(null);
    try {
      const res = await fetch('/api/boards', {
        credentials: 'include',
        cache: 'no-store',
        signal: opts?.signal ?? controller?.signal,
      });
      const json = await res.json().catch(() => []);
      if (!res.ok) throw new Error(json?.error || 'Nie udało się pobrać grup tablic.');
      setGroups(Array.isArray(json) ? json as BoardGroupListItem[] : []);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać grup tablic.');
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const loadGroupBoards = useCallback(async (groupId: string, opts?: { signal?: AbortSignal }) => {
    groupBoardsAbortRef.current?.abort();
    const controller = opts?.signal ? null : new AbortController();
    if (controller) groupBoardsAbortRef.current = controller;

    setLoadingGroupBoards(true);
    setError(null);
    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}`, {
        credentials: 'include',
        cache: 'no-store',
        signal: opts?.signal ?? controller?.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Nie udało się pobrać tablic grupy.');

      const payload = json as GroupBoardsResponse;
      setActiveGroup({
        groupId: payload.groupId,
        groupName: payload.groupName,
        groupAvatarUrl: payload.groupAvatarUrl ?? null,
        ownerId: payload.ownerId,
        role: payload.role,
        canCreate: Boolean(payload.canCreate),
      });
      setGroupBoards(Array.isArray(payload.boards) ? payload.boards : []);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać tablic grupy.');
      setGroupBoards([]);
      setActiveGroup(null);
    } finally {
      setLoadingGroupBoards(false);
    }
  }, []);

  const createBoard = useCallback(async (groupId: string, payload?: { title?: string; description?: string }, opts?: { signal?: AbortSignal }) => {
    setCreatingBoard(true);
    setError(null);
    try {
      const optimisticId = `temp-board-${Date.now()}`;
      const now = new Date().toISOString();
      setGroupBoards((prev) => [{
        id: optimisticId,
        groupId,
        title: payload?.title?.trim() || 'Nowa tablica',
        description: payload?.description?.trim() || null,
        createdAt: now,
        updatedAt: now,
        createdBy: 'me',
        createdByName: 'Ty',
        createdByAvatarUrl: null,
        postCount: 0,
        lastActivity: now,
      }, ...prev]);

      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: opts?.signal,
        body: JSON.stringify(payload ?? {}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Nie udało się utworzyć tablicy.');

      const created = json?.board as BoardListItem | undefined;
      if (!created?.id) {
        setGroupBoards((prev) => prev.filter((entry) => entry.id !== optimisticId));
        await loadGroupBoards(groupId, opts);
        return null;
      }

      setGroupBoards((prev) => prev.map((entry) => (entry.id === optimisticId ? created : entry)));
      return created.id;
    } catch (err) {
      setGroupBoards((prev) => prev.filter((entry) => !String(entry.id ?? '').startsWith('temp-board-')));
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'Nie udało się utworzyć tablicy.');
      }
      return null;
    } finally {
      setCreatingBoard(false);
    }
  }, [loadGroupBoards]);

  const deleteBoard = useCallback(async (groupId: string, boardId: string, opts?: { signal?: AbortSignal }) => {
    const snapshot = groupBoards;
    setGroupBoards((prev) => prev.filter((entry) => entry.id !== boardId));
    setError(null);

    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}/${encodeURIComponent(boardId)}`, {
        method: 'DELETE',
        credentials: 'include',
        signal: opts?.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Nie udało się usunąć tablicy.');
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'Nie udało się usunąć tablicy.');
      }
      setGroupBoards(snapshot);
      throw err instanceof Error ? err : new Error('Nie udało się usunąć tablicy.');
    }
  }, [groupBoards]);

  const leaveBoard = useCallback(async (groupId: string, boardId: string, opts?: { signal?: AbortSignal }) => {
    const snapshot = groupBoards;
    setGroupBoards((prev) => prev.filter((entry) => entry.id !== boardId));
    setError(null);

    try {
      const res = await fetch(`/api/boards/by-id/${encodeURIComponent(boardId)}/leave`, {
        method: 'POST',
        credentials: 'include',
        signal: opts?.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Nie udało się opuścić tablicy.');
      await loadGroups();
      if (activeGroup?.groupId === groupId) {
        await loadGroupBoards(groupId);
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'Nie udało się opuścić tablicy.');
      }
      setGroupBoards(snapshot);
      throw err instanceof Error ? err : new Error('Nie udało się opuścić tablicy.');
    }
  }, [activeGroup?.groupId, groupBoards, loadGroupBoards, loadGroups]);

  const value = useMemo<BoardsContextValue>(
    () => ({
      groups,
      groupBoards,
      activeGroup,
      loadingGroups,
      loadingGroupBoards,
      creatingBoard,
      error,
      loadGroups,
      loadGroupBoards,
      createBoard,
      deleteBoard,
      leaveBoard,
      clearGroupBoards,
    }),
    [
      groups,
      groupBoards,
      activeGroup,
      loadingGroups,
      loadingGroupBoards,
      creatingBoard,
      error,
      loadGroups,
      loadGroupBoards,
      createBoard,
      deleteBoard,
      leaveBoard,
      clearGroupBoards,
    ]
  );

  return <BoardsContext.Provider value={value}>{children}</BoardsContext.Provider>;
}

export function BoardsRealtimeBridge() {
  const { activeGroup, loadGroupBoards, loadGroups } = useBoardsContext();

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let cancelled = false;
    let boardsChannel: ReturnType<typeof supabase.channel> | null = null;
    let membershipsChannel: ReturnType<typeof supabase.channel> | null = null;
    let postsChannel: ReturnType<typeof supabase.channel> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void loadGroups();
        if (activeGroup?.groupId) {
          void loadGroupBoards(activeGroup.groupId);
        }
      }, 120);
    };

    (async () => {
      try {
        const tokenRes = await fetch('/api/supabase/realtime-token', { credentials: 'include', cache: 'no-store' });
        if (!tokenRes.ok || cancelled) return;
        const tokenJson = await tokenRes.json().catch(() => ({}));
        if (typeof tokenJson?.token !== 'string' || cancelled) return;
        supabase.realtime.setAuth(tokenJson.token);

        boardsChannel = supabase
          .channel('boards-list-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, scheduleRefresh)
          .subscribe();

        membershipsChannel = supabase
          .channel('boards-memberships-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'board_members' }, scheduleRefresh)
          .subscribe();

        postsChannel = supabase
          .channel('boards-posts-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'group_posts' }, scheduleRefresh)
          .subscribe();
      } catch {
        // ignore realtime bootstrap failures
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (boardsChannel) supabase.removeChannel(boardsChannel);
      if (membershipsChannel) supabase.removeChannel(membershipsChannel);
      if (postsChannel) supabase.removeChannel(postsChannel);
    };
  }, [activeGroup?.groupId, loadGroupBoards, loadGroups]);

  return null;
}

export function useBoardsContext() {
  const ctx = useContext(BoardsContext);
  if (!ctx) throw new Error('useBoardsContext must be used within BoardsProvider');
  return ctx;
}
