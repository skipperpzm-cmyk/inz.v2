"use client";
import React from "react";
import Button from "../ui/button";
import type { GroupMember } from "../../types/group";

type Props = {
  member: GroupMember;
  canRemove: boolean;
  onRemove: (memberId: string) => void;
  busy: boolean;
};

const PRELOADED_AVATARS = Array.from({ length: 12 }, (_, i) => `/avatars/avatar_animals/avatar_animal_${i + 1}.png`);

export default function GroupMemberRow({ member, canRemove, onRemove, busy }: Props) {
  const isDefaultAvatar = member.avatarUrl && PRELOADED_AVATARS.includes(member.avatarUrl);
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
      <div className="flex items-center min-w-0 gap-2">
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-white overflow-hidden">
          {member.avatarUrl ? (
            isDefaultAvatar ? (
              <img
                src={member.avatarUrl}
                alt={member.fullName || member.username || 'Użytkownik'}
                className="w-full h-full object-contain rounded-full bg-white"
                draggable={false}
              />
            ) : (
              <img
                src={member.avatarUrl}
                alt={member.fullName || member.username || 'Użytkownik'}
                className="w-full h-full object-cover rounded-full"
                referrerPolicy="no-referrer"
              />
            )
          ) : (
            <span>{(member.fullName || member.username || 'U').slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div>
          <div className="text-sm text-white truncate">{member.fullName || member.username || "Użytkownik"}</div>
          <div className="text-xs text-white/50 truncate">ID: {member.publicId || "-"}</div>
        </div>
      </div>
      {member.role !== 'admin' && (
        <Button variant="danger" disabled={!canRemove || busy} onClick={() => onRemove(member.id)}>
          Usuń
        </Button>
      )}
    </div>
  );
}
