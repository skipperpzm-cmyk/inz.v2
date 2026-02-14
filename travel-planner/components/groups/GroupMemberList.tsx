"use client";
import React, { useEffect, useState } from "react";
import Button from "../ui/button";
import GroupMemberRow from "./GroupMemberRow";
import { useGroup } from "../../hooks/useGroup";
import { useToast } from "../toast/ToastProvider";

type Props = {
  groupId: string;
  canManage: boolean;
};

export default function GroupMemberList({ groupId, canManage }: Props) {
  const { membersByGroupId, status, errors, fetchMembers, inviteMembers, removeMember, currentUserId } = useGroup();
  const [inviteValue, setInviteValue] = useState("");
  const [loading, setLoading] = useState(false);
  const { push } = useToast();
  const maxMembers = 50;

  useEffect(() => {
    void fetchMembers(groupId).catch(() => null);
  }, [fetchMembers, groupId]);

  useEffect(() => {
    const onAvatarUpdated = () => {
      void fetchMembers(groupId).catch(() => null);
    };
    window.addEventListener("avatar-updated", onAvatarUpdated as EventListener);
    return () => window.removeEventListener("avatar-updated", onAvatarUpdated as EventListener);
  }, [fetchMembers, groupId]);

  const members = membersByGroupId[groupId] || [];
  const isLoading = status.members[groupId] === "loading";
  const error = errors.members[groupId] || null;
  const atLimit = members.length >= maxMembers;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/70">Członkowie grupy</div>
        <span className="text-[11px] text-white/60 px-2 py-0.5 rounded-full bg-white/10">
          {members.length}/{maxMembers}
        </span>
      </div>
      {canManage && (
        <form
          className="flex items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!inviteValue.trim()) return;
            if (atLimit) {
              push({ type: "error", title: "Group", message: "Member limit reached." });
              return;
            }
            setLoading(true);
            try {
              await inviteMembers(groupId, [inviteValue.trim()]);
              push({ type: "success", title: "Group", message: "Invite sent." });
              setInviteValue("");
            } catch (err) {
              push({ type: "error", title: "Group", message: err instanceof Error ? err.message : "Failed to invite member." });
            } finally {
              setLoading(false);
            }
          }}
        >
          <input
            value={inviteValue}
            onChange={(e) => setInviteValue(e.target.value)}
            placeholder="User id"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            disabled={!canManage || atLimit}
          />
          <Button type="submit" disabled={!canManage || loading || !inviteValue.trim() || atLimit}>
            {loading ? "Sending..." : "Add"}
          </Button>
        </form>
      )}
      {atLimit && <div className="text-xs text-amber-300">Member limit reached ({maxMembers}).</div>}

      {isLoading && <div className="text-xs text-white/60">Loading members...</div>}
      {error && <div className="text-xs text-red-400">{error}</div>}
      {!isLoading && !error && members.length === 0 && (
        <div className="text-xs text-white/60">No members found.</div>
      )}
      <div className="space-y-2">
        {members.map((member) => (
          <GroupMemberRow
            key={member.id}
            member={member}
            canRemove={canManage && member.id !== currentUserId}
            busy={loading}
            onRemove={async (memberId) => {
              setLoading(true);
              try {
                await removeMember(groupId, memberId);
                push({ type: "success", title: "Group", message: "Member removed." });
              } catch (err) {
                push({ type: "error", title: "Group", message: err instanceof Error ? err.message : "Failed to remove member." });
              } finally {
                setLoading(false);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
