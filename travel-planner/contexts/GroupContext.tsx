"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
// Shared constant: max avatar file size in bytes (e.g. 2MB)
export const GROUP_AVATAR_MAX_SIZE = 2 * 1024 * 1024; // 2MB

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getBrowserSupabase } from "../lib/supabaseClient";
import type { Group, GroupInvite, GroupMember } from "../types/group";

export type LoadState = "idle" | "loading" | "ready" | "error";

type State = {
  currentUserId: string | null;
  groups: Group[];
  invites: GroupInvite[];
  membersByGroupId: Record<string, GroupMember[]>;
  status: {
    groups: LoadState;
    invites: LoadState;
    members: Record<string, LoadState>;
  };
  errors: {
    groups: string | null;
    invites: string | null;
    members: Record<string, string | null>;
  };
  unreadGroupIds: Set<string>;
  unreadInviteIds: Set<string>;
};

type Action =
  | { type: "SET_USER"; payload: string | null }
  | { type: "GROUPS_LOADING" }
  | { type: "GROUPS_SUCCESS"; payload: Group[] }
  | { type: "GROUPS_ERROR"; payload: string }
  | { type: "INVITES_LOADING" }
  | { type: "INVITES_SUCCESS"; payload: GroupInvite[] }
  | { type: "INVITES_ERROR"; payload: string }
  | { type: "MEMBERS_LOADING"; payload: { groupId: string } }
  | { type: "MEMBERS_SUCCESS"; payload: { groupId: string; members: GroupMember[] } }
  | { type: "MEMBERS_ERROR"; payload: { groupId: string; error: string } }
  | { type: "UPSERT_GROUP"; payload: Group }
  | { type: "REMOVE_GROUP"; payload: string }
  | { type: "UPDATE_GROUP_NAME"; payload: { groupId: string; name: string } }
  | { type: "UPDATE_GROUP_AVATAR"; payload: { groupId: string; avatarUrl: string } }
  | { type: "REMOVE_MEMBER"; payload: { groupId: string; memberId: string } }
  | { type: "MARK_GROUPS_READ"; payload: string[] }
  | { type: "MARK_INVITES_READ"; payload: string[] };

