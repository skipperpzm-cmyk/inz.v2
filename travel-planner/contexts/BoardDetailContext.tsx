"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getBrowserSupabase } from '../lib/supabaseClient';
import type { BoardComment, BoardDetail, BoardModerator, BoardPost, BoardPostAttachment, BoardTravelInfo, ComposerState, TripActivity, TripDay } from '../types/board';

type LoadPostsResult = { nextCursor: string | null; hasMore: boolean };

type TripDayInput = {
  title?: string | null;
  date?: string | null;
  location?: string | null;
  description?: string | null;
  accommodation?: string | null;
  estimatedBudget?: number | null;
};

type TripActivityInput = {
  time?: string | null;
  title: string;
  description?: string | null;
  cost?: number | null;
};

type PostCreateInput = {
  content: string;
  mentions?: string[];
  attachments?: BoardPostAttachment[];
};

type BoardDetailContextValue = {
  currentUserId: string | null;
  activeBoard: BoardDetail | null;
  moderators: BoardModerator[];
  isModerator: boolean;
  isOwner: boolean;
  canModerate: boolean;
  activeBoardStatus: number | null;
  posts: BoardPost[];
  tripDays: TripDay[];
  loadingTripDays: boolean;
  comments: Record<string, BoardComment[]>;
  composerState: ComposerState;
  postsNextCursor: string | null;
  hasMorePosts: boolean;
  loadingMorePosts: boolean;
  loading: boolean;
  error: string | null;
  loadBoard: (groupId: string, boardId: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  loadPosts: (groupId: string, boardId: string, opts?: { signal?: AbortSignal; cursor?: string | null; append?: boolean }) => Promise<LoadPostsResult>;
  loadMorePosts: (groupId: string, boardId: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  createPost: (groupId: string, boardId: string, payload: PostCreateInput, opts?: { signal?: AbortSignal }) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  createComment: (postId: string, content: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  loadMoreComments: (postId: string) => Promise<void>;
  loadTripDays: (groupId: string, boardId: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  addTripDay: (groupId: string, boardId: string, payload?: TripDayInput, opts?: { signal?: AbortSignal }) => Promise<void>;
  updateTripDay: (groupId: string, boardId: string, dayId: string, payload: TripDayInput, opts?: { signal?: AbortSignal }) => Promise<void>;
  deleteTripDay: (groupId: string, boardId: string, dayId: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  reorderTripDays: (groupId: string, boardId: string, orderedDayIds: string[], opts?: { signal?: AbortSignal }) => Promise<void>;
  addTripActivity: (groupId: string, boardId: string, dayId: string, payload: TripActivityInput, opts?: { signal?: AbortSignal }) => Promise<void>;
  updateTripActivity: (groupId: string, boardId: string, dayId: string, activityId: string, payload: TripActivityInput, opts?: { signal?: AbortSignal }) => Promise<void>;
  deleteTripActivity: (groupId: string, boardId: string, dayId: string, activityId: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  setComposerState: (next: Partial<ComposerState>) => void;
  insertEmoji: (emoji: string) => void;
  loadModerators: (boardId: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  addModerator: (boardId: string, userId: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  removeModerator: (boardId: string, userId: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  updateBoardName: (groupId: string, boardId: string, boardName: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  updateTravelInfo: (groupId: string, boardId: string, payload: BoardTravelInfo, opts?: { signal?: AbortSignal }) => Promise<void>;
  clearBoardState: () => void;
};

const BoardDetailContext = createContext<BoardDetailContextValue | null>(null);

const isPublicRoute = (pathname: string) => {
  if (pathname === '/' || pathname === '/login' || pathname === '/register' || pathname === '/signin') {
    return true;
  }
  return pathname.startsWith('/demo') || pathname.startsWith('/u/');
};

export function BoardDetailProvider({ children }: { children: React.ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('Ty');
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [activeBoard, setActiveBoard] = useState<BoardDetail | null>(null);
  const [moderators, setModerators] = useState<BoardModerator[]>([]);
  const [activeBoardStatus, setActiveBoardStatus] = useState<number | null>(null);
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [tripDays, setTripDays] = useState<TripDay[]>([]);
  const [loadingTripDays, setLoadingTripDays] = useState(false);
  const [composerState, setComposerStateState] = useState<ComposerState>({
    content: '',
    selectionStart: 0,
    selectionEnd: 0,
    mentions: [],
  });
  const [postsNextCursor, setPostsNextCursor] = useState<string | null>(null);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const boardAbortRef = useRef<AbortController | null>(null);
  const postsAbortRef = useRef<AbortController | null>(null);
  const tripDaysAbortRef = useRef<AbortController | null>(null);
  const activeScopeRef = useRef<{ groupId: string; boardId: string } | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadPostsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadBoardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadModeratorsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadTripDaysTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadPostsInFlightRef = useRef(false);
  const loadTripDaysInFlightRef = useRef(false);
  const commentLoadMoreCursorRef = useRef<Record<string, string | null>>({});
  const commentAddThrottleRef = useRef<Record<string, number>>({});
  const postsNextCursorRef = useRef<string | null>(null);
  const hasMorePostsRef = useRef(false);

  useEffect(() => {
    postsNextCursorRef.current = postsNextCursor;
    hasMorePostsRef.current = hasMorePosts;
  }, [hasMorePosts, postsNextCursor]);

  const clearBoardState = useCallback(() => {
    setActiveBoard(null);
    setModerators([]);
    setActiveBoardStatus(null);
    setPosts([]);
    setTripDays([]);
    setLoadingTripDays(false);
    setComposerStateState({
      content: '',
      selectionStart: 0,
      selectionEnd: 0,
      mentions: [],
    });
    setPostsNextCursor(null);
    setHasMorePosts(false);
    commentLoadMoreCursorRef.current = {};
    activeScopeRef.current = null;
  }, []);

  const normalizeTripDays = useCallback((value: unknown): TripDay[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry: any) => ({
        id: String(entry?.id ?? ''),
        boardId: String(entry?.boardId ?? ''),
        dayNumber: Number(entry?.dayNumber ?? 0),
        title: typeof entry?.title === 'string' ? entry.title : null,
        date: typeof entry?.date === 'string' ? entry.date : null,
        location: typeof entry?.location === 'string' ? entry.location : null,
        description: typeof entry?.description === 'string' ? entry.description : null,
        accommodation: typeof entry?.accommodation === 'string' ? entry.accommodation : null,
        estimatedBudget: entry?.estimatedBudget != null && Number.isFinite(Number(entry.estimatedBudget))
          ? Number(entry.estimatedBudget)
          : null,
        activities: Array.isArray(entry?.activities)
          ? entry.activities.map((activity: any) => ({
              id: String(activity?.id ?? ''),
              dayId: String(activity?.dayId ?? ''),
              time: typeof activity?.time === 'string' ? activity.time : null,
              title: String(activity?.title ?? ''),
              description: typeof activity?.description === 'string' ? activity.description : null,
              cost: activity?.cost != null && Number.isFinite(Number(activity.cost)) ? Number(activity.cost) : null,
              createdAt: String(activity?.createdAt ?? new Date().toISOString()),
              updatedAt: String(activity?.updatedAt ?? new Date().toISOString()),
            } as TripActivity))
          : [],
        createdAt: String(entry?.createdAt ?? new Date().toISOString()),
        updatedAt: String(entry?.updatedAt ?? new Date().toISOString()),
      } as TripDay))
      .filter((day) => day.id && day.boardId)
      .sort((a, b) => (a.dayNumber - b.dayNumber) || (a.createdAt < b.createdAt ? -1 : 1));
  }, []);

  const loadTripDays = useCallback(async (groupId: string, boardId: string, opts?: { signal?: AbortSignal }) => {
    if (loadTripDaysInFlightRef.current) return;

    tripDaysAbortRef.current?.abort();
    const controller = opts?.signal ? null : new AbortController();
    if (controller) tripDaysAbortRef.current = controller;

    loadTripDaysInFlightRef.current = true;
    setLoadingTripDays(true);

    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}/${encodeURIComponent(boardId)}/trip-days`, {
        credentials: 'include',
        cache: 'no-store',
        signal: opts?.signal ?? controller?.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error || 'Nie udało się pobrać planu podróży');
      setTripDays(normalizeTripDays(json?.tripDays));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać planu podróży');
    } finally {
      loadTripDaysInFlightRef.current = false;
      setLoadingTripDays(false);
    }
  }, [normalizeTripDays]);

  const addTripDay = useCallback(async (groupId: string, boardId: string, payload?: TripDayInput, opts?: { signal?: AbortSignal }) => {
    setError(null);
    const optimisticId = `temp-trip-day-${Date.now()}`;
    const nowIso = new Date().toISOString();
    setTripDays((prev) => {
      const nextNumber = prev.length + 1;
      return [...prev, {
        id: optimisticId,
        boardId,
        dayNumber: nextNumber,
        title: payload?.title ?? `Dzień ${nextNumber}`,
        date: payload?.date ?? null,
        location: payload?.location ?? null,
        description: payload?.description ?? null,
        accommodation: payload?.accommodation ?? null,
        estimatedBudget: payload?.estimatedBudget ?? null,
        activities: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      }];
    });

    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}/${encodeURIComponent(boardId)}/trip-days`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: opts?.signal,
        body: JSON.stringify(payload ?? {}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error || 'Nie udało się dodać dnia podróży');
      if (Array.isArray(json?.tripDays)) {
        setTripDays(normalizeTripDays(json.tripDays));
      } else {
        await loadTripDays(groupId, boardId, opts);
      }
    } catch (err) {
      setTripDays((prev) => prev.filter((entry) => entry.id !== optimisticId));
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Nie udało się dodać dnia podróży');
      throw err instanceof Error ? err : new Error('Nie udało się dodać dnia podróży');
    }
  }, [loadTripDays, normalizeTripDays]);

  const updateTripDay = useCallback(async (groupId: string, boardId: string, dayId: string, payload: TripDayInput, opts?: { signal?: AbortSignal }) => {
    if (!dayId) return;
    setError(null);
    const snapshot = tripDays;
    setTripDays((prev) => prev.map((day) => day.id === dayId ? {
      ...day,
      ...payload,
      updatedAt: new Date().toISOString(),
    } : day));

    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}/${encodeURIComponent(boardId)}/trip-days/${encodeURIComponent(dayId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: opts?.signal,
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error || 'Nie udało się zapisać dnia podróży');
    } catch (err) {
      setTripDays(snapshot);
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać dnia podróży');
      throw err instanceof Error ? err : new Error('Nie udało się zapisać dnia podróży');
    }
  }, [tripDays]);

  const deleteTripDay = useCallback(async (groupId: string, boardId: string, dayId: string, opts?: { signal?: AbortSignal }) => {
    if (!dayId) return;
    setError(null);
    const snapshot = tripDays;
    setTripDays((prev) => prev.filter((day) => day.id !== dayId).map((day, index) => ({ ...day, dayNumber: index + 1 })));

    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}/${encodeURIComponent(boardId)}/trip-days/${encodeURIComponent(dayId)}`, {
        method: 'DELETE',
        credentials: 'include',
        signal: opts?.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error || 'Nie udało się usunąć dnia podróży');
      await loadTripDays(groupId, boardId, opts);
    } catch (err) {
      setTripDays(snapshot);
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć dnia podróży');
      throw err instanceof Error ? err : new Error('Nie udało się usunąć dnia podróży');
    }
  }, [loadTripDays, tripDays]);

  const reorderTripDays = useCallback(async (groupId: string, boardId: string, orderedDayIds: string[], opts?: { signal?: AbortSignal }) => {
    if (orderedDayIds.length === 0) return;
    setError(null);
    const snapshot = tripDays;
    setTripDays((prev) => {
      const map = new Map(prev.map((day) => [day.id, day]));
      return orderedDayIds.map((id, index) => ({ ...(map.get(id) as TripDay), dayNumber: index + 1 }));
    });

    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}/${encodeURIComponent(boardId)}/trip-days`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: opts?.signal,
        body: JSON.stringify({ dayIds: orderedDayIds }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error || 'Nie udało się zmienić kolejności dni');
      if (Array.isArray(json?.tripDays)) {
        setTripDays(normalizeTripDays(json.tripDays));
      }
    } catch (err) {
      setTripDays(snapshot);
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Nie udało się zmienić kolejności dni');
      throw err instanceof Error ? err : new Error('Nie udało się zmienić kolejności dni');
    }
  }, [normalizeTripDays, tripDays]);

  const addTripActivity = useCallback(async (groupId: string, boardId: string, dayId: string, payload: TripActivityInput, opts?: { signal?: AbortSignal }) => {
    if (!dayId) return;
    setError(null);
    const optimisticId = `temp-activity-${Date.now()}`;
    const nowIso = new Date().toISOString();

    setTripDays((prev) => prev.map((day) => day.id === dayId
      ? {
          ...day,
          activities: [...day.activities, {
            id: optimisticId,
            dayId,
            time: payload.time ?? null,
            title: payload.title,
            description: payload.description ?? null,
            cost: payload.cost ?? null,
            createdAt: nowIso,
            updatedAt: nowIso,
          }],
        }
      : day));

    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}/${encodeURIComponent(boardId)}/trip-days/${encodeURIComponent(dayId)}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: opts?.signal,
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error || 'Nie udało się dodać aktywności');
      await loadTripDays(groupId, boardId, opts);
    } catch (err) {
      setTripDays((prev) => prev.map((day) => day.id === dayId
        ? { ...day, activities: day.activities.filter((activity) => activity.id !== optimisticId) }
        : day));
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Nie udało się dodać aktywności');
      throw err instanceof Error ? err : new Error('Nie udało się dodać aktywności');
    }
  }, [loadTripDays]);

  const updateTripActivity = useCallback(async (groupId: string, boardId: string, dayId: string, activityId: string, payload: TripActivityInput, opts?: { signal?: AbortSignal }) => {
    if (!dayId || !activityId) return;
    setError(null);
    const snapshot = tripDays;

    setTripDays((prev) => prev.map((day) => day.id === dayId
      ? {
          ...day,
          activities: day.activities.map((activity) => activity.id === activityId
            ? { ...activity, ...payload, updatedAt: new Date().toISOString() }
            : activity),
        }
      : day));

    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}/${encodeURIComponent(boardId)}/trip-days/${encodeURIComponent(dayId)}/activities/${encodeURIComponent(activityId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: opts?.signal,
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error || 'Nie udało się zapisać aktywności');
    } catch (err) {
      setTripDays(snapshot);
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać aktywności');
      throw err instanceof Error ? err : new Error('Nie udało się zapisać aktywności');
    }
  }, [tripDays]);

  const deleteTripActivity = useCallback(async (groupId: string, boardId: string, dayId: string, activityId: string, opts?: { signal?: AbortSignal }) => {
    if (!dayId || !activityId) return;
    setError(null);
    const snapshot = tripDays;

    setTripDays((prev) => prev.map((day) => day.id === dayId
      ? { ...day, activities: day.activities.filter((activity) => activity.id !== activityId) }
      : day));

    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}/${encodeURIComponent(boardId)}/trip-days/${encodeURIComponent(dayId)}/activities/${encodeURIComponent(activityId)}`, {
        method: 'DELETE',
        credentials: 'include',
        signal: opts?.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error || 'Nie udało się usunąć aktywności');
    } catch (err) {
      setTripDays(snapshot);
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć aktywności');
      throw err instanceof Error ? err : new Error('Nie udało się usunąć aktywności');
    }
  }, [tripDays]);

  const setComposerState = useCallback((next: Partial<ComposerState>) => {
    setComposerStateState((prev) => ({
      ...prev,
      content: typeof next.content === 'string' ? next.content : prev.content,
      selectionStart: typeof next.selectionStart === 'number' ? next.selectionStart : prev.selectionStart,
      selectionEnd: typeof next.selectionEnd === 'number' ? next.selectionEnd : prev.selectionEnd,
      mentions: Array.isArray(next.mentions) ? next.mentions : prev.mentions,
    }));
  }, []);

  const insertEmoji = useCallback((emoji: string) => {
    setComposerStateState((prev) => {
      const start = Math.max(0, Math.min(prev.selectionStart, prev.content.length));
      const end = Math.max(start, Math.min(prev.selectionEnd, prev.content.length));
      const nextContent = `${prev.content.slice(0, start)}${emoji}${prev.content.slice(end)}`;
      const cursor = start + emoji.length;
      return {
        ...prev,
        content: nextContent,
        selectionStart: cursor,
        selectionEnd: cursor,
      };
    });
  }, []);

  const loadModerators = useCallback(async (boardId: string, opts?: { signal?: AbortSignal }) => {
    if (!boardId) return;
    try {
      const res = await fetch(`/api/boards/by-id/${encodeURIComponent(boardId)}/moderators`, {
        credentials: 'include',
        cache: 'no-store',
        signal: opts?.signal,
      });
      if (!res.ok) {
        if (res.status === 403 || res.status === 404) {
          setModerators([]);
          return;
        }
        throw new Error('Nie udało się pobrać moderatorów tablicy');
      }
      const data = await res.json();
      const next = Array.isArray(data?.moderators) ? (data.moderators as BoardModerator[]) : [];
      setModerators(next);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać moderatorów tablicy');
    }
  }, []);

  const addModerator = useCallback(async (boardId: string, userId: string, opts?: { signal?: AbortSignal }) => {
    if (!boardId || !userId) return;
    setError(null);
    try {
      const res = await fetch(`/api/boards/by-id/${encodeURIComponent(boardId)}/moderators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: opts?.signal,
        body: JSON.stringify({ userId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error || 'Nie udało się dodać moderatora');
      const next = Array.isArray(json?.moderators) ? (json.moderators as BoardModerator[]) : null;
      if (next) {
        setModerators(next);
      } else {
        await loadModerators(boardId, opts);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Nie udało się dodać moderatora');
      throw err instanceof Error ? err : new Error('Nie udało się dodać moderatora');
    }
  }, [loadModerators]);

  const removeModerator = useCallback(async (boardId: string, userId: string, opts?: { signal?: AbortSignal }) => {
    if (!boardId || !userId) return;
    setError(null);
    try {
      const res = await fetch(`/api/boards/by-id/${encodeURIComponent(boardId)}/moderators/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        credentials: 'include',
        signal: opts?.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error || 'Nie udało się usunąć moderatora');
      const next = Array.isArray(json?.moderators) ? (json.moderators as BoardModerator[]) : null;
      if (next) {
        setModerators(next);
      } else {
        await loadModerators(boardId, opts);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć moderatora');
      throw err instanceof Error ? err : new Error('Nie udało się usunąć moderatora');
    }
  }, [loadModerators]);

  const comments = useMemo<Record<string, BoardComment[]>>(() => {
    const byPost: Record<string, BoardComment[]> = {};
    posts.forEach((post) => {
      byPost[post.id] = post.comments || [];
    });
    return byPost;
  }, [posts]);

  const mergeComments = useCallback((existing: BoardComment[], incoming: BoardComment[]) => {
    const map = new Map<string, BoardComment>();
    existing.forEach((entry) => map.set(entry.id, entry));
    incoming.forEach((entry) => map.set(entry.id, entry));
    return Array.from(map.values()).sort((a, b) => {
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      return at - bt;
    });
  }, []);

  const reconcileOptimisticPosts = useCallback((serverPosts: BoardPost[], prevPosts: BoardPost[]) => {
    const serverById = new Map(serverPosts.map((post) => [post.id, post]));
    const carriedOptimistic = prevPosts.filter((post) => {
      if (!post.id.startsWith('temp-post-')) return false;
      return !serverPosts.some((remote) => {
        if (remote.authorId !== post.authorId) return false;
        if (remote.content.trim() !== post.content.trim()) return false;
        const delta = Math.abs(new Date(remote.createdAt).getTime() - new Date(post.createdAt).getTime());
        return delta <= 120000;
      });
    });

    const merged = [...serverPosts];
    carriedOptimistic.forEach((optimistic) => {
      if (!serverById.has(optimistic.id)) merged.unshift(optimistic);
    });
    return merged;
  }, []);

  const loadBoard = useCallback(async (groupId: string, boardId: string, opts?: { signal?: AbortSignal }) => {
    boardAbortRef.current?.abort();
    const controller = opts?.signal ? null : new AbortController();
    if (controller) boardAbortRef.current = controller;

    activeScopeRef.current = { groupId, boardId };
    setLoading(true);
    setError(null);
    setActiveBoardStatus(null);

    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}/${encodeURIComponent(boardId)}`, {
        credentials: 'include',
        cache: 'no-store',
        signal: opts?.signal ?? controller?.signal,
      });
      if (!res.ok) {
        setActiveBoardStatus(res.status);
        throw new Error('Brak dostępu do tablicy');
      }
      const data = await res.json();
      if (activeScopeRef.current?.boardId !== boardId || activeScopeRef.current?.groupId !== groupId) return;
      setActiveBoard(data as BoardDetail);
      setActiveBoardStatus(200);
      await loadModerators(boardId, opts);
      await loadTripDays(groupId, boardId, opts);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać tablicy');
      setActiveBoard(null);
      setModerators([]);
      setTripDays([]);
    } finally {
      setLoading(false);
    }
  }, [loadModerators, loadTripDays]);

  const loadPosts = useCallback(async (groupId: string, boardId: string, opts?: { signal?: AbortSignal; cursor?: string | null; append?: boolean }) => {
    const isAppend = Boolean(opts?.append);

    if (!isAppend) {
      postsAbortRef.current?.abort();
      const controller = opts?.signal ? null : new AbortController();
      if (controller) postsAbortRef.current = controller;
    }

    if (isAppend) {
      setLoadingMorePosts(true);
    } else {
      setLoading(true);
    }

    loadPostsInFlightRef.current = true;
    setError(null);

    try {
      const query = new URLSearchParams();
      query.set('limit', '20');
      query.set('commentLimit', '10');
      if (opts?.cursor) query.set('cursor', opts.cursor);

      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}/${encodeURIComponent(boardId)}/posts?${query.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
        signal: opts?.signal ?? postsAbortRef.current?.signal,
      });
      if (!res.ok) throw new Error('Nie udało się pobrać postów');
      const data = await res.json();
      const next = Array.isArray(data?.posts) ? (data.posts as BoardPost[]) : [];
      const nextCursor = typeof data?.nextCursor === 'string' ? data.nextCursor : null;
      const hasMore = Boolean(data?.hasMore);

      setPosts((prev) => {
        if (isAppend) {
          const map = new Map(prev.map((post) => [post.id, post]));
          next.forEach((post) => {
            const existing = map.get(post.id);
            if (!existing) {
              map.set(post.id, post);
              return;
            }
            map.set(post.id, { ...post, comments: mergeComments(existing.comments, post.comments) });
          });
          return Array.from(map.values()).sort((a, b) => {
            const at = new Date(a.createdAt).getTime();
            const bt = new Date(b.createdAt).getTime();
            return bt - at;
          });
        }

        return reconcileOptimisticPosts(next, prev);
      });

      setPostsNextCursor(nextCursor);
      setHasMorePosts(hasMore);
      return { nextCursor, hasMore };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { nextCursor: postsNextCursorRef.current, hasMore: hasMorePostsRef.current };
      }
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać postów');
      if (!isAppend) setPosts([]);
    } finally {
      loadPostsInFlightRef.current = false;
      setLoading(false);
      setLoadingMorePosts(false);
    }

    return { nextCursor: postsNextCursorRef.current, hasMore: hasMorePostsRef.current };
  }, [mergeComments, reconcileOptimisticPosts]);

  const loadMorePosts = useCallback(async (groupId: string, boardId: string, opts?: { signal?: AbortSignal }) => {
    if (!postsNextCursor || !hasMorePosts) return;
    await loadPosts(groupId, boardId, { signal: opts?.signal, cursor: postsNextCursor, append: true });
  }, [hasMorePosts, loadPosts, postsNextCursor]);

  const createPost = useCallback(async (groupId: string, boardId: string, payload: PostCreateInput, opts?: { signal?: AbortSignal }) => {
    const text = payload.content.trim();
    const attachments = Array.isArray(payload.attachments)
      ? payload.attachments.slice(0, 8)
      : [];
    if (!text && attachments.length === 0) return;
    if (text.length > 5000) {
      const message = 'Treść posta nie może przekraczać 5000 znaków';
      setError(message);
      throw new Error(message);
    }

    const mentions = Array.isArray(payload.mentions)
      ? Array.from(new Set(payload.mentions.map((entry) => String(entry).trim()).filter(Boolean))).slice(0, 20)
      : [];

    const optimisticId = `temp-post-${Date.now()}`;
    const optimisticPost: BoardPost = {
      id: optimisticId,
      boardId,
      groupId,
      authorId: currentUserId ?? 'me',
      authorName: currentUserName,
      authorAvatarUrl: currentUserAvatar,
      content: text,
      attachments,
      mentions: mentions.map((entry) => ({ userId: '', name: entry })),
      createdAt: new Date().toISOString(),
      comments: [],
    };

    setPosts((prev) => [optimisticPost, ...prev]);

    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}/${encodeURIComponent(boardId)}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: opts?.signal,
        body: JSON.stringify({
          content: text,
          mentions,
          attachments,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        throw new Error(json?.error || 'Nie udało się dodać posta');
      }

      const created = json?.post as BoardPost;
      if (created?.id) {
        setPosts((prev) => {
          const replaced = prev.map((entry) => (entry.id === optimisticId ? created : entry));
          const map = new Map<string, BoardPost>();
          replaced.forEach((entry) => {
            if (!map.has(entry.id)) map.set(entry.id, entry);
          });
          return Array.from(map.values());
        });
        setComposerStateState({
          content: '',
          selectionStart: 0,
          selectionEnd: 0,
          mentions: [],
        });
      } else {
        await loadPosts(groupId, boardId, { cursor: null, append: false });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setPosts((prev) => prev.filter((entry) => entry.id !== optimisticId));
        return;
      }
      setPosts((prev) => prev.filter((entry) => entry.id !== optimisticId));
      setError(err instanceof Error ? err.message : 'Nie udało się dodać posta');
    }
  }, [currentUserAvatar, currentUserId, currentUserName, loadPosts]);

  const deletePost = useCallback(async (postId: string) => {
    const snapshot = posts;
    setPosts((prev) => prev.filter((entry) => entry.id !== postId));

    try {
      const res = await fetch(`/api/boards/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error || 'Nie udało się usunąć posta');
    } catch (err) {
      setPosts(snapshot);
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć posta');
    }
  }, [posts]);

  const createComment = useCallback(async (postId: string, content: string, opts?: { signal?: AbortSignal }) => {
    const text = content.trim();
    if (!text) return;

    const now = Date.now();
    const last = commentAddThrottleRef.current[postId] ?? 0;
    if (now - last < 350) return;
    commentAddThrottleRef.current[postId] = now;

    const target = posts.find((entry) => entry.id === postId);
    if (!target) return;

    const optimisticId = `temp-comment-${Date.now()}`;
    const optimisticComment: BoardComment = {
      id: optimisticId,
      postId,
      boardId: target.boardId,
      groupId: target.groupId,
      authorId: currentUserId ?? 'me',
      authorName: currentUserName,
      authorAvatarUrl: currentUserAvatar,
      content: text,
      createdAt: new Date().toISOString(),
    };

    setPosts((prev) => prev.map((entry) => entry.id === postId ? { ...entry, comments: [...entry.comments, optimisticComment] } : entry));

    try {
      const res = await fetch(`/api/boards/posts/${encodeURIComponent(postId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: opts?.signal,
        body: JSON.stringify({ content: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error || 'Nie udało się dodać komentarza');

      const created = json?.comment as BoardComment;
      if (created?.id) {
        setPosts((prev) => prev.map((entry) => entry.id === postId ? {
          ...entry,
          comments: mergeComments(entry.comments.filter((comment) => comment.id !== optimisticId), [created]),
        } : entry));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setPosts((prev) => prev.map((entry) => entry.id === postId ? { ...entry, comments: entry.comments.filter((c) => c.id !== optimisticId) } : entry));
        return;
      }
      setPosts((prev) => prev.map((entry) => entry.id === postId ? { ...entry, comments: entry.comments.filter((c) => c.id !== optimisticId) } : entry));
      setError(err instanceof Error ? err.message : 'Nie udało się dodać komentarza');
    }
  }, [currentUserAvatar, currentUserId, currentUserName, mergeComments, posts]);

  const deleteComment = useCallback(async (commentId: string) => {
    const snapshot = posts;
    setPosts((prev) => prev.map((entry) => ({ ...entry, comments: entry.comments.filter((c) => c.id !== commentId) })));

    try {
      const res = await fetch(`/api/boards/comments/${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error || 'Nie udało się usunąć komentarza');
    } catch (err) {
      setPosts(snapshot);
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć komentarza');
    }
  }, [posts]);

  const updateTravelInfo = useCallback(async (groupId: string, boardId: string, payload: BoardTravelInfo, opts?: { signal?: AbortSignal }) => {
    setError(null);
    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}/${encodeURIComponent(boardId)}/info`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: opts?.signal,
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error || 'Nie udało się zapisać informacji o podróży');
      setActiveBoard((prev) => (prev ? { ...prev, travelInfo: json.travelInfo as BoardTravelInfo } : prev));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać informacji o podróży');
    }
  }, []);

  const updateBoardName = useCallback(async (groupId: string, boardId: string, boardName: string, opts?: { signal?: AbortSignal }) => {
    const trimmed = boardName.trim();
    if (!trimmed) throw new Error('Nazwa tablicy jest wymagana');
    setError(null);

    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}/${encodeURIComponent(boardId)}/info`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: opts?.signal,
        body: JSON.stringify({ boardName: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error || 'Nie udało się zapisać nazwy tablicy');

      const nextBoardName = typeof json?.boardName === 'string' && json.boardName.trim() ? json.boardName : trimmed;
      setActiveBoard((prev) => (prev && prev.id === boardId ? { ...prev, boardName: nextBoardName } : prev));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Nie udało się zapisać nazwy tablicy';
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    }
  }, []);

  const loadMoreComments = useCallback(async (postId: string) => {
    const post = posts.find((entry) => entry.id === postId);
    if (!post) return;

    const cursor = commentLoadMoreCursorRef.current[postId] ?? null;
    const query = new URLSearchParams();
    query.set('limit', '10');
    if (cursor) query.set('cursor', cursor);

    try {
      const res = await fetch(`/api/boards/posts/${encodeURIComponent(postId)}/comments?${query.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Nie udało się pobrać komentarzy');

      const incoming = Array.isArray(data?.comments) ? (data.comments as BoardComment[]) : [];
      commentLoadMoreCursorRef.current[postId] = typeof data?.nextCursor === 'string' ? data.nextCursor : null;

      setPosts((prev) => prev.map((entry) => entry.id === postId ? {
        ...entry,
        comments: mergeComments(entry.comments, incoming),
      } : entry));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać komentarzy');
    }
  }, [mergeComments, posts]);

  useEffect(() => {
    let mounted = true;

    const loadCurrentUser = async () => {
      if (typeof window !== 'undefined' && isPublicRoute(window.location.pathname)) {
        if (mounted) {
          setCurrentUserId(null);
          setCurrentUserName('Ty');
          setCurrentUserAvatar(null);
        }
        return;
      }

      try {
        const res = await fetch('/api/user/me', { credentials: 'include', cache: 'no-store' });
        if (!res.ok) {
          if (mounted) {
            setCurrentUserId(null);
            setCurrentUserName('Ty');
            setCurrentUserAvatar(null);
          }
          return;
        }

        const data = await res.json();
        if (mounted) {
          setCurrentUserId(typeof data?.id === 'string' ? data.id : null);
          setCurrentUserName((data?.usernameDisplay || data?.username || data?.email || 'Ty') as string);
          setCurrentUserAvatar((data?.avatarUrl ?? null) as string | null);
        }
      } catch {
        if (mounted) {
          setCurrentUserId(null);
          setCurrentUserName('Ty');
          setCurrentUserAvatar(null);
        }
      }
    };

    loadCurrentUser();

    const onAuthChanged = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.status === 'logged-out') {
        setCurrentUserId(null);
        setCurrentUserName('Ty');
        setCurrentUserAvatar(null);
      } else {
        void loadCurrentUser();
      }
    };

    window.addEventListener('auth:changed', onAuthChanged);
    return () => {
      mounted = false;
      window.removeEventListener('auth:changed', onAuthChanged);
    };
  }, []);

  useEffect(() => {
    if (!activeBoard?.id || !activeBoard?.groupId) return;

    const supabase = getBrowserSupabase();
    let cancelled = false;

    let postsChannel: ReturnType<typeof supabase.channel> | null = null;
    let commentsChannel: ReturnType<typeof supabase.channel> | null = null;
    let boardChannel: ReturnType<typeof supabase.channel> | null = null;
    let moderatorsChannel: ReturnType<typeof supabase.channel> | null = null;
    let tripDaysChannel: ReturnType<typeof supabase.channel> | null = null;
    let tripActivitiesChannel: ReturnType<typeof supabase.channel> | null = null;

    const refreshRealtimeToken = async () => {
      try {
        const tokenRes = await fetch('/api/supabase/realtime-token', { credentials: 'include', cache: 'no-store' });
        if (!tokenRes.ok) return false;
        const tokenJson = await tokenRes.json().catch(() => ({}));
        if (cancelled) return false;
        if (typeof tokenJson?.token === 'string') {
          supabase.realtime.setAuth(tokenJson.token);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };

    (async () => {
      const authed = await refreshRealtimeToken();
      if (!authed || cancelled) return;

      const schedulePostsReload = () => {
        if (reloadPostsTimerRef.current) clearTimeout(reloadPostsTimerRef.current);
        reloadPostsTimerRef.current = setTimeout(() => {
          void loadPosts(activeBoard.groupId, activeBoard.id, { cursor: null, append: false });
        }, 120);
      };

      const scheduleBoardReload = () => {
        if (reloadBoardTimerRef.current) clearTimeout(reloadBoardTimerRef.current);
        reloadBoardTimerRef.current = setTimeout(() => {
          void loadBoard(activeBoard.groupId, activeBoard.id);
        }, 120);
      };

      const scheduleModeratorsReload = () => {
        if (reloadModeratorsTimerRef.current) clearTimeout(reloadModeratorsTimerRef.current);
        reloadModeratorsTimerRef.current = setTimeout(() => {
          void loadModerators(activeBoard.id);
        }, 120);
      };

      const scheduleTripDaysReload = () => {
        if (reloadTripDaysTimerRef.current) clearTimeout(reloadTripDaysTimerRef.current);
        reloadTripDaysTimerRef.current = setTimeout(() => {
          void loadTripDays(activeBoard.groupId, activeBoard.id);
        }, 120);
      };

      const handleChannelStatus = (status: string) => {
        if (cancelled) return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            if (cancelled) return;
            void loadPosts(activeBoard.groupId, activeBoard.id, { cursor: null, append: false });
            void loadBoard(activeBoard.groupId, activeBoard.id);
            void loadModerators(activeBoard.id);
            void loadTripDays(activeBoard.groupId, activeBoard.id);
          }, 1000);
        }
      };

      postsChannel = supabase
        .channel(`board-posts:${activeBoard.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'group_posts', filter: `board_id=eq.${activeBoard.id}` },
          schedulePostsReload
        )
        .subscribe((status) => handleChannelStatus(status));

      commentsChannel = supabase
        .channel(`board-comments:${activeBoard.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'group_comments', filter: `board_id=eq.${activeBoard.id}` },
          schedulePostsReload
        )
        .subscribe((status) => handleChannelStatus(status));

      boardChannel = supabase
        .channel(`board-detail:${activeBoard.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'boards', filter: `id=eq.${activeBoard.id}` },
          scheduleBoardReload
        )
        .subscribe((status) => handleChannelStatus(status));

      moderatorsChannel = supabase
        .channel(`board-moderators:${activeBoard.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'board_moderators', filter: `board_id=eq.${activeBoard.id}` },
          scheduleModeratorsReload
        )
        .subscribe((status) => handleChannelStatus(status));

      tripDaysChannel = supabase
        .channel(`board-trip-days:${activeBoard.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'board_trip_days', filter: `board_id=eq.${activeBoard.id}` },
          scheduleTripDaysReload
        )
        .subscribe((status) => handleChannelStatus(status));

      tripActivitiesChannel = supabase
        .channel(`board-trip-activities:${activeBoard.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'board_trip_activities' },
          scheduleTripDaysReload
        )
        .subscribe((status) => handleChannelStatus(status));
    })();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (reloadPostsTimerRef.current) clearTimeout(reloadPostsTimerRef.current);
      if (reloadBoardTimerRef.current) clearTimeout(reloadBoardTimerRef.current);
      if (reloadModeratorsTimerRef.current) clearTimeout(reloadModeratorsTimerRef.current);
      if (reloadTripDaysTimerRef.current) clearTimeout(reloadTripDaysTimerRef.current);
      if (postsChannel) supabase.removeChannel(postsChannel);
      if (commentsChannel) supabase.removeChannel(commentsChannel);
      if (boardChannel) supabase.removeChannel(boardChannel);
      if (moderatorsChannel) supabase.removeChannel(moderatorsChannel);
      if (tripDaysChannel) supabase.removeChannel(tripDaysChannel);
      if (tripActivitiesChannel) supabase.removeChannel(tripActivitiesChannel);
    };
  }, [activeBoard?.groupId, activeBoard?.id, loadBoard, loadModerators, loadPosts, loadTripDays]);

  const isOwner = useMemo(() => {
    if (!activeBoard || !currentUserId) return false;
    if (activeBoard.isOwner === true) return true;
    return activeBoard.ownerId === currentUserId;
  }, [activeBoard, currentUserId]);

  const isModerator = useMemo(() => {
    if (!currentUserId) return false;
    if (activeBoard?.isModerator === true) return true;
    return moderators.some((moderator) => moderator.id === currentUserId);
  }, [activeBoard?.isModerator, currentUserId, moderators]);

  const canModerate = isOwner || isModerator;

  useEffect(() => {
    return () => {
      boardAbortRef.current?.abort();
      postsAbortRef.current?.abort();
      tripDaysAbortRef.current?.abort();
    };
  }, []);

  const value = useMemo<BoardDetailContextValue>(
    () => ({
      currentUserId,
      activeBoard,
      moderators,
      isModerator,
      isOwner,
      canModerate,
      activeBoardStatus,
      posts,
      tripDays,
      loadingTripDays,
      comments,
      composerState,
      postsNextCursor,
      hasMorePosts,
      loadingMorePosts,
      loading,
      error,
      loadBoard,
      loadPosts,
      loadMorePosts,
      createPost,
      deletePost,
      createComment,
      deleteComment,
      loadMoreComments,
      loadTripDays,
      addTripDay,
      updateTripDay,
      deleteTripDay,
      reorderTripDays,
      addTripActivity,
      updateTripActivity,
      deleteTripActivity,
      setComposerState,
      insertEmoji,
      loadModerators,
      addModerator,
      removeModerator,
      updateBoardName,
      updateTravelInfo,
      clearBoardState,
    }),
    [
      currentUserId,
      activeBoard,
      moderators,
      isModerator,
      isOwner,
      canModerate,
      activeBoardStatus,
      posts,
      tripDays,
      loadingTripDays,
      comments,
      composerState,
      postsNextCursor,
      hasMorePosts,
      loadingMorePosts,
      loading,
      error,
      loadBoard,
      loadPosts,
      loadMorePosts,
      createPost,
      deletePost,
      createComment,
      deleteComment,
      loadMoreComments,
      loadTripDays,
      addTripDay,
      updateTripDay,
      deleteTripDay,
      reorderTripDays,
      addTripActivity,
      updateTripActivity,
      deleteTripActivity,
      setComposerState,
      insertEmoji,
      loadModerators,
      addModerator,
      removeModerator,
      updateBoardName,
      updateTravelInfo,
      clearBoardState,
    ]
  );

  return <BoardDetailContext.Provider value={value}>{children}</BoardDetailContext.Provider>;
}

export function useBoardDetailContext() {
  const ctx = useContext(BoardDetailContext);
  if (!ctx) throw new Error('useBoardDetailContext must be used within BoardDetailProvider');
  return ctx;
}
