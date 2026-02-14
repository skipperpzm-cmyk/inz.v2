"use client";
import React, { useState } from "react";
import Button from "../ui/button";
import { useGroup } from "../../hooks/useGroup";
import { useToast } from "../toast/ToastProvider";

type Props = {
  groupId: string;
  initialName: string;
  canManage: boolean;
};

export default function GroupRenameForm({ groupId, initialName, canManage }: Props) {
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const { renameGroup } = useGroup();
  const { push } = useToast();

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!canManage) return;
        setLoading(true);
        try {
          await renameGroup(groupId, name);
          push({ type: "success", title: "Grupa", message: "Nazwa została zaktualizowana." });
        } catch (err) {
          push({ type: "error", title: "Grupa", message: err instanceof Error ? err.message : "Nie udało się zaktualizować nazwy." });
        } finally {
          setLoading(false);
        }
      }}
    >
      <div className="text-sm text-white/70">Nazwa grupy</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        disabled={!canManage}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={!canManage || loading || !name.trim()}>
          {loading ? "Zapisywanie..." : "Zapisz"}
        </Button>
      </div>
    </form>
  );
}
