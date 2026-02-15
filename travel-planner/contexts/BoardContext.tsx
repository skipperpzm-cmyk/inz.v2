"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getBrowserSupabase } from '../lib/supabaseClient';
import type { BoardComment, BoardDetail, BoardListItem, BoardPost, BoardTravelInfo } from '../types/board';

type LoadPostsResult = { nextCursor: string | null; hasMore: boolean };

type BoardContextValue = {
  currentUserId: string | null;
  boards: BoardListItem[];
  activeBoard: BoardDetail | null;
  activeBoardStatus: number | null;
  posts: BoardPost[];
  comments: Record<string, BoardComment[]>;
  postsNextCursor: string | null;
  hasMorePosts: boolean;
  loadingMorePosts: boolean;
  loading: boolean;
  error: string | null;
  loadBoards: (opts?: { signal?: AbortSignal }) => Promise<void>;
  loadBoard: (groupId: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  loadPosts: (groupId: string, opts?: { signal?: AbortSignal; cursor?: string | null; append?: boolean }) => Promise<LoadPostsResult>;
  loadMorePosts: (groupId: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  createPost: (groupId: string, content: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  createComment: (postId: string, content: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  loadMoreComments: (postId: string) => Promise<void>;
  updateBoardName: (groupId: string, boardName: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  updateTravelInfo: (groupId: string, payload: BoardTravelInfo, opts?: { signal?: AbortSignal }) => Promise<void>;
  clearBoardState: () => void;
};

const BoardContext = createContext<BoardContextValue | null>(null);

const isPublicRoute = (pathname: string) => {
  if (pathname === '/' || pathname === '/login' || pathname === '/register' || pathname === '/signin') {
    return true;
  }
  return pathname.startsWith('/demo') || pathname.startsWith('/u/');
};

export function BoardProvider({ children }: { children: React.ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('Ty');
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [activeBoard, setActiveBoard] = useState<BoardDetail | null>(null);
  const [activeBoardStatus, setActiveBoardStatus] = useState<number | null>(null);
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [postsNextCursor, setPostsNextCursor] = useState<string | null>(null);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boardAbortRef = useRef<AbortController | null>(null);
  const boardsAbortRef = useRef<AbortController | null>(null);
  const postsAbortRef = useRef<AbortController | null>(null);
  const activeGroupIdRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadPostsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadBoardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadPostsInFlightRef = useRef(false);
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
    setActiveBoardStatus(null);
    setPosts([]);
    setPostsNextCursor(null);
    setHasMorePosts(false);
    commentLoadMoreCursorRef.current = {};
  }, []);

  const comments = useMemo<Record<string, BoardComment[]>>(() => {
    const byPost: Record<string, BoardComment[]> = {};
    posts.forEach((post) => {
      byPost[post.id] = post.comments || [];
    });
    return byPost;
  }, [posts]);

  const mergeComments = useCallback((existing: BoardComment[], incoming: BoardComment[]) => {
    const map = new Map<string, BoardComment>();
    existing.forEach((c) => map.set(c.id, c));
    incoming.forEach((c) => map.set(c.id, c));
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

  const loadBoards = useCallback(async (opts?: { signal?: AbortSignal }) => {
    boardsAbortRef.current?.abort();
    const controller = opts?.signal ? null : new AbortController();
    if (controller) boardsAbortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/boards', {
        credentials: 'include',
        cache: 'no-store',
        signal: opts?.signal ?? controller?.signal,
      });
      if (!res.ok) throw new Error('Nie udało się pobrać tablic');
      const data = await res.json();
      setBoards(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać tablic');
      setBoards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBoard = useCallback(async (groupId: string, opts?: { signal?: AbortSignal }) => {
    boardAbortRef.current?.abort();
    const controller = opts?.signal ? null : new AbortController();
    if (controller) boardAbortRef.current = controller;
    activeGroupIdRef.current = groupId;
    setLoading(true);
    setError(null);
    setActiveBoardStatus(null);
    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}`, {
        credentials: 'include',
        cache: 'no-store',
        signal: opts?.signal ?? controller?.signal,
      });
      if (!res.ok) {
        setActiveBoardStatus(res.status);
        throw new Error('Brak dostępu do tablicy');
      }
      const data = await res.json();
      if (activeGroupIdRef.current !== groupId) return;
      setActiveBoard(data as BoardDetail);
      setActiveBoardStatus(200);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać tablicy');
      setActiveBoard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPosts = useCallback(async (groupId: string, opts?: { signal?: AbortSignal; cursor?: string | null; append?: boolean }) => {
    const isAppend = Boolean(opts?.append);
    if (loadPostsInFlightRef.current && !isAppend) {
      return { nextCursor: postsNextCursorRef.current, hasMore: hasMorePostsRef.current };
    }

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

      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}/posts?${query.toString()}`, {
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

  const loadMorePosts = useCallback(async (groupId: string, opts?: { signal?: AbortSignal }) => {
    if (!postsNextCursor || !hasMorePosts) return;
    await loadPosts(groupId, { signal: opts?.signal, cursor: postsNextCursor, append: true });
  }, [hasMorePosts, loadPosts, postsNextCursor]);

  const createPost = useCallback(async (groupId: string, content: string, opts?: { signal?: AbortSignal }) => {
    const text = content.trim();
    if (!text) return;
    const optimisticId = `temp-post-${Date.now()}`;

    const optimisticPost: BoardPost = {
      id: optimisticId,
      groupId,
      authorId: currentUserId ?? 'me',
      authorName: currentUserName,
      authorAvatarUrl: currentUserAvatar,
      content: text,
      createdAt: new Date().toISOString(),
      comments: [],
    };

    setPosts((prev) => [optimisticPost, ...prev]);

    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: opts?.signal,
        body: JSON.stringify({ content: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        throw new Error(json?.error || 'Nie udało się dodać posta');
      }
      const created = json?.post as BoardPost;
      if (created?.id) {
        setPosts((prev) => {
          const replaced = prev.map((p) => (p.id === optimisticId ? created : p));
          const map = new Map<string, BoardPost>();
          replaced.forEach((post) => {
            if (!map.has(post.id)) {
              map.set(post.id, post);
            }
          });
          return Array.from(map.values());
        });
      } else {
        await loadPosts(groupId, { cursor: null, append: false });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setPosts((prev) => prev.filter((p) => p.id !== optimisticId));
        return;
      }
      setPosts((prev) => prev.filter((p) => p.id !== optimisticId));
      setError(err instanceof Error ? err.message : 'Nie udało się dodać posta');
    }
  }, [currentUserAvatar, currentUserId, currentUserName, loadPosts]);

  const deletePost = useCallback(async (postId: string) => {
    const snapshot = posts;
    setPosts((prev) => prev.filter((post) => post.id !== postId));

    try {
      const res = await fetch(`/api/boards/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        throw new Error(json?.error || 'Nie udało się usunąć posta');
      }
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

    const target = posts.find((p) => p.id === postId);
    if (!target) return;

    const optimisticId = `temp-comment-${Date.now()}`;
    const optimisticComment: BoardComment = {
      id: optimisticId,
      postId,
      groupId: target.groupId,
      authorId: currentUserId ?? 'me',
      authorName: currentUserName,
      authorAvatarUrl: currentUserAvatar,
      content: text,
      createdAt: new Date().toISOString(),
    };

    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, comments: [...post.comments, optimisticComment] }
          : post
      )
    );

    try {
      const res = await fetch(`/api/boards/posts/${encodeURIComponent(postId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: opts?.signal,
        body: JSON.stringify({ content: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        throw new Error(json?.error || 'Nie udało się dodać komentarza');
      }
      const created = json?.comment as BoardComment;
      if (created?.id) {
        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  comments: mergeComments(
                    post.comments.filter((comment) => comment.id !== optimisticId),
                    [created]
                  ),
                }
              : post
          )
        );
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? { ...post, comments: post.comments.filter((c) => c.id !== optimisticId) }
              : post
          )
        );
        return;
      }
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, comments: post.comments.filter((c) => c.id !== optimisticId) }
            : post
        )
      );
      setError(err instanceof Error ? err.message : 'Nie udało się dodać komentarza');
    }
  }, [currentUserAvatar, currentUserId, currentUserName, mergeComments, posts]);

  const deleteComment = useCallback(async (commentId: string) => {
    const snapshot = posts;
    setPosts((prev) => prev.map((post) => ({ ...post, comments: post.comments.filter((c) => c.id !== commentId) })));

    try {
      const res = await fetch(`/api/boards/comments/${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        throw new Error(json?.error || 'Nie udało się usunąć komentarza');
      }
    } catch (err) {
      setPosts(snapshot);
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć komentarza');
    }
  }, [posts]);

  const updateTravelInfo = useCallback(async (groupId: string, payload: BoardTravelInfo, opts?: { signal?: AbortSignal }) => {
    setError(null);
    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}/info`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: opts?.signal,
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        throw new Error(json?.error || 'Nie udało się zapisać informacji o podróży');
      }
      setActiveBoard((prev) => (prev ? { ...prev, travelInfo: json.travelInfo as BoardTravelInfo } : prev));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać informacji o podróży');
    }
  }, []);

  const updateBoardName = useCallback(async (groupId: string, boardName: string, opts?: { signal?: AbortSignal }) => {
    const trimmed = boardName.trim();
    if (!trimmed) throw new Error('Nazwa tablicy jest wymagana');
    setError(null);
    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(groupId)}/info`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: opts?.signal,
        body: JSON.stringify({ boardName: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        throw new Error(json?.error || 'Nie udało się zapisać nazwy tablicy');
      }

      const nextBoardName = typeof json?.boardName === 'string' && json.boardName.trim() ? json.boardName : trimmed;
      setActiveBoard((prev) => (prev && prev.groupId === groupId ? { ...prev, boardName: nextBoardName } : prev));
      setBoards((prev) => prev.map((entry) => (entry.groupId === groupId ? { ...entry, boardName: nextBoardName } : entry)));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Nie udało się zapisać nazwy tablicy';
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    }
  }, []);

  const loadMoreComments = useCallback(async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
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

      setPosts((prev) =>
        prev.map((entry) =>
          entry.id === postId
            ? {
                ...entry,
                comments: mergeComments(entry.comments, incoming),
              }
            : entry
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać komentarzy');
    }
  }, [mergeComments, posts]);

  // Ładuj usera i reaguj na logout/login (auth:changed)
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
    const onAuthChanged = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.status === 'logged-out') {
        setCurrentUserId(null);
        setCurrentUserName('Ty');
        setCurrentUserAvatar(null);
      } else {
        loadCurrentUser();
      }
    };
    window.addEventListener('auth:changed', onAuthChanged);
    return () => { mounted = false; window.removeEventListener('auth:changed', onAuthChanged); };
  }, []);

  useEffect(() => {
    if (!activeBoard?.groupId) return;

    const supabase = getBrowserSupabase();
    let cancelled = false;
    let postsChannel: ReturnType<typeof supabase.channel> | null = null;
    let commentsChannel: ReturnType<typeof supabase.channel> | null = null;
    let infoChannel: ReturnType<typeof supabase.channel> | null = null;
    let groupChannel: ReturnType<typeof supabase.channel> | null = null;
    let membershipChannel: ReturnType<typeof supabase.channel> | null = null;

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
          void loadPosts(activeBoard.groupId, { cursor: null, append: false });
          void loadBoards();
        }, 120);
      };

      const scheduleBoardReload = () => {
        if (reloadBoardTimerRef.current) clearTimeout(reloadBoardTimerRef.current);
        reloadBoardTimerRef.current = setTimeout(() => {
          void loadBoard(activeBoard.groupId);
        }, 120);
      };

      const handleChannelStatus = (status: string) => {
        if (cancelled) return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            if (cancelled) return;
            void loadPosts(activeBoard.groupId, { cursor: null, append: false });
            void loadBoard(activeBoard.groupId);
          }, 1000);
        }
      };

      postsChannel = supabase
        .channel(`board-posts:${activeBoard.groupId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'group_posts', filter: `group_id=eq.${activeBoard.groupId}` },
          schedulePostsReload
        )
        .subscribe((status) => handleChannelStatus(status));

      commentsChannel = supabase
        .channel(`board-comments:${activeBoard.groupId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'group_comments', filter: `group_id=eq.${activeBoard.groupId}` },
          schedulePostsReload
        )
        .subscribe((status) => handleChannelStatus(status));

      infoChannel = supabase
        .channel(`board-info:${activeBoard.groupId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'group_boards', filter: `group_id=eq.${activeBoard.groupId}` },
          scheduleBoardReload
        )
        .subscribe((status) => handleChannelStatus(status));

      groupChannel = supabase
        .channel(`board-group:${activeBoard.groupId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${activeBoard.groupId}` },
          scheduleBoardReload
        )
        .subscribe((status) => handleChannelStatus(status));

      if (currentUserId) {
        membershipChannel = supabase
          .channel(`board-membership:${activeBoard.groupId}:${currentUserId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'group_members',
              filter: `group_id=eq.${activeBoard.groupId}`,
            },
            scheduleBoardReload
          )
          .subscribe((status) => handleChannelStatus(status));
      }
    })();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (reloadPostsTimerRef.current) clearTimeout(reloadPostsTimerRef.current);
      if (reloadBoardTimerRef.current) clearTimeout(reloadBoardTimerRef.current);
      if (postsChannel) supabase.removeChannel(postsChannel);
      if (commentsChannel) supabase.removeChannel(commentsChannel);
      if (infoChannel) supabase.removeChannel(infoChannel);
      if (groupChannel) supabase.removeChannel(groupChannel);
      if (membershipChannel) supabase.removeChannel(membershipChannel);
    };
  }, [activeBoard?.groupId, currentUserId, loadBoard, loadBoards, loadPosts]);

  useEffect(() => {
    return () => {
      boardsAbortRef.current?.abort();
      boardAbortRef.current?.abort();
      postsAbortRef.current?.abort();
    };
  }, []);

  const value = useMemo<BoardContextValue>(
    () => ({
      currentUserId,
      boards,
      activeBoard,
      activeBoardStatus,
      posts,
      comments,
      postsNextCursor,
      hasMorePosts,
      loadingMorePosts,
      loading,
      error,
      loadBoards,
      loadBoard,
      loadPosts,
      loadMorePosts,
      createPost,
      deletePost,
      createComment,
      deleteComment,
      loadMoreComments,
      updateBoardName,
      updateTravelInfo,
      clearBoardState,
    }),
    [
      currentUserId,
      boards,
      activeBoard,
      activeBoardStatus,
      posts,
      comments,
      postsNextCursor,
      hasMorePosts,
      loadingMorePosts,
      loading,
      error,
      loadBoards,
      loadBoard,
      loadPosts,
      loadMorePosts,
      createPost,
      deletePost,
      createComment,
      deleteComment,
      loadMoreComments,
      updateBoardName,
      updateTravelInfo,
      clearBoardState,
    ]
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

export function useBoardContext() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error('useBoardContext must be used within BoardProvider');
  return ctx;
}
