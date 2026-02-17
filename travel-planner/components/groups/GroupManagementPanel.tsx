"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Dialog } from '@headlessui/react';
import { AnimatePresence, motion } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useGroup } from "../../hooks/useGroup";
import type { Group } from "../../types/group";
import GroupRenameForm from "./GroupRenameForm";
import GroupAvatarPicker from "./GroupAvatarPicker";
import GroupMemberList from "./GroupMemberList";
import GroupInviteList from "./GroupInviteList";
import Button from "../ui/button";

type Props = {
  groupId: string | null;
  open: boolean;
  onClose: () => void;
};

export default function GroupManagementPanel({ groupId, open, onClose }: Props) {
  const { groups, invites, canManage, markGroupsRead, markInvitesRead, deleteGroup } = useGroup();
  const [displayGroup, setDisplayGroup] = useState<Group | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const group = useMemo(() => groups.find((g) => g.id === groupId) || null, [groups, groupId]);
  const invitesForGroup = useMemo(
    () => invites.filter((invite) => invite.groupId === groupId),
    [invites, groupId]
  );

  useEffect(() => {
    if (!open || !groupId) return;
    markGroupsRead([groupId]);
    if (invitesForGroup.length > 0) {
      markInvitesRead(invitesForGroup.map((invite) => invite.id));
    }
  }, [groupId, invitesForGroup, markGroupsRead, markInvitesRead, open]);

  useEffect(() => {
    if (open && group) {
      setDisplayGroup(group);
    }
  }, [open, group]);

  useEffect(() => {
    if (open && groupId && !group) {
      onClose();
    }
  }, [open, groupId, group, onClose]);

  if (!displayGroup) return null;
  const isOwner = canManage(displayGroup);
  const handleDeleteGroup = async () => {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteGroup(displayGroup.id);
      setDeleteLoading(false);
      setDeleteConfirm(false);
      onClose();
    } catch (err: any) {
      setDeleteError(err?.message || 'Nie udało się usunąć grupy');
      setDeleteLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <Dialog as={motion.div} className="relative z-50" open={open} onClose={onClose} static>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Overlay
              as={motion.div}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative z-10 w-full max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-glass backdrop-blur-2xl text-white overflow-hidden"
              role="dialog"
              aria-modal="true"
            >
              {/* X button for closing modal */}
              <button
                type="button"
                onClick={onClose}
                className="absolute top-6 right-6 z-20 inline-flex items-center justify-center w-9 h-9 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
                aria-label="Zamknij"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <div>
                  <div className="text-2xl font-semibold text-white mb-1">Zarządzaj grupą</div>
                  <div className="text-sm text-white/60">{displayGroup.name}</div>
                </div>
              </div>
              {!isOwner && (
                <div className="px-2 py-3 text-sm text-red-300">Tylko właściciel grupy może nią zarządzać.</div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-8">
                  <div className="bg-white/10 rounded-xl p-6">
                    <div className="text-lg font-semibold mb-3">Informacje o grupie</div>
                    <GroupRenameForm groupId={displayGroup.id} initialName={displayGroup.name} canManage={isOwner} />
                    <GroupAvatarPicker groupId={displayGroup.id} currentUrl={displayGroup.avatarUrl} canManage={isOwner} />
                    {/* Możesz dodać tu edycję opisu */}
                    {isOwner && (
                      <div className="mt-6">
                        <Button
                          type="button"
                          className="w-full"
                          onClick={() => setDeleteConfirm(true)}
                          disabled={deleteLoading}
                        >
                          Usuń grupę
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-8">
                  <div className="bg-white/10 rounded-xl p-6">
                    <div className="text-lg font-semibold mb-3">Członkowie grupy</div>
                    <GroupMemberList groupId={displayGroup.id} canManage={isOwner} />
                    <GroupInviteList groupId={displayGroup.id} />
                  </div>
                </div>
              </div>
              {/* Modal potwierdzenia usunięcia */}
              {deleteConfirm && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60">
                  <div className="bg-white rounded-xl p-6 shadow-xl text-gray-900 w-full max-w-sm">
                    <div className="text-lg font-semibold mb-2">Czy na pewno chcesz usunąć grupę?</div>
                    <div className="text-sm mb-4">Tej operacji nie można cofnąć.</div>
                    {deleteError && <div className="text-xs text-red-600 mb-3">{deleteError}</div>}
                    <div className="flex gap-3 justify-end">
                      <button
                        type="button"
                        className="modal-delete-native-btn px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold"
                        onClick={() => setDeleteConfirm(false)}
                        disabled={deleteLoading}
                      >
                        Anuluj
                      </button>
                      <button
                        type="button"
                        className="modal-delete-native-btn px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold"
                        onClick={handleDeleteGroup}
                        disabled={deleteLoading}
                      >
                        {deleteLoading ? 'Usuwanie...' : 'Usuń grupę'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}