const initialState: State = {
  currentUserId: null,
  groups: [],
  invites: [],
  membersByGroupId: {},
  status: {
    groups: "idle",
    invites: "idle",
    members: {},
  },
  errors: {
    groups: null,
    invites: null,
    members: {},
  },
  unreadGroupIds: new Set(),
  unreadInviteIds: new Set(),
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_USER":
      return { ...state, currentUserId: action.payload };
    case "GROUPS_LOADING":
      return {
        ...state,
        status: { ...state.status, groups: "loading" },
        errors: { ...state.errors, groups: null },
      };
    case "GROUPS_SUCCESS": {
      const nextIds = new Set(action.payload.map((g) => g.id));
      const unreadGroupIds = new Set(state.unreadGroupIds);
      nextIds.forEach((id) => {
        if (!state.groups.find((g) => g.id === id)) unreadGroupIds.add(id);
      });
      unreadGroupIds.forEach((id) => {
        if (!nextIds.has(id)) unreadGroupIds.delete(id);
      });
      return {
        ...state,
        groups: action.payload,
        unreadGroupIds,
        status: { ...state.status, groups: "ready" },
      };
    }
    case "GROUPS_ERROR":
      return {
        ...state,
        status: { ...state.status, groups: "error" },
        errors: { ...state.errors, groups: action.payload },
        groups: [],
      };
    case "INVITES_LOADING":
      return {
        ...state,
        status: { ...state.status, invites: "loading" },
        errors: { ...state.errors, invites: null },
      };
    case "INVITES_SUCCESS": {
      const nextIds = new Set(action.payload.map((i) => i.id));
      const unreadInviteIds = new Set(state.unreadInviteIds);
      nextIds.forEach((id) => {
        if (!state.invites.find((i) => i.id === id)) unreadInviteIds.add(id);
      });
      unreadInviteIds.forEach((id) => {
        if (!nextIds.has(id)) unreadInviteIds.delete(id);
      });
      return {
        ...state,
        invites: action.payload,
        unreadInviteIds,
        status: { ...state.status, invites: "ready" },
      };
    }
    case "INVITES_ERROR":
      return {
        ...state,
        status: { ...state.status, invites: "error" },
        errors: { ...state.errors, invites: action.payload },
        invites: [],
      };
    case "MEMBERS_LOADING":
      return {
        ...state,
        status: {
          ...state.status,
          members: { ...state.status.members, [action.payload.groupId]: "loading" },
        },
        errors: {
          ...state.errors,
          members: { ...state.errors.members, [action.payload.groupId]: null },
        },
      };
    case "MEMBERS_SUCCESS":
      return {
        ...state,
        membersByGroupId: {
          ...state.membersByGroupId,
          [action.payload.groupId]: action.payload.members,
        },
        status: {
          ...state.status,
          members: { ...state.status.members, [action.payload.groupId]: "ready" },
        },
      };
    case "MEMBERS_ERROR":
      return {
        ...state,
        status: {
          ...state.status,
          members: { ...state.status.members, [action.payload.groupId]: "error" },
        },
        errors: {
          ...state.errors,
          members: { ...state.errors.members, [action.payload.groupId]: action.payload.error },
        },
      };
    case "UPSERT_GROUP": {
      const next = state.groups.some((g) => g.id === action.payload.id)
        ? state.groups.map((g) => (g.id === action.payload.id ? action.payload : g))
        : [action.payload, ...state.groups];
      return { ...state, groups: next };
    }
    case "REMOVE_GROUP":
      return { ...state, groups: state.groups.filter((g) => g.id !== action.payload) };
    case "UPDATE_GROUP_NAME":
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.payload.groupId ? { ...g, name: action.payload.name } : g
        ),
      };
    case "UPDATE_GROUP_AVATAR":
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.payload.groupId ? { ...g, avatarUrl: action.payload.avatarUrl } : g
        ),
      };
    case "REMOVE_MEMBER": {
      const list = state.membersByGroupId[action.payload.groupId] || [];
      return {
        ...state,
        membersByGroupId: {
          ...state.membersByGroupId,
          [action.payload.groupId]: list.filter((m) => m.id !== action.payload.memberId),
        },
      };
    }
    case "MARK_GROUPS_READ": {
      const next = new Set(state.unreadGroupIds);
      action.payload.forEach((id) => next.delete(id));
      return { ...state, unreadGroupIds: next };
    }
    case "MARK_INVITES_READ": {
      const next = new Set(state.unreadInviteIds);
      action.payload.forEach((id) => next.delete(id));
      return { ...state, unreadInviteIds: next };
    }
    default:
      return state;
  }
}

