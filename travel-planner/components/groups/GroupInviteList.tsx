"use client";
import React from "react";
import Button from "../ui/button";
import { useGroup } from "../../hooks/useGroup";
import { useToast } from "../toast/ToastProvider";

type Props = {
  groupId: string;
};

export default function GroupInviteList({ groupId }: Props) {
  const { invites, status, errors, acceptInvite, rejectInvite } = useGroup();
  const { push } = useToast();

  const list = invites.filter((invite) => invite.groupId === groupId);
  const loading = status.invites === "loading";
  const error = errors.invites;

  return (
    <div className="space-y-3">
      <div className="text-sm text-white/70">Zaproszenia</div>
      {loading && <div className="text-xs text-white/60">Ładowanie zaproszeń...</div>}
      {error && <div className="text-xs text-red-400">{error}</div>}
      {!loading && !error && list.length === 0 && (
        <div className="text-xs text-white/60">Brak zaproszeń.</div>
      )}
      <div className="space-y-2">
        {list.map((invite) => (
          <div key={invite.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm text-white truncate">{invite.groupName}</div>
              <div className="text-xs text-white/50 truncate">Od: {invite.fromName || invite.fromPublicId || "Użytkownik"}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={async () => {
                  try {
                    await acceptInvite(invite.id);
                    push({ type: "success", title: "Grupa", message: "Zaproszenie przyjęte." });
                  } catch (err) {
                    push({ type: "error", title: "Grupa", message: err instanceof Error ? err.message : "Nie udało się przyjąć zaproszenia." });
                  }
                }}
              >
                Przyjmij
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await rejectInvite(invite.id);
                    push({ type: "success", title: "Grupa", message: "Zaproszenie odrzucone." });
                  } catch (err) {
                    push({ type: "error", title: "Grupa", message: err instanceof Error ? err.message : "Nie udało się odrzucić zaproszenia." });
                  }
                }}
              >
                Odrzuć
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
