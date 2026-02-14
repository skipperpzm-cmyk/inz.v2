"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getBrowserSupabase } from "../lib/supabaseClient";

export type GroupAction = "rename" | "invite" | "remove" | "leave" | "manage";

export type Group = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  slug?: string | null;
  description?: string | null;
  isPrivate: boolean;
  memberCount: number;
  role: "member" | "admin";
  createdBy?: string;
};

export type Member = {
  id: string;
  username?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  publicId?: string | null;
  role: "member" | "admin";
};

export type GroupInvite = {
  id: string;
  groupId: string;
  groupName: string;
  fromUserId: string;
  fromName?: string | null;
  fromPublicId?: string | null;
  fromAvatarUrl?: string | null;
  createdAt?: string | null;
};

type GroupContextValue = {
  currentUserId: string | null;
  groups: Group[];
  groupInvites: GroupInvite[];
  groupsLoading: boolean;
  invitesLoading: boolean;
  groupsError: string | null;
  invitesError: string | null;
  unreadInviteCount: number;
  unreadGroupInviteCount: number;
  unreadMessageCounts: Record<string, number>;
  isInviteUnread: (groupId: string) => boolean;
  markInvitesRead: (groupIds?: string[]) => void;
  markGroupInviteNotificationsRead: (inviteIds?: string[]) => void;
  markGroupMessagesRead: (groupIds?: string[]) => void;
  markAllNotificationsRead: () => void;
  refreshGroups: () => Promise<void>;
  refreshInvites: () => Promise<void>;
  createGroup: (name: string, friendIds?: string[]) => Promise<Group | null>;
  inviteToGroup: (groupId: string, userId: string) => Promise<void>;
  acceptInvite: (inviteId: string) => Promise<void>;
  rejectInvite: (inviteId: string) => Promise<void>;
  removeMember: (groupId: string, userId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  renameGroup: (groupId: string, name: string) => Promise<void>;
  updateGroupAvatar: (groupId: string, dataUrl: string) => Promise<string>;
  fetchMembers: (groupId: string) => Promise<Member[]>;
};

const GroupContext = createContext<GroupContextValue | null>(null);

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [unreadGroupIds, setUnreadGroupIds] = useState<Set<string>>(new Set());
  const [unreadGroupInviteIds, setUnreadGroupInviteIds] = useState<Set<string>>(new Set());
  const [unreadMessageCounts, setUnreadMessageCounts] = useState<Record<string, number>>({});
  const knownGroupIdsRef = useRef<Set<string>>(new Set());
  const knownInviteIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const updateUnreadGroups = useCallback((nextGroups: Group[]) => {
    const nextIds = new Set(nextGroups.map((g) => g.id));
    if (!initializedRef.current) {
      knownGroupIdsRef.current = nextIds;
      initializedRef.current = true;
      setUnreadGroupIds(new Set());
      return;
    }

    setUnreadGroupIds((prev) => {
      const next = new Set(prev);
      nextIds.forEach((id) => {
        if (!knownGroupIdsRef.current.has(id)) next.add(id);
      });
      next.forEach((id) => {
        if (!nextIds.has(id)) next.delete(id);
      });
      knownGroupIdsRef.current = nextIds;
      return next;
    });

    setUnreadMessageCounts((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        if (!nextIds.has(id)) delete next[id];
      });
      return next;
    });
  }, []);

  const refreshGroups = useCallback(async () => {
    setGroupsLoading(true);
    setGroupsError(null);
    try {
      const res = await fetch("/api/groups/list", { credentials: "include" });
      if (!res.ok) throw new Error("Błąd pobierania grup");
      const data = await res.json();
      const next = Array.isArray(data) ? (data as Group[]) : [];
      setGroups(next);
      updateUnreadGroups(next);
    } catch (err) {
      setGroups([]);
      setGroupsError(err instanceof Error ? err.message : "Błąd pobierania grup");
    } finally {
      setGroupsLoading(false);
    }
  }, [updateUnreadGroups]);

  const refreshInvites = useCallback(async () => {
    setInvitesLoading(true);
    setInvitesError(null);
    try {
      const res = await fetch("/api/groups/invites", { credentials: "include" });
      if (!res.ok) throw new Error("Błąd pobierania zaproszeń do grup");
      const data = await res.json();
      const next = Array.isArray(data) ? (data as GroupInvite[]) : [];
      setGroupInvites(next);
      const nextIds = new Set(next.map((i) => i.id));
      if (knownInviteIdsRef.current.size === 0) {
        knownInviteIdsRef.current = nextIds;
        setUnreadGroupInviteIds(new Set(nextIds));
      } else {
        setUnreadGroupInviteIds((prev) => {
          const updated = new Set(prev);
          nextIds.forEach((id) => {
            if (!knownInviteIdsRef.current.has(id)) updated.add(id);
          });
          updated.forEach((id) => {
            if (!nextIds.has(id)) updated.delete(id);
          });
          knownInviteIdsRef.current = nextIds;
          return updated;
        });
      }
    } catch (err) {
      setGroupInvites([]);
      setInvitesError(err instanceof Error ? err.message : "Błąd pobierania zaproszeń do grup");
    } finally {
      setInvitesLoading(false);
    }
  }, []);

  const markInvitesRead = useCallback((groupIds?: string[]) => {
    const ids = groupIds ?? Array.from(unreadGroupIds);
    if (ids.length === 0) return;
    setUnreadGroupIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, [unreadGroupIds]);

  const markGroupInviteNotificationsRead = useCallback((inviteIds?: string[]) => {
    const ids = inviteIds ?? Array.from(unreadGroupInviteIds);
    if (ids.length === 0) return;
    setUnreadGroupInviteIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, [unreadGroupInviteIds]);

  const markGroupMessagesRead = useCallback((groupIds?: string[]) => {
    setUnreadMessageCounts((prev) => {
      if (!groupIds || groupIds.length === 0) {
        return {};
      }
      const next = { ...prev };
      groupIds.forEach((id) => {
        delete next[id];
      });
      return next;
    });
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setUnreadGroupIds(new Set());
    setUnreadGroupInviteIds(new Set());
    setUnreadMessageCounts({});
  }, []);

  const inviteToGroup = useCallback(async (groupId: string, userId: string) => {
    const trimmed = userId.trim();
    if (!trimmed) throw new Error("Brak ID użytkownika");
    const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: [trimmed] }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || "Nie udało się zaprosić użytkownika");
  }, []);

  const createGroup = useCallback(async (name: string, friendIds: string[] = []) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Nazwa jest wymagana");

    const tempId = `temp-${Date.now()}`;
    const optimistic: Group = {
      id: tempId,
      name: trimmed,
        avatarUrl: null,
      slug: null,
      description: null,
      isPrivate: true,
      memberCount: 1,
      role: "admin",
    };
    setGroups((prev) => [optimistic, ...prev]);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, description: null, is_private: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) throw new Error(json.error || "Nie udało się utworzyć grupy");
      const group = json.group as any;
      if (!group?.id) throw new Error("Nie udało się utworzyć grupy");

      const created: Group = {
        id: String(group.id),
        name: String(group.name ?? trimmed),
        avatarUrl: group.avatar_url ?? null,
        slug: group.slug ?? null,
        description: group.description ?? null,
        isPrivate: Boolean(group.is_private),
        memberCount: 1,
        role: "admin",
      };

      setGroups((prev) => prev.map((g) => (g.id === tempId ? created : g)));
      knownGroupIdsRef.current.add(created.id);
      setUnreadGroupIds((prev) => {
        const next = new Set(prev);
        next.delete(created.id);
        return next;
      });

      for (const friendId of friendIds) {
        if (!friendId) continue;
        await inviteToGroup(created.id, friendId);
      }
      return created;
    } catch (err) {
      setGroups((prev) => prev.filter((g) => g.id !== tempId));
      throw err;
    }
  }, [inviteToGroup]);

  const acceptInvite = useCallback(async (inviteId: string) => {
    const res = await fetch(`/api/groups/invites/${encodeURIComponent(inviteId)}/accept`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || "Nie udało się zaakceptować zaproszenia");

    const groupId = String(json.groupId ?? "");
    const groupName = String(json.groupName ?? "");
    if (groupId) {
      setGroups((prev) => {
        if (prev.some((g) => g.id === groupId)) return prev;
        const optimistic: Group = {
          id: groupId,
          name: groupName || "Nowa grupa",
          avatarUrl: null,
          slug: null,
          description: null,
          isPrivate: true,
          memberCount: 1,
          role: "member",
        };
        return [optimistic, ...prev];
      });
      knownGroupIdsRef.current.add(groupId);
    }

    setGroupInvites((prev) => prev.filter((i) => i.id !== inviteId));
    setUnreadGroupInviteIds((prev) => {
      const next = new Set(prev);
      next.delete(inviteId);
      return next;
    });
    void refreshGroups();
  }, [refreshGroups]);

  const rejectInvite = useCallback(async (inviteId: string) => {
    const res = await fetch(`/api/groups/invites/${encodeURIComponent(inviteId)}/reject`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || "Nie udało się odrzucić zaproszenia");
    setGroupInvites((prev) => prev.filter((i) => i.id !== inviteId));
    setUnreadGroupInviteIds((prev) => {
      const next = new Set(prev);
      next.delete(inviteId);
      return next;
    });
  }, []);

  const removeMember = useCallback(async (groupId: string, userId: string) => {
    const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/members/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || "Nie udało się usunąć członka");
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, memberCount: Math.max(0, g.memberCount - 1) } : g))
    );
  }, []);

  const leaveGroup = useCallback(async (groupId: string) => {
    const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/leave`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || "Nie udało się opuścić grupy");
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setUnreadGroupIds((prev) => {
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    });
    setUnreadMessageCounts((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  }, []);

  const renameGroup = useCallback(async (groupId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Nazwa jest wymagana");
    const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || "Nie udało się zmienić nazwy");
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, name: trimmed } : g)));
  }, []);

  const updateGroupAvatar = useCallback(async (groupId: string, dataUrl: string) => {
    if (!dataUrl) throw new Error("Brak obrazu");
    const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/avatar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || "Nie udało się zapisać awatara");
    const avatarUrl = String(json.avatarUrl ?? "");
    if (!avatarUrl) throw new Error("Brak awatara w odpowiedzi");
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, avatarUrl } : g)));
    return avatarUrl;
  }, []);

  const fetchMembers = useCallback(async (groupId: string) => {
    const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/members`, { credentials: "include" });
    if (!res.ok) throw new Error("Nie udało się pobrać członków");
    const data = await res.json();
    return Array.isArray(data) ? (data as Member[]) : [];
  }, []);

  const isInviteUnread = useCallback((groupId: string) => unreadGroupIds.has(groupId), [unreadGroupIds]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const res = await fetch("/api/user/me", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data?.id === "string") {
          setCurrentUserId(data.id);
          await refreshGroups();
          await refreshInvites();
        } else {
          setCurrentUserId(null);
        }
      } catch {
        setCurrentUserId(null);
      }
    };
    loadCurrentUser();
  }, [refreshGroups, refreshInvites]);

  useEffect(() => {
    if (!currentUserId) return;
    const supabase = getBrowserSupabase();
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;

    const refreshRealtimeToken = async () => {
      try {
        const res = await fetch("/api/supabase/realtime-token", { credentials: "include" });
        if (!res.ok) return false;
        const data = await res.json();
        if (cancelled) return false;
        if (typeof data?.token === "string") {
          supabase.realtime.setAuth(data.token);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const authed = await refreshRealtimeToken();
      if (!authed || cancelled) return;

      channel = supabase
        .channel(`group-members:${currentUserId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "group_members", filter: `user_id=eq.${currentUserId}` },
          () => {
            refreshGroups();
          }
        )
        .subscribe();

      refreshTimer = setInterval(() => {
        void refreshRealtimeToken();
      }, 45 * 60 * 1000);
    })();

    return () => {
      cancelled = true;
      if (refreshTimer) clearInterval(refreshTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUserId, refreshGroups]);

  useEffect(() => {
    if (!currentUserId) return;
    const supabase = getBrowserSupabase();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const refreshRealtimeToken = async () => {
      try {
        const res = await fetch("/api/supabase/realtime-token", { credentials: "include" });
        if (!res.ok) return false;
        const data = await res.json();
        if (cancelled) return false;
        if (typeof data?.token === "string") {
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
      channel = supabase
        .channel(`group-invites:${currentUserId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "group_invites", filter: `to_user_id=eq.${currentUserId}` },
          () => {
            refreshInvites();
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUserId, refreshInvites]);

  useEffect(() => {
    if (!currentUserId || groups.length === 0) return;
    const supabase = getBrowserSupabase();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const refreshRealtimeToken = async () => {
      try {
        const res = await fetch("/api/supabase/realtime-token", { credentials: "include" });
        if (!res.ok) return false;
        const data = await res.json();
        if (cancelled) return false;
        if (typeof data?.token === "string") {
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
      const ids = groups.map((g) => g.id).join(",");
      channel = supabase
        .channel(`groups:${currentUserId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "groups", filter: `id=in.(${ids})` },
          () => {
            refreshGroups();
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUserId, groups, refreshGroups]);

  useEffect(() => {
    if (!currentUserId || groups.length === 0) return;
    const supabase = getBrowserSupabase();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const refreshRealtimeToken = async () => {
      try {
        const res = await fetch("/api/supabase/realtime-token", { credentials: "include" });
        if (!res.ok) return false;
        const data = await res.json();
        if (cancelled) return false;
        if (typeof data?.token === "string") {
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
      const ids = groups.map((g) => g.id).join(",");
      channel = supabase
        .channel(`group-members:${currentUserId}:all`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "group_members", filter: `group_id=in.(${ids})` },
          () => {
            refreshGroups();
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUserId, groups, refreshGroups]);

  useEffect(() => {
    if (!currentUserId || groups.length === 0) return;
    const supabase = getBrowserSupabase();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const refreshRealtimeToken = async () => {
      try {
        const res = await fetch("/api/supabase/realtime-token", { credentials: "include" });
        if (!res.ok) return false;
        const data = await res.json();
        if (cancelled) return false;
        if (typeof data?.token === "string") {
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
      const ids = groups.map((g) => g.id).join(",");
      channel = supabase
        .channel(`group-messages:${currentUserId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages", filter: `group_id=in.(${ids})` },
          (payload: RealtimePostgresChangesPayload<{ id: string; group_id: string; sender_id: string }>) => {
            const next = payload.new as any;
            if (!next?.group_id) return;
            if (String(next.sender_id) === currentUserId) return;
            setUnreadMessageCounts((prev) => ({
              ...prev,
              [String(next.group_id)]: (prev[String(next.group_id)] || 0) + 1,
            }));
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUserId, groups]);

  const value = useMemo(
    () => ({
      currentUserId,
      groups,
      groupInvites,
      groupsLoading,
      invitesLoading,
      groupsError,
      invitesError,
      unreadInviteCount: unreadGroupIds.size,
      unreadGroupInviteCount: unreadGroupInviteIds.size,
      unreadMessageCounts,
      isInviteUnread,
      markInvitesRead,
      markGroupInviteNotificationsRead,
      markGroupMessagesRead,
      markAllNotificationsRead,
      refreshGroups,
      refreshInvites,
      createGroup,
      inviteToGroup,
      acceptInvite,
      rejectInvite,
      removeMember,
      leaveGroup,
      renameGroup,
      updateGroupAvatar,
      fetchMembers,
    }),
    [
      currentUserId,
      groups,
      groupInvites,
      groupsLoading,
      invitesLoading,
      groupsError,
      invitesError,
      unreadGroupIds,
      unreadGroupInviteIds,
      unreadMessageCounts,
      isInviteUnread,
      markInvitesRead,
      markGroupInviteNotificationsRead,
      markGroupMessagesRead,
      markAllNotificationsRead,
      refreshGroups,
      refreshInvites,
      createGroup,
      inviteToGroup,
      acceptInvite,
      rejectInvite,
      removeMember,
      leaveGroup,
      renameGroup,
      updateGroupAvatar,
      fetchMembers,
    ]
  );

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

export function useGroupContext() {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error("useGroupContext must be used within GroupProvider");
  return ctx;
}
