"use client";
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { UserGroupIcon, UserPlusIcon, UserIcon, InboxIcon } from '@heroicons/react/24/outline';
import { useChat } from './chat/ChatContext';
import AddFriendInline from './AddFriendInline';
import FriendInvitesIcon from './FriendInvitesIcon';
import FriendRequests from './FriendRequests';
import { useFriendContext } from './FriendContext';
import { useGroupContext, Group, GroupInvite, Member } from './GroupContext';
import Modal from './Modal';
import Button from './ui/button';
import {
  ActionIconButton,
  BackButton,
  DodajZnajomegoButton,
  FriendRow,
  FriendSelectRow,
  GroupRow,
  NowaGrupaButton,
  SearchInput,
  SectionTabButton,
  TooltipPortal,
} from './RightSidebarParts';
export default function RightSidebar() {
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [openMenuFriendId, setOpenMenuFriendId] = useState<string | null>(null);
  const [openMenuGroupId, setOpenMenuGroupId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const groupMenuRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createGroupName, setCreateGroupName] = useState('');
  const [createGroupFriendIds, setCreateGroupFriendIds] = useState<string[]>([]);
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);
  const [createGroupLoading, setCreateGroupLoading] = useState(false);
  const [inviteGroup, setInviteGroup] = useState<Group | null>(null);
  const [inviteGroupFriendIds, setInviteGroupFriendIds] = useState<string[]>([]);
  const [inviteGroupError, setInviteGroupError] = useState<string | null>(null);
  const [inviteGroupLoading, setInviteGroupLoading] = useState(false);
  const [renameGroupTarget, setRenameGroupTarget] = useState<Group | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameLoading, setRenameLoading] = useState(false);
  const [removeGroupTarget, setRemoveGroupTarget] = useState<Group | null>(null);
  const [removeMembers, setRemoveMembers] = useState<Member[]>([]);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeFetching, setRemoveFetching] = useState(false);
  const [leaveGroupTarget, setLeaveGroupTarget] = useState<Group | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [showEmptyButton, setShowEmptyButton] = useState(false);
  const [groupPanel, setGroupPanel] = useState<'none' | 'invites'>('none');

  // Close dropdown on outside click
  useEffect(() => {
    if (!openMenuFriendId) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuFriendId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenuFriendId]);

  useEffect(() => {
    if (!openMenuGroupId) return;
    function handleClick(e: MouseEvent) {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) {
        setOpenMenuGroupId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenuGroupId]);

  // Type declarations
  type Friend = { id: string; name: string; publicId?: string | null; avatarUrl?: string | null; online?: boolean };

  // All hooks/state at the top
  const { openChat, openGroupChat, chats, unreadCounts, resetUnread } = useChat();
  const [active, setActive] = useState<'friends' | 'groups'>('friends');
  const [inviteTabRead, setInviteTabRead] = useState(false);
  const [groupTabRead, setGroupTabRead] = useState(false);
  const [panel, setPanel] = useState<'none' | 'add' | 'invites'>('none');
  const [groupQuery, setGroupQuery] = useState('');
  const [query, setQuery] = useState('');
  const { friends, friendsLoading, friendsError, pendingInvites, unreadInviteCount, markInvitesRead, sendInvite, getRelationState, unfriend } = useFriendContext();
  const {
    currentUserId: currentGroupUserId,
    groups,
    groupInvites,
    groupsLoading,
    invitesLoading,
    groupsError,
    invitesError,
    unreadGroupInviteCount,
    unreadMessageCounts,
    isInviteUnread,
    markInvitesRead: markGroupInvitesRead,
    markGroupInviteNotificationsRead,
    markGroupMessagesRead,
    createGroup,
    inviteToGroup,
    acceptInvite,
    rejectInvite,
    removeMember,
    leaveGroup,
    renameGroup,
    fetchMembers,
  } = useGroupContext();

  // Reset tab notification when new invite arrives
  useEffect(() => {
    if (unreadInviteCount > 0) setInviteTabRead(false);
  }, [unreadInviteCount]);
  useEffect(() => {
    if (unreadGroupInviteCount > 0) setGroupTabRead(false);
  }, [unreadGroupInviteCount]);

  useEffect(() => {
    if (panel !== 'invites') return;
    markInvitesRead();
  }, [panel, pendingInvites, markInvitesRead]);

  useEffect(() => {
    if (active !== 'groups' && groupPanel !== 'none') {
      setGroupPanel('none');
    }
  }, [active, groupPanel]);

  useEffect(() => {
    if (groupPanel !== 'invites') return;
    markGroupInviteNotificationsRead();
  }, [groupPanel, markGroupInviteNotificationsRead]);

  const displayedFriends = panel === 'none' && query.trim().length > 0
    ? friends.filter((f: Friend) =>
        (f.name?.toLowerCase() ?? '').includes(query.trim().toLowerCase()) ||
        (f.publicId?.toLowerCase() ?? '').includes(query.trim().toLowerCase())
      )
    : friends;

  const groupUnreadTotal = unreadGroupInviteCount + Object.values(unreadMessageCounts).reduce((sum, v) => sum + v, 0);
  const showFriendsSpinner = friendsLoading && friends.length === 0;
  const showGroupsSpinner = groupsLoading && groups.length === 0;
  const showGroupInvitesSpinner = invitesLoading && groupInvites.length === 0;

  function getChatId(kind: 'friend' | 'group', peerId: string) {
    return `${kind}:${peerId}`;
  }

  async function createInviteForUser(payload: { toUserId: string; name: string; publicId?: string | null; avatarUrl?: string | null }) {
    setPanel('none');
    setQuery('');

    try {
      await sendInvite(payload.toUserId);
    } catch (err: any) {
      throw err;
    }
  }

  // Track currently open chat for highlight
  useEffect(() => {
    if (chats.length > 0) setCurrentChatId(chats[0]?.id ?? null);
  }, [chats]);

  const handleOpenChat = useCallback((id: string, name: string, avatarUrl: string | null, chatId: string) => {
    openChat(id, name, avatarUrl);
    if (window && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('openFloatingChat', { detail: { chatId } }));
    }
    resetUnread(chatId);
    setCurrentChatId(chatId);
  }, [openChat, resetUnread]);

  const handleOpenGroupChat = useCallback((id: string, name: string, chatId: string) => {
    openGroupChat(id, name);
    if (window && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('openFloatingChat', { detail: { chatId } }));
    }
    resetUnread(chatId);
    markGroupMessagesRead([id]);
    markGroupInvitesRead([id]);
    setCurrentChatId(chatId);
  }, [openGroupChat, resetUnread, markGroupMessagesRead, markGroupInvitesRead]);

  const handleOpenMenu = useCallback((id: string) => {
    setOpenMenuFriendId(id);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setOpenMenuFriendId(null);
  }, []);

  const handleOpenGroupMenu = useCallback((id: string) => {
    setOpenMenuGroupId(id);
  }, []);

  const handleCloseGroupMenu = useCallback(() => {
    setOpenMenuGroupId(null);
  }, []);

  const handleGroupAction = useCallback((id: string, action: 'rename' | 'invite' | 'remove' | 'leave') => {
    const target = groups.find((g) => g.id === id) || null;
    if (!target) return;
    if (action === 'rename') {
      setRenameGroupTarget(target);
      setRenameValue(target.name);
      setRenameError(null);
    }
    if (action === 'invite') {
      setInviteGroup(target);
      setInviteGroupFriendIds([]);
      setInviteGroupError(null);
    }
    if (action === 'remove') {
      setRemoveGroupTarget(target);
      setRemoveMembers([]);
      setRemoveError(null);
    }
    if (action === 'leave') {
      setLeaveGroupTarget(target);
    }
  }, [groups]);

  const handleConfirmRemove = useCallback((id: string) => {
    setConfirmRemoveId(id);
  }, []);

  // Modal state for friend removal confirmation
  const friendToRemove = friends.find(fr => fr.id === confirmRemoveId);
  const removeModal = confirmRemoveId ? (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-[10001] bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 w-full max-w-xs sm:max-w-sm flex flex-col items-center animate-fadein">
        <div className="text-lg font-semibold text-gray-900 dark:text-white mb-2 text-center">Czy na pewno chcesz usunąć znajomego?</div>
        {friendToRemove && (
          <div className="mb-4 text-sm text-gray-700 dark:text-gray-300 text-center">{friendToRemove.name} ({friendToRemove.publicId ?? '—'})</div>
        )}
        <div className="flex gap-3 mt-2">
          <button
            className="px-4 py-2 rounded-lg bg-indigo-500 text-white font-semibold shadow hover:bg-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 transition"
            onClick={async () => {
              if (!confirmRemoveId) return;
              await unfriend(confirmRemoveId);
            }}
          >Usuń</button>
          <button
            className="px-4 py-2 rounded-lg bg-gray-300 text-gray-900 font-semibold shadow hover:bg-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/60 transition"
            onClick={() => setConfirmRemoveId(null)}
          >Anuluj</button>
        </div>
      </div>
    </div>
  ) : null;
  // ...existing code...

  const createGroupModal = (
    <Modal open={createGroupOpen} onClose={() => setCreateGroupOpen(false)} title="Nowa grupa">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setCreateGroupError(null);
          setCreateGroupLoading(true);
          try {
            await createGroup(createGroupName, createGroupFriendIds);
            setCreateGroupName('');
            setCreateGroupFriendIds([]);
            setCreateGroupOpen(false);
          } catch (err: any) {
            setCreateGroupError(err?.message || 'Nie udało się utworzyć grupy');
          } finally {
            setCreateGroupLoading(false);
          }
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-xs text-white/70 mb-1">Nazwa grupy</label>
          <input
            value={createGroupName}
            onChange={(e) => setCreateGroupName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/6 border border-white/10 text-white text-sm"
            placeholder="Np. Weekendowy wypad"
          />
        </div>
        <div>
          <div className="text-xs text-white/70 mb-2">Wybierz znajomych do zaproszenia</div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {friends.length === 0 ? (
              <div className="text-xs text-white/60">Nie masz jeszcze znajomych.</div>
            ) : (
              friends.map((f) => (
                <FriendSelectRow
                  key={f.id}
                  friend={{ id: f.id, name: f.name, publicId: f.publicId, avatarUrl: f.avatarUrl ?? null, online: f.online }}
                  selected={createGroupFriendIds.includes(f.id)}
                  onToggle={(id) => {
                    setCreateGroupFriendIds((prev) =>
                      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                    );
                  }}
                />
              ))
            )}
          </div>
        </div>
        {createGroupError && <div className="text-xs text-red-400">{createGroupError}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setCreateGroupOpen(false)} disabled={createGroupLoading}>Anuluj</Button>
          <Button type="submit" disabled={createGroupLoading || !createGroupName.trim()}>
            {createGroupLoading ? 'Tworzenie…' : 'Utwórz grupę'}
          </Button>
        </div>
      </form>
    </Modal>
  );

  const inviteGroupModal = (
    <Modal open={Boolean(inviteGroup)} onClose={() => setInviteGroup(null)} title="Dodaj członków">
      {inviteGroup && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setInviteGroupError(null);
            setInviteGroupLoading(true);
            try {
              for (const friendId of inviteGroupFriendIds) {
                await inviteToGroup(inviteGroup.id, friendId);
              }
              setInviteGroupFriendIds([]);
              setInviteGroup(null);
            } catch (err: any) {
              setInviteGroupError(err?.message || 'Nie udało się dodać członków');
            } finally {
              setInviteGroupLoading(false);
            }
          }}
          className="space-y-4"
        >
          <div className="text-xs text-white/70">Grupa: <span className="text-white">{inviteGroup.name}</span></div>
          <div>
            <div className="text-xs text-white/70 mb-2">Wybierz znajomych do zaproszenia</div>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {friends.length === 0 ? (
                <div className="text-xs text-white/60">Nie masz jeszcze znajomych.</div>
              ) : (
                friends.map((f) => (
                  <FriendSelectRow
                    key={f.id}
                    friend={{ id: f.id, name: f.name, publicId: f.publicId, avatarUrl: f.avatarUrl ?? null, online: f.online }}
                    selected={inviteGroupFriendIds.includes(f.id)}
                    onToggle={(id) => {
                      setInviteGroupFriendIds((prev) =>
                        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                      );
                    }}
                  />
                ))
              )}
            </div>
          </div>
          {inviteGroupError && <div className="text-xs text-red-400">{inviteGroupError}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setInviteGroup(null)} disabled={inviteGroupLoading}>Anuluj</Button>
            <Button type="submit" disabled={inviteGroupLoading || inviteGroupFriendIds.length === 0}>
              {inviteGroupLoading ? 'Dodawanie…' : 'Dodaj'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );

  const renameGroupModal = (
    <Modal open={Boolean(renameGroupTarget)} onClose={() => setRenameGroupTarget(null)} title="Zmień nazwę grupy">
      {renameGroupTarget && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setRenameError(null);
            setRenameLoading(true);
            try {
              await renameGroup(renameGroupTarget.id, renameValue);
              setRenameGroupTarget(null);
            } catch (err: any) {
              setRenameError(err?.message || 'Nie udało się zmienić nazwy');
            } finally {
              setRenameLoading(false);
            }
          }}
          className="space-y-4"
        >
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/6 border border-white/10 text-white text-sm"
          />
          {renameError && <div className="text-xs text-red-400">{renameError}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRenameGroupTarget(null)} disabled={renameLoading}>Anuluj</Button>
            <Button type="submit" disabled={renameLoading || !renameValue.trim()}>
              {renameLoading ? 'Zapisywanie…' : 'Zapisz'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );

  const removeMemberModal = (
    <Modal open={Boolean(removeGroupTarget)} onClose={() => setRemoveGroupTarget(null)} title="Usuń członka">
      {removeGroupTarget && (
        <div className="space-y-4">
          <div className="text-xs text-white/70">Grupa: <span className="text-white">{removeGroupTarget.name}</span></div>
          {removeFetching ? (
            <div className="text-xs text-white/60">Ładowanie członków…</div>
          ) : removeError ? (
            <div className="text-xs text-red-400">{removeError}</div>
          ) : removeMembers.length === 0 ? (
            <div className="text-xs text-white/60">Brak członków do usunięcia.</div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {removeMembers.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 bg-white/5 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{m.fullName ?? m.username ?? 'Użytkownik'}</div>
                    <div className="text-xs text-white/50 truncate">ID: {m.publicId ?? '—'}</div>
                  </div>
                  <Button
                    variant="danger"
                    disabled={removeLoading || m.id === currentGroupUserId}
                    onClick={async () => {
                      if (!removeGroupTarget) return;
                      setRemoveLoading(true);
                      setRemoveError(null);
                      try {
                        await removeMember(removeGroupTarget.id, m.id);
                        setRemoveMembers((prev) => prev.filter((x) => x.id !== m.id));
                      } catch (err: any) {
                        setRemoveError(err?.message || 'Nie udało się usunąć członka');
                      } finally {
                        setRemoveLoading(false);
                      }
                    }}
                  >
                    Usuń
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={() => setRemoveGroupTarget(null)}>Zamknij</Button>
          </div>
        </div>
      )}
    </Modal>
  );

  const leaveGroupModal = (
    <Modal open={Boolean(leaveGroupTarget)} onClose={() => setLeaveGroupTarget(null)} title="Opuścić grupę?">
      {leaveGroupTarget && (
        <div className="space-y-4">
          <div className="text-sm text-white">Czy na pewno chcesz opuścić grupę <span className="font-semibold">{leaveGroupTarget.name}</span>?</div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setLeaveGroupTarget(null)}>Anuluj</Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await leaveGroup(leaveGroupTarget.id);
                  setLeaveGroupTarget(null);
                } catch (err: any) {
                  setLeaveGroupTarget(null);
                }
              }}
            >
              Opuść
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );

  // Much larger delay for empty friends list, and smooth slide-in
  useEffect(() => {
    if (!friendsLoading && !friendsError && Array.isArray(friends) && friends.length === 0) {
      const timeout = setTimeout(() => setShowEmptyButton(true), 900);
      return () => clearTimeout(timeout);
    } else {
      setShowEmptyButton(false);
    }
  }, [friendsLoading, friendsError, friends]);

  useEffect(() => {
    if (!removeGroupTarget) return;
    let active = true;
    setRemoveFetching(true);
    fetchMembers(removeGroupTarget.id)
      .then((list) => {
        if (!active) return;
        setRemoveMembers(list);
      })
      .catch((err) => {
        if (!active) return;
        setRemoveError(err instanceof Error ? err.message : 'Nie udało się pobrać członków');
      })
      .finally(() => {
        if (active) setRemoveFetching(false);
      });
    return () => {
      active = false;
    };
  }, [removeGroupTarget, fetchMembers]);

  return (
    <>
      {removeModal}
      {createGroupModal}
      {inviteGroupModal}
      {renameGroupModal}
      {removeMemberModal}
      {leaveGroupModal}
      <TooltipPortal tooltip={tooltip} />
      <nav className="flex flex-col w-72 h-full p-4 bg-white/5 backdrop-blur-2xl shadow-glass rounded-2xl overflow-visible">
        
        <div className="sticky top-0 z-20 -mx-4 px-4 pb-2 bg-transparent">
          <div className="flex w-full justify-center">
            <div role="tablist" className="inline-flex w-auto gap-2 bg-white/5 rounded-full p-1 shadow-inner border border-white/10">
              <SectionTabButton
                active={active === 'friends'}
                label="Znajomi"
                icon={<UserIcon className="w-5 h-5" />}
                showDot={unreadInviteCount > 0 && !inviteTabRead && active !== 'friends'}
                onClick={() => {
                  setActive('friends');
                  setPanel('none');
                  setInviteTabRead(true);
                }}
              />
              <SectionTabButton
                active={active === 'groups'}
                label="Grupy"
                icon={<UserGroupIcon className="w-5 h-5" />}
                showDot={unreadGroupInviteCount > 0 && !groupTabRead && active !== 'groups'}
                onClick={() => {
                  setActive('groups');
                  setGroupTabRead(true);
                }}
              >
                {groupUnreadTotal > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-500 text-white min-w-[1.25rem]">
                    {groupUnreadTotal}
                  </span>
                )}
              </SectionTabButton>
            </div>
          </div>
          <div className="pt-3 border-b border-white/10" />
        </div>

        <div className="flex-1 overflow-y-auto px-1 py-2" style={{ position: 'relative', height: 420 }}>
          <div className="relative w-full h-[420px]">
            <div
              className="absolute inset-0 h-[420px]"
              style={{
                opacity: active === 'friends' ? 1 : 0,
                visibility: active === 'friends' ? 'visible' : 'hidden',
                pointerEvents: active === 'friends' ? 'auto' : 'none',
              }}
            >
              <div className="h-full overflow-y-auto">
                    <div className="flex items-center gap-2 mb-3 mt-1">
                    <div className="relative flex-1 min-w-0">
                      <SearchInput
                        value={query}
                        onChange={setQuery}
                        placeholder="Szukaj znajomego"
                      />
                    </div>
                    <ActionIconButton
                      ariaLabel="Zaproszenia do znajomych"
                      tooltipText="Zaproszenia do znajomych"
                      setTooltip={setTooltip}
                      onClick={() => {
                        const next = panel === 'invites' ? 'none' : 'invites';
                        setPanel(next);
                        if (unreadInviteCount > 0) markInvitesRead();
                      }}
                    >
                      <FriendInvitesIcon count={unreadInviteCount} />
                    </ActionIconButton>
                    <ActionIconButton
                      ariaLabel="Dodaj znajomego"
                      tooltipText="Dodaj znajomego"
                      setTooltip={setTooltip}
                      onClick={() => setPanel((p) => p === 'add' ? 'none' : 'add')}
                    >
                      <UserPlusIcon className="w-5 h-5" />
                    </ActionIconButton>
                  </div>

                  {panel === 'add' && (
                    <div className="rounded-xl bg-white/4">
                      <div className="flex items-center mb-2">
                        <BackButton onClick={() => setPanel('none')} />
                        <strong className="text-white">Dodaj znajomego</strong>
                      </div>
                      <AddFriendInline
                        onCancel={() => setPanel('none')}
                        onAdd={async ({ id, name }) => {
                          const trimmedId = id.trim();
                          const trimmedName = name.trim();
                          if (!trimmedId && !trimmedName) throw new Error('Wprowadź publiczne ID lub nazwę');

                          const isNumericId = /^\d+$/.test(trimmedId);
                          const isPublicId = /^\d{8}$/.test(trimmedId);

                          // Klikniecie '+' z listy przekazuje userId (UUID) — nie waliduj publicId
                          if (trimmedId && !isNumericId) {
                            await createInviteForUser({
                              toUserId: trimmedId,
                              name: trimmedName || trimmedId,
                              publicId: null,
                              avatarUrl: null,
                            });
                            return;
                          }

                          // Jeśli wpisano publicId, musi mieć 8 cyfr
                          if (trimmedId && isNumericId && !isPublicId) {
                            throw new Error('Publiczne ID musi mieć 8 cyfr');
                          }

                          if (isPublicId) {
                            const s = await fetch(`/api/profiles/search?q=${encodeURIComponent(trimmedId)}`);
                            if (!s.ok) throw new Error('Błąd wyszukiwania użytkownika po publicznym ID');
                            const j = await s.json();
                            const p = j?.data ?? null;
                            if (!p?.id) throw new Error('Nie znaleziono użytkownika o podanym publicznym ID');
                            await createInviteForUser({
                              toUserId: p.id,
                              name: (p.username_display || p.full_name || p.username || trimmedId),
                              publicId: p.public_id ?? trimmedId,
                              avatarUrl: p.avatar_url ?? null,
                            });
                            return;
                          }

                          if (trimmedName) {
                            const s = await fetch(`/api/profiles/search?q=${encodeURIComponent(trimmedName)}`);
                            if (!s.ok) throw new Error('Błąd wyszukiwania użytkownika po nazwie');
                            const j = await s.json();
                            const p = j?.data ?? null;
                            if (!p?.id) throw new Error('Nie znaleziono użytkownika o podanej nazwie');
                            await createInviteForUser({
                              toUserId: p.id,
                              name: (p.username_display || p.full_name || p.username || trimmedName),
                              publicId: p.public_id ?? null,
                              avatarUrl: p.avatar_url ?? null,
                            });
                            return;
                          }

                          throw new Error('Brak ID odbiorcy');
                        }}
                      />
                    </div>
                  )}

                  {panel === 'invites' && (
                    <div className="rounded-xl bg-white/4">
                      <div className="flex items-center mb-2">
                        <BackButton onClick={() => setPanel('none')} />
                        <strong className="text-white">Zaproszenia do znajomych</strong>
                      </div>
                      <FriendRequests setTooltip={setTooltip} />
                    </div>
                  )}

                  {panel === 'none' && (
                    <div>
                      <div className="mb-2 text-sm text-white/60">Lista znajomych</div>
                      {showFriendsSpinner ? (
                        <div className="flex justify-center items-center h-40">
                          <span className="inline-block animate-spin rounded-full border-4 border-indigo-400 border-t-transparent dark:border-indigo-300 dark:border-t-transparent w-8 h-8" />
                        </div>
                      ) : friendsError ? (
                        <div className="text-xs text-red-400">{friendsError}</div>
                      ) : displayedFriends.length === 0 && showEmptyButton && !friendsLoading ? (
                        <div className="flex flex-col items-center justify-center h-40">
                          {showEmptyButton && (
                            <div>
                              <DodajZnajomegoButton onClick={() => setPanel('add')} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {friendsLoading && friends.length > 0 && (
                            <div className="flex justify-center items-center py-2">
                              <span className="inline-block animate-spin rounded-full border-2 border-indigo-300 border-t-transparent w-5 h-5" />
                            </div>
                          )}
                          <ul className="space-y-0">
                            {displayedFriends.map((f) => {
                              const chatId = getChatId('friend', f.id);
                              const unread = unreadCounts[chatId] || 0;
                              return (
                                <FriendRow
                                  key={f.id}
                                  id={f.id}
                                  name={f.name}
                                  publicId={f.publicId}
                                  avatarUrl={f.avatarUrl ?? null}
                                  online={f.online}
                                  unread={unread}
                                  isMenuOpen={openMenuFriendId === f.id}
                                  menuRef={menuRef}
                                  relationState={getRelationState(f.id)}
                                  onOpenChat={handleOpenChat}
                                  onOpenMenu={handleOpenMenu}
                                  onConfirmRemove={handleConfirmRemove}
                                  onCloseMenu={handleCloseMenu}
                                />
                              );
                            })}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
              </div>
            </div>
            <div
              className="absolute inset-0 h-[420px]"
              style={{
                opacity: active === 'groups' ? 1 : 0,
                visibility: active === 'groups' ? 'visible' : 'hidden',
                pointerEvents: active === 'groups' ? 'auto' : 'none',
              }}
            >
              <div className="h-[420px] overflow-y-auto">
                <div className="flex items-center gap-2 mb-3 mt-1">
                  <div className="relative flex-1 min-w-0">
                    <SearchInput
                      value={groupQuery}
                      onChange={setGroupQuery}
                      placeholder="Szukaj grupy"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                      <ActionIconButton
                        ariaLabel="Zaproszenia do grup"
                        tooltipText="Zaproszenia do grup"
                        setTooltip={setTooltip}
                        onClick={() => {
                          const next = groupPanel === 'invites' ? 'none' : 'invites';
                          setGroupPanel(next);
                          if (unreadGroupInviteCount > 0) markGroupInviteNotificationsRead();
                        }}
                      >
                        <InboxIcon className="w-5 h-5" />
                        {unreadGroupInviteCount > 0 && (
                          <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-500 text-white min-w-[1.25rem]">
                            {unreadGroupInviteCount}
                          </span>
                        )}
                      </ActionIconButton>
                      <ActionIconButton
                        ariaLabel="Utwórz nową grupę"
                        tooltipText="Utwórz nową grupę"
                        setTooltip={setTooltip}
                        onClick={() => setCreateGroupOpen(true)}
                      >
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={{ position: 'relative', display: 'inline-block', width: 20, height: 20 }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                              <circle cx="9" cy="7" r="4"></circle>
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                            <svg width="8" height="8" viewBox="0 0 12 12" fill="none" style={{ position: 'absolute', right: -2, bottom: -2, zIndex: 1 }}>
                              <circle cx="6" cy="6" r="6" fill="#22c55e" />
                              <path d="M6 3.5v5M3.5 6h5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
                            </svg>
                          </span>
                        </span>
                      </ActionIconButton>
                  </div>
                </div>
                  {groupPanel === 'invites' ? (
                    <div className="rounded-xl bg-white/4">
                      <div className="flex items-center mb-2">
                        <BackButton onClick={() => setGroupPanel('none')} />
                        <strong className="text-white">Zaproszenia do grup</strong>
                      </div>
                      {showGroupInvitesSpinner ? (
                        <div className="flex justify-center items-center h-40">
                          <span className="inline-block animate-spin rounded-full border-4 border-emerald-400 border-t-transparent w-8 h-8" />
                        </div>
                      ) : invitesError ? (
                        <div className="text-xs text-red-400">{invitesError}</div>
                      ) : groupInvites.length === 0 ? (
                        <div className="text-xs text-white/60 px-2 py-3">Brak zaproszeń</div>
                      ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                          {invitesLoading && groupInvites.length > 0 && (
                            <div className="flex justify-center items-center py-1">
                              <span className="inline-block animate-spin rounded-full border-2 border-emerald-300 border-t-transparent w-5 h-5" />
                            </div>
                          )}
                          {groupInvites.map((inv: GroupInvite) => (
                            <div key={inv.id} className="flex items-center justify-between gap-3 bg-white/5 rounded-lg px-3 py-2">
                              <div className="min-w-0">
                                <div className="text-sm text-white truncate">{inv.groupName}</div>
                                <div className="text-xs text-white/50 truncate">Od: {inv.fromName ?? inv.fromPublicId ?? 'Użytkownik'}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="primary"
                                  onClick={async () => {
                                    try {
                                      await acceptInvite(inv.id);
                                    } catch (err) {
                                      // ignore UI errors for now
                                    }
                                  }}
                                >
                                  Akceptuj
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={async () => {
                                    try {
                                      await rejectInvite(inv.id);
                                    } catch (err) {
                                      // ignore UI errors for now
                                    }
                                  }}
                                >
                                  Odrzuć
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="mb-2 text-sm text-white/60">Lista grup</div>
                      {showGroupsSpinner ? (
                        <div className="flex justify-center items-center h-40">
                          <span className="inline-block animate-spin rounded-full border-4 border-emerald-400 border-t-transparent w-8 h-8" />
                        </div>
                      ) : groupsError ? (
                        <div className="text-xs text-red-400 mt-2">{groupsError}</div>
                      ) : groups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40">
                          <NowaGrupaButton onClick={() => setCreateGroupOpen(true)} />
                        </div>
                      ) : (
                        <>
                          {groupsLoading && groups.length > 0 && (
                            <div className="flex justify-center items-center py-2">
                              <span className="inline-block animate-spin rounded-full border-2 border-emerald-300 border-t-transparent w-5 h-5" />
                            </div>
                          )}
                          <ul className="space-y-0">
                            {groups
                              .filter((g) =>
                                groupQuery.trim().length === 0
                                  ? true
                                  : (g.name?.toLowerCase() ?? '').includes(groupQuery.trim().toLowerCase())
                              )
                              .map((g) => {
                                const chatId = getChatId('group', g.id);
                                const unread = unreadMessageCounts[g.id] || 0;
                                return (
                                  <GroupRow
                                    key={g.id}
                                    group={g}
                                    unread={unread}
                                    unreadInvite={isInviteUnread(g.id)}
                                    isMenuOpen={openMenuGroupId === g.id}
                                    menuRef={groupMenuRef}
                                    onOpenChat={handleOpenGroupChat}
                                    onOpenMenu={handleOpenGroupMenu}
                                    onAction={handleGroupAction}
                                    onCloseMenu={handleCloseGroupMenu}
                                  />
                                );
                              })}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
      </nav>
    </>
  );
}