export type GroupContextValue = {
  currentUserId: string | null;
  groups: Group[];
  invites: GroupInvite[];
  membersByGroupId: Record<string, GroupMember[]>;
  status: State["status"];
  errors: State["errors"];
  unreadGroupIds: Set<string>;
  unreadInviteIds: Set<string>;
  refreshGroups: () => Promise<void>;
  refreshInvites: () => Promise<void>;
  fetchMembers: (groupId: string) => Promise<GroupMember[]>;
  createGroup: (name: string, friendIds?: string[], isPrivate?: boolean) => Promise<Group>;
  renameGroup: (groupId: string, name: string) => Promise<void>;
  updateGroupAvatar: (groupId: string, dataUrl: string) => Promise<string>;
  inviteMembers: (groupId: string, userIds: string[]) => Promise<void>;
  removeMember: (groupId: string, userId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  acceptInvite: (inviteId: string) => Promise<void>;
  rejectInvite: (inviteId: string) => Promise<void>;
  markGroupsRead: (groupIds?: string[]) => void;
  markInvitesRead: (inviteIds?: string[]) => void;
  canManage: (group: Group) => boolean;
};

const GroupContext = createContext<GroupContextValue | null>(null);

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const membersRequestedRef = useRef<Set<string>>(new Set());

  const refreshGroups = useCallback(async () => {
    dispatch({ type: "GROUPS_LOADING" });
    try {
      const res = await fetch("/api/groups/list", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load groups");
      const data = await res.json();
      const next = Array.isArray(data) ? (data as Group[]) : [];
      dispatch({ type: "GROUPS_SUCCESS", payload: next });
    } catch (err) {
      dispatch({
        type: "GROUPS_ERROR",
        payload: err instanceof Error ? err.message : "Failed to load groups",
      });
    }
  }, []);

  const refreshInvites = useCallback(async () => {
    dispatch({ type: "INVITES_LOADING" });
    try {
      const res = await fetch("/api/groups/invites", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load invites");
      const data = await res.json();
      // GroupInvite now includes groupAvatarUrl for displaying group avatars in invites
      const next = Array.isArray(data) ? (data as GroupInvite[]) : [];
      dispatch({ type: "INVITES_SUCCESS", payload: next });
    } catch (err) {
      dispatch({
        type: "INVITES_ERROR",
        payload: err instanceof Error ? err.message : "Failed to load invites",
      });
    }
  }, []);

  const fetchMembers = useCallback(async (groupId: string) => {
    dispatch({ type: "MEMBERS_LOADING", payload: { groupId } });
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/members`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load members");
      const data = await res.json();
      const members = Array.isArray(data) ? (data as GroupMember[]) : [];
      dispatch({ type: "MEMBERS_SUCCESS", payload: { groupId, members } });
      return members;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load members";
      dispatch({ type: "MEMBERS_ERROR", payload: { groupId, error: message } });
      throw new Error(message);
    }
  }, []);

  const inviteMembers = useCallback(async (groupId: string, userIds: string[]) => {
    const payload = userIds.map((id) => id.trim()).filter(Boolean);
    if (payload.length === 0) throw new Error("No user ids provided");
    const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: payload }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || "Failed to invite users");
  }, []);

  const createGroup = useCallback(async (name: string, friendIds: string[] = [], isPrivate = true) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Name is required");

    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed, description: null, is_private: isPrivate }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || "Failed to create group");

    const group: Group = {
      id: String(json.group?.id ?? ""),
      name: String(json.group?.name ?? trimmed),
      slug: json.group?.slug ?? null,
      description: json.group?.description ?? null,
      isPrivate: Boolean(json.group?.is_private ?? isPrivate),
      memberCount: Number(json.group?.member_count ?? 1),
      avatarUrl: json.group?.avatar_url ?? null,
      createdBy: json.group?.created_by ?? null,
      role: "admin",
    };
    if (!group.id) throw new Error("Failed to create group");
    dispatch({ type: "UPSERT_GROUP", payload: group });
    if (friendIds.length > 0) {
      await inviteMembers(group.id, friendIds);
    }
    return group;
  }, [inviteMembers]);

  const renameGroup = useCallback(async (groupId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Name is required");
    const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || "Failed to rename group");
    dispatch({ type: "UPDATE_GROUP_NAME", payload: { groupId, name: trimmed } });
  }, []);

  const updateGroupAvatar = useCallback(async (groupId: string, dataUrl: string) => {
    if (!dataUrl) throw new Error("Missing image");
    const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/avatar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || "Failed to update avatar");
    const avatarUrl = String(json.avatarUrl ?? "");
    if (!avatarUrl) throw new Error("Missing avatar url");
    dispatch({ type: "UPDATE_GROUP_AVATAR", payload: { groupId, avatarUrl } });
    // Odśwież członków grupy, by zaktualizować avatar w liście
    await fetchMembers(groupId);
    return avatarUrl;
  }, [fetchMembers]);

  const removeMember = useCallback(async (groupId: string, userId: string) => {
    const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/members/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || "Failed to remove member");
    dispatch({ type: "REMOVE_MEMBER", payload: { groupId, memberId: userId } });
  }, []);

  const leaveGroup = useCallback(async (groupId: string) => {
    const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/leave`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || "Failed to leave group");
    dispatch({ type: "REMOVE_GROUP", payload: groupId });
    dispatch({ type: "MARK_GROUPS_READ", payload: [groupId] });
  }, []);

  const acceptInvite = useCallback(async (inviteId: string) => {
    const res = await fetch(`/api/groups/invites/${encodeURIComponent(inviteId)}/accept`, {
      method: "POST",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || "Failed to accept invite");
    await refreshGroups();
    await refreshInvites();
  }, [refreshGroups, refreshInvites]);

  const rejectInvite = useCallback(async (inviteId: string) => {
    const res = await fetch(`/api/groups/invites/${encodeURIComponent(inviteId)}/reject`, {
      method: "POST",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || "Failed to reject invite");
    await refreshInvites();
  }, [refreshInvites]);

  // markGroupsRead: only mark provided groupIds as read, do not depend on state to avoid update loop
  const markGroupsRead = useCallback((groupIds?: string[]) => {
    const ids = groupIds ?? [];
    if (ids.length === 0) return;
    dispatch({ type: "MARK_GROUPS_READ", payload: ids });
  }, []);

  const markInvitesRead = useCallback(
    (inviteIds?: string[]) => {
      const ids = inviteIds ?? Array.from(state.unreadInviteIds);
      if (ids.length === 0) return;
      dispatch({ type: "MARK_INVITES_READ", payload: ids });
    },
    [state.unreadInviteIds]
  );

  const canManage = useCallback(
    (group: Group) => Boolean(group.createdBy && group.createdBy === state.currentUserId),
    [state.currentUserId]
  );

  useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      try {
        const res = await fetch("/api/user/me", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && typeof data?.id === "string") {
          dispatch({ type: "SET_USER", payload: data.id });
          await refreshGroups();
          await refreshInvites();
        }
      } catch {
        // ignore
      }
    };
    void loadUser();
    return () => {
      mounted = false;
    };
  }, [refreshGroups, refreshInvites]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const onChange = (payload: RealtimePostgresChangesPayload<{ [key: string]: any }>) => {
      if (payload.table === "groups") {
        void refreshGroups();
        return;
      }
      if (payload.table === "group_invites") {
        void refreshInvites();
        return;
      }
      if (payload.table === "group_members") {
        void refreshGroups();
        const groupIds = Object.keys(state.membersByGroupId);
        groupIds.forEach((groupId) => {
          if (membersRequestedRef.current.has(groupId)) return;
          membersRequestedRef.current.add(groupId);
          fetchMembers(groupId)
            .catch(() => null)
            .finally(() => membersRequestedRef.current.delete(groupId));
        });
      }
    };

    const channel = supabase
      .channel("groups-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups" },
        (payload) => onChange(payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_invites" },
        (payload) => onChange(payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        (payload) => onChange(payload)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMembers, refreshGroups, refreshInvites, state.membersByGroupId]);

  const value = useMemo<GroupContextValue>(
    () => ({
      currentUserId: state.currentUserId,
      groups: state.groups,
      invites: state.invites,
      membersByGroupId: state.membersByGroupId,
      status: state.status,
      errors: state.errors,
      unreadGroupIds: state.unreadGroupIds,
      unreadInviteIds: state.unreadInviteIds,
      refreshGroups,
      refreshInvites,
      fetchMembers,
      createGroup,
      renameGroup,
      updateGroupAvatar,
      inviteMembers,
      removeMember,
      leaveGroup,
      acceptInvite,
      rejectInvite,
      markGroupsRead: markGroupsRead,
      markInvitesRead,
      canManage,
    }),
    [
      state.currentUserId,
      state.groups,
      state.invites,
      state.membersByGroupId,
      state.status,
      state.errors,
      state.unreadGroupIds,
      state.unreadInviteIds,
      refreshGroups,
      refreshInvites,
      fetchMembers,
      createGroup,
      renameGroup,
      updateGroupAvatar,
      inviteMembers,
      removeMember,
      leaveGroup,
      leaveGroup,
      acceptInvite,
      rejectInvite,
      markGroupsRead,
      markInvitesRead,
      canManage,
    ]
  );

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

export function useGroupContext() {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error("useGroupContext must be used within GroupProvider");
  return ctx;
}
