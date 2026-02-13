"use client";
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { getBrowserSupabase } from '../lib/supabaseClient';

/**
 * State machine for friend relations
 */
export enum FriendRelationState {
  NONE = 'NONE',
  OUTGOING_PENDING = 'OUTGOING_PENDING',
  INCOMING_PENDING = 'INCOMING_PENDING',
  FRIENDS = 'FRIENDS',
  REJECTED = 'REJECTED',
}

export type FriendRelation = {
  userId: string;
  state: FriendRelationState;
};

/**
 * Resolves the relation state between current user and target user.
 */
function resolveRelationState(
  currentUserId: string | null,
  targetUserId: string,
  friends: Friend[],
  pendingInvites: FriendInvite[],
  sentInvites: FriendInvite[],
): FriendRelationState {
  if (!currentUserId || currentUserId === targetUserId) return FriendRelationState.NONE;
  // FRIENDS
  if (friends.some(f => f.id === targetUserId)) return FriendRelationState.FRIENDS;
  // OUTGOING_PENDING
  if (sentInvites.some(inv => inv.to_user_id === targetUserId)) return FriendRelationState.OUTGOING_PENDING;
  // INCOMING_PENDING
  if (pendingInvites.some(inv => inv.from_user_id === targetUserId)) return FriendRelationState.INCOMING_PENDING;
  // REJECTED (optional, not tracked in API, placeholder for future)
  return FriendRelationState.NONE;
}

export type Friend = {
  id: string;
  name: string;
  publicId: string | null;
  avatarUrl?: string | null;
  online?: boolean;
};

export type FriendInvite = {
  id: string;
  from_user_id: string;
  from_name?: string | null;
  from_public_id?: string | null;
  from_avatar_url?: string | null;
  to_user_id?: string;
  to_name?: string | null;
  to_public_id?: string | null;
  to_avatar_url?: string | null;
  created_at?: string | null;
  status?: string | null;
};

type FriendContextType = {
  currentUserId: string | null;
  friends: Friend[];
  pendingInvites: FriendInvite[];
  sentInvites: FriendInvite[];
  unreadInviteCount: number;
  friendsLoading: boolean;
  invitesLoading: boolean;
  friendsError: string | null;
  invitesError: string | null;
  refreshFriends: () => Promise<void>;
  refreshInvites: () => Promise<void>;
  sendInvite: (toUserId: string) => Promise<FriendInvite | null>;
  acceptInvite: (inviteId: string) => Promise<void>;
  rejectInvite: (inviteId: string) => Promise<void>;
  cancelInvite: (inviteId: string) => Promise<void>;
  markInvitesRead: (inviteIds?: string[]) => void;
  getRelationState: (userId: string) => FriendRelationState;
  unfriend: (userId: string) => Promise<boolean>;
  logoutAndRefresh: () => Promise<void>;
};

const FriendContext = createContext<FriendContextType | undefined>(undefined);

