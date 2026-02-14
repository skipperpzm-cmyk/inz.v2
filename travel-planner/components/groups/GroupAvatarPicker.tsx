"use client";
import React, { useRef, useState } from "react";
import Button from "../ui/button";
import { useGroup } from "../../hooks/useGroup";
import { useToast } from "../toast/ToastProvider";
import { GROUP_AVATAR_MAX_SIZE } from "../../contexts/GroupContext";

type Props = {
  groupId: string;
  currentUrl?: string | null;
  canManage: boolean;
};

export default function GroupAvatarPicker({ groupId, currentUrl, canManage }: Props) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { updateGroupAvatar } = useGroup();
  const { push } = useToast();
  const maxBytes = GROUP_AVATAR_MAX_SIZE;

  const readFile = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });

  return (
    <div className="space-y-3">
      <div className="text-sm text-white/70">Avatar grupy</div>
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-white/60 text-xs">
          {preview ? <img src={preview} alt="Avatar grupy" className="w-full h-full object-cover" /> : "Brak zdjęcia"}
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (!file.type.startsWith("image/")) {
                push({ type: "error", title: "Group", message: "Please select an image file." });
                e.currentTarget.value = "";
                return;
              }
              if (file.size > maxBytes) {
                push({ type: "error", title: "Group", message: `Image is too large (max ${(maxBytes / (1024 * 1024)).toFixed(1)} MB).` });
                e.currentTarget.value = "";
                return;
              }
              try {
                const url = await readFile(file);
                setPreview(url);
              } catch (err) {
                push({ type: "error", title: "Group", message: err instanceof Error ? err.message : "Failed to read file." });
              }
            }}
          />
          <Button type="button" variant="ghost" onClick={() => fileRef.current?.click()} disabled={!canManage}>
            Wybierz zdjęcie
          </Button>
          <Button
            type="button"
            disabled={!canManage || loading || !preview}
            onClick={async () => {
              if (!preview) return;
              setLoading(true);
              try {
                await updateGroupAvatar(groupId, preview);
                push({ type: "success", title: "Grupa", message: "Avatar zaktualizowany." });
              } catch (err) {
                push({ type: "error", title: "Grupa", message: err instanceof Error ? err.message : "Nie udało się zaktualizować avatara." });
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "Zapisywanie..." : "Zapisz"}
          </Button>
        </div>
      </div>
    </div>
  );
}
