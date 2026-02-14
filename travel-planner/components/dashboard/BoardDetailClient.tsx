"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBoard } from '../../hooks/useBoard';
import type { BoardComment, BoardPost } from '../../types/board';
import { useToast } from '../toast/ToastProvider';

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export default function BoardDetailClient({ groupId }: { groupId: string }) {
  const router = useRouter();
  const toast = useToast();
  const {
    currentUserId,
    activeBoard,
    activeBoardStatus,
    posts,
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
    updateTravelInfo,
    clearBoardState,
  } = useBoard();

  const [postContent, setPostContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [savingInfo, setSavingInfo] = useState(false);
  const [travelForm, setTravelForm] = useState({
    location: '',
    startDate: '',
    endDate: '',
    description: '',
    budget: '',
    checklistText: '',
  });
  const mutationControllersRef = useRef<Set<AbortController>>(new Set());

  const registerController = () => {
    const controller = new AbortController();
    mutationControllersRef.current.add(controller);
    return controller;
  };

  const releaseController = (controller: AbortController) => {
    mutationControllersRef.current.delete(controller);
  };

  useEffect(() => {
    const controller = new AbortController();
    clearBoardState();
    void loadBoard(groupId, { signal: controller.signal });
    void loadPosts(groupId, { signal: controller.signal, cursor: null, append: false });
    return () => {
      controller.abort();
    };
  }, [clearBoardState, groupId, loadBoard, loadPosts]);

  useEffect(() => {
    return () => {
      mutationControllersRef.current.forEach((controller) => controller.abort());
      mutationControllersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (activeBoardStatus !== 401) return;
    toast.push({ type: 'error', title: 'Sesja', message: 'Sesja wygasła. Zaloguj się ponownie.' });
    router.replace('/login');
  }, [activeBoardStatus, router, toast]);

  useEffect(() => {
    if (activeBoardStatus !== 403 && activeBoardStatus !== 404) return;
    toast.push({ type: 'error', title: 'Tablica', message: 'Brak dostępu do tablicy. Przeniesiono do listy tablic.' });
    router.replace('/dashboard/boards');
  }, [activeBoardStatus, router, toast]);

  useEffect(() => {
    if (!activeBoard || activeBoard.groupId !== groupId) return;
    const info = activeBoard.travelInfo;
    setTravelForm({
      location: info.location ?? '',
      startDate: info.startDate ?? '',
      endDate: info.endDate ?? '',
      description: info.description ?? '',
      budget: info.budget != null ? String(info.budget) : '',
      checklistText: Array.isArray(info.checklist) ? info.checklist.join('\n') : '',
    });
  }, [activeBoard, groupId]);

  const canEditInfo = useMemo(() => {
    if (!activeBoard) return false;
    return activeBoard.ownerId === currentUserId;
  }, [activeBoard, currentUserId]);

  const handleSaveInfo = async () => {
    if (!activeBoard) return;
    setSavingInfo(true);
    const controller = registerController();
    try {
      const checklist = travelForm.checklistText
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
      await updateTravelInfo(activeBoard.groupId, {
        location: travelForm.location || null,
        startDate: travelForm.startDate || null,
        endDate: travelForm.endDate || null,
        description: travelForm.description || null,
        budget: travelForm.budget ? Number(travelForm.budget) : null,
        checklist,
      }, { signal: controller.signal });
    } finally {
      releaseController(controller);
      setSavingInfo(false);
    }
  };

  if ((loading || activeBoardStatus === null) && !activeBoard) {
    return (
      <div className="space-y-4 lg:pl-6">
        <div className="h-8 w-64 rounded-lg bg-white/10 animate-pulse" />
        <div className="h-40 rounded-2xl bg-white/10 animate-pulse" />
        <div className="h-64 rounded-2xl bg-white/10 animate-pulse" />
      </div>
    );
  }

  if (!activeBoard) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4">
        <div className="text-red-300">Brak dostępu do tablicy lub tablica nie istnieje.</div>
        <div className="mt-3">
          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
            onClick={() => {
              void loadBoard(groupId);
              void loadPosts(groupId, { cursor: null, append: false });
            }}
          >
            Spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:pl-6">
      <header className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center gap-4">
          {activeBoard.groupAvatarUrl ? (
            <img src={activeBoard.groupAvatarUrl} alt={activeBoard.groupName} className="w-14 h-14 rounded-full object-cover border border-white/15" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white font-semibold">
              {activeBoard.groupName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-white">{activeBoard.groupName}</h1>
            <p className="text-sm text-white/60">Tablica grupy</p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Informacje o podróży</h2>
          {canEditInfo && (
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-indigo-500/80 hover:bg-indigo-500 text-white text-sm"
              onClick={handleSaveInfo}
              disabled={savingInfo}
            >
              {savingInfo ? 'Zapisywanie...' : 'Zapisz'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm text-white/80">
            Lokalizacja
            <input
              className="mt-1 w-full px-3 py-2 rounded-lg bg-white/6 border border-white/10 text-white text-sm"
              value={travelForm.location}
              disabled={!canEditInfo}
              onChange={(e) => setTravelForm((prev) => ({ ...prev, location: e.target.value }))}
            />
          </label>

          <label className="text-sm text-white/80">
            Budżet
            <input
              className="mt-1 w-full px-3 py-2 rounded-lg bg-white/6 border border-white/10 text-white text-sm"
              value={travelForm.budget}
              disabled={!canEditInfo}
              onChange={(e) => setTravelForm((prev) => ({ ...prev, budget: e.target.value }))}
              inputMode="decimal"
            />
          </label>

          <label className="text-sm text-white/80">
            Data startu
            <input
              type="date"
              className="mt-1 w-full px-3 py-2 rounded-lg bg-white/6 border border-white/10 text-white text-sm"
              value={travelForm.startDate}
              disabled={!canEditInfo}
              onChange={(e) => setTravelForm((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </label>

          <label className="text-sm text-white/80">
            Data końca
            <input
              type="date"
              className="mt-1 w-full px-3 py-2 rounded-lg bg-white/6 border border-white/10 text-white text-sm"
              value={travelForm.endDate}
              disabled={!canEditInfo}
              onChange={(e) => setTravelForm((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </label>
        </div>

        <label className="text-sm text-white/80 block">
          Opis
          <textarea
            className="mt-1 w-full min-h-[80px] px-3 py-2 rounded-lg bg-white/6 border border-white/10 text-white text-sm"
            value={travelForm.description}
            disabled={!canEditInfo}
            onChange={(e) => setTravelForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </label>

        <label className="text-sm text-white/80 block">
          Checklista (pozycja w nowej linii)
          <textarea
            className="mt-1 w-full min-h-[100px] px-3 py-2 rounded-lg bg-white/6 border border-white/10 text-white text-sm"
            value={travelForm.checklistText}
            disabled={!canEditInfo}
            onChange={(e) => setTravelForm((prev) => ({ ...prev, checklistText: e.target.value }))}
          />
        </label>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-3">
        <h2 className="text-lg font-semibold text-white">Dodaj post</h2>
        <textarea
          value={postContent}
          onChange={(e) => setPostContent(e.target.value)}
          placeholder="Napisz aktualizację dla grupy..."
          className="w-full min-h-[100px] px-3 py-2 rounded-lg bg-white/6 border border-white/10 text-white text-sm"
        />
        <div className="flex justify-end">
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-indigo-500/80 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
            disabled={!postContent.trim() || posting}
            onClick={async () => {
              if (posting) return;
              setPosting(true);
              const controller = registerController();
              try {
                await createPost(activeBoard.groupId, postContent, { signal: controller.signal });
                setPostContent('');
              } finally {
                releaseController(controller);
                setPosting(false);
              }
            }}
          >
            {posting ? 'Dodawanie...' : 'Dodaj post'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Timeline</h2>
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2">
            <div className="text-sm text-red-300">{error}</div>
            <button
              type="button"
              className="px-2 py-1 rounded bg-white/10 text-white text-xs hover:bg-white/20"
              onClick={() => {
                void loadBoard(groupId);
                void loadPosts(groupId, { cursor: null, append: false });
              }}
            >
              Retry
            </button>
          </div>
        )}
        {posts.length === 0 ? (
          <div className="text-sm text-white/60">Brak postów w tej tablicy.</div>
        ) : (
          <div className="space-y-4">
            {posts.map((post: BoardPost) => {
              const canDeletePost = post.authorId === currentUserId || activeBoard.ownerId === currentUserId;
              return (
                <article key={post.id} className="rounded-xl border border-white/10 bg-white/6 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {post.authorAvatarUrl ? (
                        <img src={post.authorAvatarUrl} alt={post.authorName} className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white text-xs">
                          {post.authorName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm text-white font-medium">{post.authorName}</div>
                        <div className="text-xs text-white/50">{formatDate(post.createdAt)}</div>
                      </div>
                    </div>
                    {canDeletePost && (
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-200 hover:bg-red-500/30"
                        onClick={() => void deletePost(post.id)}
                      >
                        Usuń
                      </button>
                    )}
                  </div>

                  <p className="mt-3 text-sm text-white/90 whitespace-pre-wrap">{post.content}</p>

                  <div className="mt-4 space-y-2">
                    <div className="text-xs text-white/60">Komentarze ({post.comments.length})</div>
                    {post.comments.map((comment: BoardComment) => {
                      const canDeleteComment = comment.authorId === currentUserId || activeBoard.ownerId === currentUserId;
                      return (
                        <div key={comment.id} className="rounded-lg bg-white/5 border border-white/10 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs text-white/70">
                              <span className="font-medium text-white/90">{comment.authorName}</span> · {formatDate(comment.createdAt)}
                            </div>
                            {canDeleteComment && (
                              <button
                                type="button"
                                className="text-[11px] px-2 py-1 rounded bg-red-500/20 text-red-200 hover:bg-red-500/30"
                                onClick={() => void deleteComment(comment.id)}
                              >
                                Usuń
                              </button>
                            )}
                          </div>
                          <div className="text-sm text-white/90 mt-1 whitespace-pre-wrap">{comment.content}</div>
                        </div>
                      );
                    })}

                    <div className="flex gap-2 pt-1">
                      <input
                        value={commentDrafts[post.id] ?? ''}
                        onChange={(e) =>
                          setCommentDrafts((prev) => ({
                            ...prev,
                            [post.id]: e.target.value,
                          }))
                        }
                        placeholder="Dodaj komentarz..."
                        className="flex-1 px-3 py-2 rounded-lg bg-white/6 border border-white/10 text-white text-sm"
                      />
                      <button
                        type="button"
                        className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm disabled:opacity-50"
                        disabled={!String(commentDrafts[post.id] ?? '').trim() || Boolean(commentSubmitting[post.id])}
                        onClick={async () => {
                          if (commentSubmitting[post.id]) return;
                          setCommentSubmitting((prev) => ({ ...prev, [post.id]: true }));
                          const controller = registerController();
                          const value = String(commentDrafts[post.id] ?? '');
                          try {
                            await createComment(post.id, value, { signal: controller.signal });
                            setCommentDrafts((prev) => ({ ...prev, [post.id]: '' }));
                          } finally {
                            releaseController(controller);
                            setCommentSubmitting((prev) => ({ ...prev, [post.id]: false }));
                          }
                        }}
                      >
                        {commentSubmitting[post.id] ? 'Trwa...' : 'Dodaj'}
                      </button>
                    </div>

                    {post.hasMoreComments && (
                      <div className="pt-1">
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded bg-white/10 text-white/90 hover:bg-white/20"
                          onClick={() => void loadMoreComments(post.id)}
                        >
                          Pokaż więcej komentarzy
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}

            {hasMorePosts && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm disabled:opacity-50"
                  disabled={loadingMorePosts || !postsNextCursor}
                  onClick={() => void loadMorePosts(groupId)}
                >
                  {loadingMorePosts ? 'Ładowanie...' : 'Pokaż więcej postów'}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
