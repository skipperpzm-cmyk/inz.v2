"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../ui/button";
import { getBrowserSupabase } from "@/lib/supabaseClient";

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
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications?limit=100", { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error("Nie udało się pobrać powiadomień");
      const data = (await res.json()) as NotificationResponse;
      setItems(Array.isArray(data?.items) ? data.items : []);
      setUnreadCount(Number(data?.unreadCount ?? 0));
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
          throw new Error(json?.error || "Operacja nie powiodła się");
        }

        await fetch("/api/notifications", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [item.id] }),
        });

        await load();
      } catch (err) {
        if (err instanceof Error && /aborted|ECONNRESET/i.test(err.message)) {
          return;
        }
        setError(err instanceof Error ? err.message : "Operacja nie powiodła się");
      } finally {
        setActionBusyId(null);
      }
    },
    [getInviteId, load]
  );

  const grouped = useMemo(() => {
    return items;
  }, [items]);

  return (
    <div className="space-y-4 lg:pl-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Powiadomienia</h1>
          <p className="text-sm text-white/60 mt-1">Nieprzeczytane: {unreadCount}</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void markAllRead()} disabled={unreadCount === 0}>
          Oznacz wszystkie jako przeczytane
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-white/60">Ładowanie powiadomień…</div>
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
                className={`rounded-lg border px-3 py-3 ${item.readAt ? "border-white/10 bg-white/5" : "border-indigo-300/30 bg-indigo-500/10"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{item.title}</div>
                    <div className="text-xs text-white/60 mt-0.5">{item.message || ""}</div>
                    <div className="text-[11px] text-white/45 mt-1 truncate">{actorName}</div>
                  </div>
                  {item.readAt ? (
                    <span className="text-[11px] text-white/40">Przeczytane</span>
                  ) : (
                    <span className="text-[11px] text-indigo-200">Nowe</span>
                  )}
                </div>

                {canAct && (
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      className="app-text-btn-gradient"
                      disabled={pending}
                      onClick={() => void runInviteAction(item, "accept")}
                    >
                      {pending ? "Przetwarzanie…" : "Akceptuj"}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={pending}
                      onClick={() => void runInviteAction(item, "reject")}
                    >
                      Odrzuć
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
