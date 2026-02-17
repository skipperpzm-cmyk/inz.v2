"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabaseClient";
import { CheckIcon, TrashIcon } from "@heroicons/react/24/outline";
import Tooltip from "../Tooltip";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, any>;
  readAt: string | null;
  createdAt: string | null;
  actor: {
    id: string;
    username: string | null;
    fullName: string | null;
    publicId: string | null;
    avatarUrl: string | null;
  } | null;
};

type NotificationResponse = {
  unreadCount: number;
  items: NotificationItem[];
};

export default function NotificationsPageClient() {
  const EXIT_ANIMATION_MS = 240;
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exitingIds, setExitingIds] = useState<string[]>([]);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications?limit=100", { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error("Nie udało się pobrać powiadomień");
      const data = (await res.json()) as NotificationResponse;
      const nextItems = Array.isArray(data?.items) ? data.items : [];
      setItems(nextItems);
      setUnreadCount(Number(data?.unreadCount ?? 0));
      setSelectedIds((prev) => prev.filter((id) => nextItems.some((item) => item.id === id)));
    } catch (err) {
      if (err instanceof Error && /aborted|ECONNRESET/i.test(err.message)) {
        return;
      }
      setError(err instanceof Error ? err.message : "Nie udało się pobrać powiadomień");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/user/me', { credentials: 'include', cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;
        const id = typeof payload?.id === 'string' ? payload.id : '';
        setCurrentUserId(id || null);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    const supabase = getBrowserSupabase();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const refreshRealtimeToken = async () => {
      try {
        const tokenRes = await fetch('/api/supabase/realtime-token', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!tokenRes.ok || cancelled) return false;
        const tokenJson = await tokenRes.json().catch(() => ({}));
        if (cancelled) return false;
        if (typeof tokenJson?.token === 'string') {
          supabase.realtime.setAuth(tokenJson.token);
          return true;
        }
      } catch {
        // ignore
      }
      return false;
    };

    (async () => {
      const authed = await refreshRealtimeToken();
      if (!authed || cancelled) return;

      channel = supabase
        .channel(`notifications:page:${currentUserId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${currentUserId}`,
          },
          () => {
            void load();
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUserId, load]);

  const markAllRead = useCallback(async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await load();
    } catch {
      // no-op
    }
  }, [load]);

  const deleteNotifications = useCallback(async (ids: string[]) => {
    const validIds = ids.map((id) => String(id).trim()).filter(Boolean);
    if (validIds.length === 0 || deleteBusy) return;

    setDeleteBusy(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: validIds }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Nie udało się usunąć powiadomień');
      }

      setExitingIds((prev) => Array.from(new Set([...prev, ...validIds])));
      await new Promise((resolve) => setTimeout(resolve, EXIT_ANIMATION_MS));

      setItems((prev) => prev.filter((item) => !validIds.includes(item.id)));
      setSelectedIds((prev) => prev.filter((id) => !validIds.includes(id)));
      setExitingIds((prev) => prev.filter((id) => !validIds.includes(id)));
      await load();
    } catch (err) {
      setExitingIds((prev) => prev.filter((id) => !validIds.includes(id)));
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć powiadomień');
    } finally {
      setDeleteBusy(false);
    }
  }, [EXIT_ANIMATION_MS, deleteBusy, load]);

  const getInviteId = useCallback((item: NotificationItem) => {
    if (item.type === 'board_invite') {
      return String(item.payload?.inviteId ?? item.payload?.boardId ?? item.entityId ?? '');
    }
    return String(item.payload?.inviteId ?? item.entityId ?? "");
  }, []);

  const isInviteItem = useCallback((item: NotificationItem) => {
    if (item.type !== "friend_invite" && item.type !== "group_invite" && item.type !== "board_invite") {
      return false;
    }
    return getInviteId(item).length > 0;
  }, [getInviteId]);

  const runInviteAction = useCallback(
    async (item: NotificationItem, action: "accept" | "reject") => {
      const inviteId = getInviteId(item);
      if (!inviteId) return;
      setActionBusyId(item.id);
      try {
        const base = item.type === "group_invite"
          ? "/api/groups/invites"
          : item.type === "board_invite"
            ? "/api/boards/invites"
            : "/api/friend-invites";
        const res = await fetch(`${base}/${encodeURIComponent(inviteId)}/${action}`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          const errorText = typeof json?.error === 'string' ? json.error : '';
          const isExpired = res.status === 404 || /wygas|expired/i.test(errorText);
          if (isExpired) {
            await deleteNotifications([item.id]);
            return;
          }
          throw new Error(errorText || "Operacja nie powiodła się");
        }

        await fetch('/api/notifications', {
          method: 'DELETE',
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [item.id] }),
        });

        setExitingIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
        await new Promise((resolve) => setTimeout(resolve, EXIT_ANIMATION_MS));
        setItems((prev) => prev.filter((row) => row.id !== item.id));
        setSelectedIds((prev) => prev.filter((id) => id !== item.id));
        setExitingIds((prev) => prev.filter((id) => id !== item.id));

        await load();
      } catch (err) {
        setExitingIds((prev) => prev.filter((id) => id !== item.id));
        if (err instanceof Error && /aborted|ECONNRESET/i.test(err.message)) {
          return;
        }
        setError(err instanceof Error ? err.message : "Operacja nie powiodła się");
      } finally {
        setActionBusyId(null);
      }
    },
    [EXIT_ANIMATION_MS, deleteNotifications, getInviteId, load]
  );

  const grouped = useMemo(() => {
    return items;
  }, [items]);

  const allVisibleIds = useMemo(() => grouped.map((item) => item.id), [grouped]);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.includes(id));
  const selectedCount = selectedIds.length;

  return (
    <div className="space-y-4 lg:pl-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Powiadomienia</h1>
          <p className="text-sm text-white/60 mt-1">Nieprzeczytane: {unreadCount}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex"
            onMouseEnter={(e) => {
              const rect = (e.currentTarget as HTMLSpanElement).getBoundingClientRect();
              setTooltip({ text: 'Oznacz wszystkie jako przeczytane', x: rect.left + rect.width / 2, y: rect.bottom + 6 });
            }}
            onMouseLeave={() => setTooltip(null)}
          >
            <button
              type="button"
              aria-label="Oznacz wszystkie jako przeczytane"
              className="app-icon-btn text-emerald-200 hover:text-emerald-100"
              onClick={() => void markAllRead()}
              onFocus={(e) => {
                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                setTooltip({ text: 'Oznacz wszystkie jako przeczytane', x: rect.left + rect.width / 2, y: rect.bottom + 6 });
              }}
              onBlur={() => setTooltip(null)}
              disabled={unreadCount === 0 || deleteBusy}
            >
              <CheckIcon className="h-4 w-4" aria-hidden />
            </button>
          </span>
          <span
            className="inline-flex"
            onMouseEnter={(e) => {
              const rect = (e.currentTarget as HTMLSpanElement).getBoundingClientRect();
              setTooltip({ text: 'Usuń zaznaczone', x: rect.left + rect.width / 2, y: rect.bottom + 6 });
            }}
            onMouseLeave={() => setTooltip(null)}
          >
            <button
              type="button"
              aria-label="Usuń zaznaczone powiadomienia"
              className="app-icon-btn text-rose-200 hover:text-rose-100"
              onClick={() => void deleteNotifications(selectedIds)}
              onFocus={(e) => {
                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                setTooltip({ text: 'Usuń zaznaczone', x: rect.left + rect.width / 2, y: rect.bottom + 6 });
              }}
              onBlur={() => setTooltip(null)}
              disabled={selectedCount === 0 || deleteBusy}
            >
              <TrashIcon className="h-4 w-4" aria-hidden />
            </button>
          </span>
        </div>
      </div>

      {grouped.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedIds(allVisibleIds);
              } else {
                setSelectedIds([]);
              }
            }}
            className="h-4 w-4 rounded border-white/30 bg-transparent text-emerald-500 focus:ring-emerald-500"
          />
          <span className="text-xs text-white/75">Zaznacz wszystkie</span>
          <span className="ml-auto text-xs text-white/50">Zaznaczone: {selectedCount}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-3">
          <span className="inline-block animate-spin rounded-full border-4 border-emerald-400 border-t-transparent w-8 h-8" aria-hidden />
          <span className="sr-only">Ładowanie powiadomień</span>
        </div>
      ) : error ? (
        <div className="text-sm text-red-300">{error}</div>
      ) : grouped.length === 0 ? (
        <div className="text-sm text-white/60">Brak powiadomień.</div>
      ) : (
        <div className="space-y-2">
          {grouped.map((item) => {
            const actorName = item.actor?.fullName || item.actor?.username || item.actor?.publicId || "Użytkownik";
            const pending = actionBusyId === item.id;
            const canAct = isInviteItem(item);

            return (
              <div
                key={item.id}
                className={`rounded-lg border px-3 py-3 ${item.readAt ? "border-white/10 bg-white/5" : "border-cyan-300/30 bg-cyan-500/10"} ${exitingIds.includes(item.id) ? 'animate-zoomOut pointer-events-none' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={(e) => {
                        setSelectedIds((prev) => {
                          if (e.target.checked) {
                            if (prev.includes(item.id)) return prev;
                            return [...prev, item.id];
                          }
                          return prev.filter((id) => id !== item.id);
                        });
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-white/30 bg-transparent text-emerald-500 focus:ring-emerald-500"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{item.title}</div>
                      <div className="text-xs text-white/60 mt-0.5">{item.message || ""}</div>
                      <div className="text-[11px] text-white/45 mt-1 truncate">{actorName}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Usuń powiadomienie"
                      disabled={deleteBusy}
                      onClick={() => void deleteNotifications([item.id])}
                      onMouseEnter={(e) => {
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        setTooltip({ text: 'Usuń powiadomienie', x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      onFocus={(e) => {
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        setTooltip({ text: 'Usuń powiadomienie', x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                      }}
                      onBlur={() => setTooltip(null)}
                      className="app-icon-btn text-rose-200 hover:text-rose-100"
                    >
                      <TrashIcon className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    {item.readAt ? (
                      <span className="text-[11px] text-white/40">Przeczytane</span>
                    ) : (
                      <span className="text-[11px] text-cyan-200">Nowe</span>
                    )}
                  </div>
                </div>

                {canAct && (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      className="app-text-btn-accept inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                      disabled={pending}
                      onClick={() => void runInviteAction(item, "accept")}
                    >
                      {pending ? "Przetwarzanie…" : "Akceptuj"}
                    </button>
                    <button
                      type="button"
                      className="app-text-btn-reject inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                      disabled={pending}
                      onClick={() => void runInviteAction(item, "reject")}
                    >
                      Odrzuć
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {tooltip && <Tooltip text={tooltip.text} x={tooltip.x} y={tooltip.y} />}
    </div>
  );
}