export function FriendProvider({ children }: { children: ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // Wymuszaj refreshInvites po każdej zmianie currentUserId
  useEffect(() => {
    if (!currentUserId) return;
    refreshInvites();
  }, [currentUserId]);

  // Realtime subscription for user_friends table
  useEffect(() => {
    if (!currentUserId) return;
    const supabase = getBrowserSupabase();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        const res = await fetch('/api/supabase/realtime-token', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (typeof data?.token === 'string') {
          supabase.realtime.setAuth(data.token);
        } else {
          return;
        }
      } catch {
        return;
      }

      if (cancelled) return;
      // Listen for any changes where the current user is involved
      channel = supabase.channel(`user-friends:${currentUserId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_friends',
        }, (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('[Realtime user_friends] event:', payload);
          refreshFriends();
        })
        .subscribe((status: any, err: any) => {
          console.log('[Realtime user_friends] channel status:', status, err);
        });
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUserId]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingInvites, setPendingInvites] = useState<FriendInvite[]>([]);
  const [sentInvites, setSentInvites] = useState<FriendInvite[]>([]);
  const [readInviteIds, setReadInviteIds] = useState<Set<string>>(new Set());

  // Heartbeat: co 30 sekund wysyłaj status online
  useEffect(() => {
    if (!currentUserId) return;
    let interval: NodeJS.Timeout | null = null;
    const sendHeartbeat = async () => {
      try {
        await fetch('/api/user/heartbeat', { method: 'POST', credentials: 'include' });
      } catch {}
    };
    interval = setInterval(sendHeartbeat, 30000); // 30s
    sendHeartbeat(); // natychmiast po mount
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentUserId]);

  // beforeunload: ustaw online=false przy zamknięciu karty (bez kasowania sesji)
  useEffect(() => {
    if (!currentUserId) return;
    const onUnload = () => {
      fetch('/api/user/offline', { method: 'POST', keepalive: true });
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [currentUserId]);

  // Odświeżenie UI po logout (np. router push lub refreshFriends)
  const logoutAndRefresh = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    await refreshFriends();
  };
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  /**
   * Toast state and handler for global notifications.
   */
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);
  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(null), 2500);
  };

  // ...existing code...

  // Centralized relation state getter
  const getRelationState = (userId: string): FriendRelationState => {
    return resolveRelationState(currentUserId, userId, friends, pendingInvites, sentInvites);
  };

  const unfriend = async (userId: string): Promise<boolean> => {
    const state = getRelationState(userId);
    if (state !== FriendRelationState.FRIENDS) return false;

    const snapshot = friends;
    // Optimistic update: remove friend locally for current user
    setFriends(prev => prev.filter(f => f.id !== userId));

    try {
      // API endpoint should handle removal for both users (A and B)
      const res = await fetch(`/api/friends/${userId}/remove`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Błąd usuwania znajomego');
      // Realtime: refresh friends for both users (Supabase channel triggers refresh)
      await refreshFriends();
      showToast('Znajomy został usunięty');
      return true;
    } catch (err) {
      // Rollback optimistic update on error
      setFriends(snapshot);
      return false;
    }
  };

  /**
   * Subscribes to realtime changes in profiles (online status).
   */
  useEffect(() => {
    if (!currentUserId) return;
    const supabase = getBrowserSupabase();
    const channel = supabase.channel('profiles-online')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
      }, async (payload) => {
        const nextId = payload?.new?.id as string | undefined;
        if (!nextId) return;
        const nextOnline = Boolean(payload?.new?.online);
        setFriends((prev) => {
          let changed = false;
          const next = prev.map((friend) => {
            if (friend.id !== nextId) return friend;
            if (friend.online === nextOnline) return friend;
            changed = true;
            return { ...friend, online: nextOnline };
          });
          return changed ? next : prev;
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);
  type FriendInviteRow = {
    id: string;
    from_user_id: string;
    to_user_id: string;
    status?: string | null;
    created_at?: string | null;
  };

  const isPendingInvite = (row: FriendInviteRow) => (row.status ? row.status === 'pending' : true);

  const upsertInvite = (list: FriendInvite[], invite: FriendInvite) => {
    const exists = list.some((item) => item.id === invite.id);
    if (exists) return list;
    return [invite, ...list];
  };

  const removeInvite = (list: FriendInvite[], inviteId: string) =>
    list.filter((item) => item.id !== inviteId);

  const handleInviteRealtime = (payload: RealtimePostgresChangesPayload<FriendInviteRow>) => {
    const next = payload.new as FriendInviteRow | null;
    const prev = payload.old as FriendInviteRow | null;

    if (payload.eventType === 'DELETE' && prev?.id) {
      setPendingInvites((list) => removeInvite(list, prev.id));
      setSentInvites((list) => removeInvite(list, prev.id));
      setReadInviteIds((ids) => {
        if (!ids.has(prev.id)) return ids;
        const nextIds = new Set(ids);
        nextIds.delete(prev.id);
        return nextIds;
      });
      return;
    }

    if (!next?.id) return;
    if (!isPendingInvite(next)) {
      setPendingInvites((list) => removeInvite(list, next.id));
      setSentInvites((list) => removeInvite(list, next.id));
      return;
    }

    // Po INSERT/UPDATE odśwież zaproszenia, aby pobrać pełne dane (nazwy, public_id)
    refreshInvites();
  };

  // Realtime subscription for friend_invites table
  useEffect(() => {
    if (!currentUserId) return;
    const supabase = getBrowserSupabase();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let refreshTimer: NodeJS.Timeout | null = null;

    const refreshRealtimeToken = async () => {
      try {
        const res = await fetch('/api/supabase/realtime-token', { credentials: 'include' });
        if (!res.ok) return false;
        const data = await res.json();
        if (cancelled) return false;
        if (typeof data?.token === 'string') {
          supabase.realtime.setAuth(data.token);
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

      channel = supabase.channel(`friend-invites:${currentUserId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'friend_invites',
          filter: `to_user_id=eq.${currentUserId}`,
        }, (payload: RealtimePostgresChangesPayload<FriendInviteRow>) => {
          handleInviteRealtime(payload);
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'friend_invites',
          filter: `from_user_id=eq.${currentUserId}`,
        }, (payload: RealtimePostgresChangesPayload<FriendInviteRow>) => {
          handleInviteRealtime(payload);
        })
        .subscribe();

      // Refresh JWT before it expires to keep realtime subscriptions alive.
      refreshTimer = setInterval(() => {
        void refreshRealtimeToken();
      }, 45 * 60 * 1000);
    })();

    return () => {
      cancelled = true;
      if (refreshTimer) clearInterval(refreshTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const refreshFriends = async () => {
    setFriendsLoading(true);
    setFriendsError(null);
    try {
      const res = await fetch('/api/friends', { credentials: 'include' });
      if (!res.ok) throw new Error('Błąd pobierania znajomych');
      const data = await res.json();
      // Mapuj dane z API na Friend z publicId
      const mapped = Array.isArray(data)
        ? data.map((f: any) => ({
            id: f.id,
            name: f.name,
            publicId: typeof f.public_id === 'string' ? f.public_id : null,
            avatarUrl: f.avatar_url ?? null,
            online: f.online ?? false,
          }))
        : [];
      setFriends(mapped);
    } catch {
      setFriends([]);
      setFriendsError('Błąd pobierania znajomych');
    } finally {
      setFriendsLoading(false);
    }
  };

  const refreshInvites = async () => {
    if (!currentUserId) return;
    setInvitesLoading(true);
    setInvitesError(null);
    try {
      const res = await fetch('/api/friend-invites', { credentials: 'include' });
      if (!res.ok) throw new Error('Błąd pobierania zaproszeń');
      const data = await res.json();
      const invites = Array.isArray(data) ? (data as FriendInvite[]) : [];
      const pending = invites.filter((invite) => invite.to_user_id === currentUserId);
      const sent = invites.filter((invite) => invite.from_user_id === currentUserId);
      setPendingInvites(pending);
      setSentInvites(sent);
      setReadInviteIds((prev) => {
        const pendingIds = new Set(pending.map((invite) => invite.id));
        const next = new Set<string>();
        prev.forEach((id) => {
          if (pendingIds.has(id)) next.add(id);
        });
        return next;
      });
    } catch (err) {
      setPendingInvites([]);
      setSentInvites([]);
      setInvitesError('Błąd pobierania zaproszeń');
    } finally {
      setInvitesLoading(false);
    }
  };

  const sendInvite = async (toUserId: string) => {
    // Walidacja state machine
    const state = getRelationState(toUserId);
    if (state !== FriendRelationState.NONE) {
      throw new Error('Nie można wysłać zaproszenia: relacja nie jest NONE');
    }
    const res = await fetch('/api/friend-invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ toUserId }),
    });
    if (!res.ok) throw new Error('Błąd wysyłki zaproszenia');
    const created = (await res.json()) as FriendInvite | null;
    if (created) {
      setSentInvites((prev) => [created, ...prev]);
      // Optymistycznie odśwież friends
      await refreshFriends();
      // Odśwież zaproszenia, aby pobrać pełne dane (np. to_name)
      await refreshInvites();
    }
    return created ?? null;
  };

  const acceptInvite = async (inviteId: string) => {
    // Walidacja state machine
    const invite = pendingInvites.find(i => i.id === inviteId);
    if (!invite) throw new Error('Zaproszenie nie istnieje');
    const state = getRelationState(invite.from_user_id);
    if (state !== FriendRelationState.INCOMING_PENDING) {
      throw new Error('Nie można zaakceptować: relacja nie jest INCOMING_PENDING');
    }
    const res = await fetch(`/api/friend-invites/${inviteId}/accept`, { method: 'POST' });
    if (!res.ok) {
      await refreshInvites();
      throw new Error('Błąd akceptacji. Spróbuj ponownie lub odśwież stronę.');
    }
    setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
    setReadInviteIds((prev) => {
      if (!prev.has(inviteId)) return prev;
      const next = new Set(prev);
      next.delete(inviteId);
      return next;
    });
    await refreshFriends();
    await refreshInvites(); // Optymistycznie
  };

  const rejectInvite = async (inviteId: string) => {
    // Walidacja state machine
    const invite = pendingInvites.find(i => i.id === inviteId);
    if (!invite) throw new Error('Zaproszenie nie istnieje');
    const state = getRelationState(invite.from_user_id);
    if (state !== FriendRelationState.INCOMING_PENDING) {
      throw new Error('Nie można odrzucić: relacja nie jest INCOMING_PENDING');
    }
    const res = await fetch(`/api/friend-invites/${inviteId}/reject`, { method: 'POST' });
    if (!res.ok) throw new Error('Błąd odrzucenia');
    setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
    setReadInviteIds((prev) => {
      if (!prev.has(inviteId)) return prev;
      const next = new Set(prev);
      next.delete(inviteId);
      return next;
    });
    await refreshInvites(); // Optymistycznie
  };

  const cancelInvite = async (inviteId: string) => {
    const snapshot = sentInvites;
    setSentInvites((prev) => prev.filter((i) => i.id !== inviteId));
    try {
      const res = await fetch(`/api/friend-invites/${inviteId}/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error('Błąd usuwania zaproszenia');
      await refreshInvites();
    } catch (err) {
      setSentInvites(snapshot);
      throw err;
    }
  };

  const markInvitesRead = (inviteIds?: string[]) => {
    const ids = inviteIds ?? pendingInvites.map((invite) => invite.id);
    if (ids.length === 0) return;
    setReadInviteIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      ids.forEach((id) => {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  };

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const res = await fetch('/api/user/me', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data?.id === 'string') {
          setCurrentUserId(data.id);
          // Wymuś odświeżenie zaproszeń po zalogowaniu
          await refreshFriends();
          await refreshInvites();
        } else {
          setCurrentUserId(null);
        }
      } catch (err) {
        setCurrentUserId(null);
      }
    };
    loadCurrentUser();
  }, []);

  useEffect(() => {
    // Realtime subscription obsługuje aktualizacje, nie potrzebujemy pollingu
  }, [currentUserId]);

  return (
    <FriendContext.Provider
      value={{
        currentUserId,
        friends,
        pendingInvites,
        sentInvites,
        unreadInviteCount: pendingInvites.filter((invite) => !readInviteIds.has(invite.id)).length,
        friendsLoading,
        invitesLoading,
        friendsError,
        invitesError,
        refreshFriends,
        refreshInvites,
        sendInvite,
        acceptInvite,
        rejectInvite,
        cancelInvite,
        markInvitesRead,
        getRelationState,
        unfriend,
        logoutAndRefresh, // Dodaj do kontekstu
      }}
    >
      {children}
      {/* Global Toast Notification */}
      {toast && toast.visible && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[9999] bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm transition-all duration-300 animate-slidein">
          {toast.message}
        </div>
      )}
    </FriendContext.Provider>
  );
}

export function useFriendContext() {
  const ctx = useContext(FriendContext);
  if (!ctx) throw new Error('useFriendContext must be used within FriendProvider');
  return ctx;
}
