"use client";
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { CheckIcon, UserGroupIcon, UserPlusIcon, UserIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useChat } from './chat/ChatContext';
import AddFriendInline from './AddFriendInline';
import FriendInvitesIcon from './FriendInvitesIcon';
import FriendRequests from './FriendRequests';
import { useFriendContext } from './FriendContext';
import { useGroup } from '../hooks/useGroup';
import type { GroupInvite } from '../types/group';
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
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createGroupName, setCreateGroupName] = useState('');
  const [createGroupFriendIds, setCreateGroupFriendIds] = useState<string[]>([]);
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);
  const [createGroupLoading, setCreateGroupLoading] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [inviteFriendId, setInviteFriendId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoadingGroupId, setInviteLoadingGroupId] = useState<string | null>(null);
  const [confirmLeaveGroupId, setConfirmLeaveGroupId] = useState<string | null>(null);
  const [leaveGroupLoading, setLeaveGroupLoading] = useState(false);
  const [leaveGroupError, setLeaveGroupError] = useState<string | null>(null);
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
    invites: groupInvites,
    status,
    errors,
    unreadGroupIds,
    unreadInviteIds,
    markGroupsRead,
    markInvitesRead: markGroupInvitesRead,
    createGroup,
    inviteMembers,
    leaveGroup,
    acceptInvite,
    rejectInvite,
  } = useGroup();

  // Reset tab notification when new invite arrives
  useEffect(() => {
    if (unreadInviteCount > 0) setInviteTabRead(false);
  }, [unreadInviteCount]);
  useEffect(() => {
    if (unreadInviteIds.size > 0) setGroupTabRead(false);
  }, [unreadInviteIds]);

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
    markGroupInvitesRead();
  }, [groupPanel, groupInvites, markGroupInvitesRead]);

  const displayedFriends = panel === 'none' && query.trim().length > 0
    ? friends.filter((f: Friend) =>
        (f.name?.toLowerCase() ?? '').includes(query.trim().toLowerCase()) ||
        (f.publicId?.toLowerCase() ?? '').includes(query.trim().toLowerCase())
      )
    : friends;

  const unreadGroupInviteCount = unreadInviteIds.size;
  const showFriendsSpinner = friendsLoading && friends.length === 0;
  const showGroupsSpinner = status.groups === 'loading' && groups.length === 0;
  const showGroupInvitesSpinner = status.invites === 'loading' && groupInvites.length === 0;

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
    markGroupsRead([id]);
    setCurrentChatId(chatId);
  }, [openGroupChat, resetUnread, markGroupsRead]);

  const handleOpenMenu = useCallback((id: string) => {
    setOpenMenuFriendId(id);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setOpenMenuFriendId(null);
  }, []);

  const handleOpenGroupMenu = useCallback((id: string) => {
    setOpenMenuGroupId((prev) => (prev === id ? null : id));
  }, []);

  const handleCloseGroupMenu = useCallback(() => {
    setOpenMenuGroupId(null);
  }, []);

  const handleGroupAction = useCallback(async (id: string, action: 'rename' | 'invite' | 'remove' | 'leave' | 'manage') => {
    if (action === 'manage') {
      try {
        window.dispatchEvent(new CustomEvent('openGroupManagement', { detail: { groupId: id } }));
      } catch {
        // ignore
      }
      return;
    }

    if (action === 'leave') {
      setLeaveGroupError(null);
      setConfirmLeaveGroupId(id);
      return;
    }
  }, [leaveGroup]);

  const handleConfirmRemove = useCallback((id: string) => {
    setConfirmRemoveId(id);
  }, []);

  const handleInviteToGroup = useCallback((id: string) => {
    setInviteError(null);
    setInviteFriendId(id);
  }, []);

  const ownedGroups = groups.filter((g) => g.createdBy && g.createdBy === currentGroupUserId);
  const canInviteToAnyOwnedGroup = ownedGroups.length > 0;
  const friendToInvite = friends.find((fr) => fr.id === inviteFriendId) || null;
  const groupToLeave = groups.find((g) => g.id === confirmLeaveGroupId) || null;

  // Modal state for friend removal confirmation
  const friendToRemove = friends.find(fr => fr.id === confirmRemoveId);
  const removeModal = (
    <Modal
      open={Boolean(confirmRemoveId)}
      onClose={() => setConfirmRemoveId(null)}
      title={undefined}
      showCloseButton={true}
    >
      <div className="p-6 max-w-md mx-auto overflow-hidden" style={{overflow:'hidden', maxWidth:'400px', maxHeight:'90vh'}}>
        <div className="mb-4 pb-4 border-b border-white/10">
          <div className="text-xl font-semibold text-white text-center">Czy na pewno chcesz usunąć znajomego?</div>
          {friendToRemove && (
            <div className="flex flex-col items-center mt-4">
              {friendToRemove.avatarUrl ? (
                <img src={friendToRemove.avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full object-cover mb-2 border border-white/20" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-lg text-white mb-2 border border-white/20">
                  <UserIcon className="w-8 h-8 text-white/60" />
                </div>
              )}
              <div className="text-base font-medium text-white mt-1">{friendToRemove.name}</div>
              <div className="text-xs text-white/50">{friendToRemove.publicId ?? '—'}</div>
            </div>
          )}
        </div>
        <div className="flex justify-center gap-2 mt-6">
          <Button type="button" variant="ghost" onClick={() => setConfirmRemoveId(null)}>
            Anuluj
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={async () => {
              if (!confirmRemoveId) return;
              await unfriend(confirmRemoveId);
              setConfirmRemoveId(null);
            }}
          >Usuń</Button>
        </div>
      </div>
    </Modal>
  );

  const inviteModal = (
    <Modal open={Boolean(inviteFriendId)} onClose={() => setInviteFriendId(null)} title={undefined} showCloseButton={true}>
      <div className="p-6 max-w-3xl">
        <div className="mb-4 pb-4 border-b border-white/10">
          <div className="text-xl font-semibold text-white">Zaproś do grupy</div>
          {friendToInvite && (
            <div className="text-sm text-white/60 mt-1">{friendToInvite.name}</div>
          )}
        </div>
        {ownedGroups.length === 0 ? (
          <div className="text-sm text-white/60">Nie masz jeszcze własnej grupy.</div>
        ) : (
          <div className="space-y-2">
            {ownedGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                className="w-full text-left px-3 py-2 rounded-lg bg-white/6 hover:bg-white/10 text-white text-sm transition disabled:opacity-60"
                disabled={inviteLoadingGroupId === g.id}
                onClick={async () => {
                  if (!inviteFriendId) return;
                  setInviteError(null);
                  setInviteLoadingGroupId(g.id);
                  try {
                    await inviteMembers(g.id, [inviteFriendId]);
                    setInviteFriendId(null);
                  } catch (err: any) {
                    setInviteError(err?.message || 'Nie udało się wysłać zaproszenia');
                  } finally {
                    setInviteLoadingGroupId(null);
                  }
                }}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}
        {inviteError && <div className="mt-3 text-xs text-red-400">{inviteError}</div>}
      </div>
    </Modal>
  );
  // ...existing code...

  const createGroupModal = (
    <Modal open={createGroupOpen} onClose={() => setCreateGroupOpen(false)} title={undefined}>
      <div className="p-6">
        <div className="mb-4 pb-4 border-b border-white/10">
          <div className="text-xl font-semibold text-white">Nowa grupa</div>
        </div>
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
          className="space-y-6"
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
      </div>
    </Modal>
  );

  const leaveGroupModal = (
    <Modal
      open={Boolean(confirmLeaveGroupId)}
      onClose={() => {
        if (leaveGroupLoading) return;
        setConfirmLeaveGroupId(null);
        setLeaveGroupError(null);
      }}
      title={undefined}
      showCloseButton={true}
    >
      <div className="p-6">
        <div className="mb-4 pb-4 border-b border-white/10">
          <div className="text-xl font-semibold text-white">Czy na pewno chcesz opuścić grupę?</div>
          {groupToLeave && <div className="text-sm text-white/60 mt-1">{groupToLeave.name}</div>}
        </div>
        {leaveGroupError && <div className="text-xs text-red-400 mb-3">{leaveGroupError}</div>}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={leaveGroupLoading}
            onClick={() => {
              setConfirmLeaveGroupId(null);
              setLeaveGroupError(null);
            }}
          >
            nie
          </Button>
          <Button
            type="button"
            disabled={leaveGroupLoading || !confirmLeaveGroupId}
            onClick={async () => {
              if (!confirmLeaveGroupId) return;
              setLeaveGroupError(null);
              setLeaveGroupLoading(true);
              try {
                await leaveGroup(confirmLeaveGroupId);
                setConfirmLeaveGroupId(null);
              } catch (err: any) {
                setLeaveGroupError(err?.message || 'Nie udało się opuścić grupy');
              } finally {
                setLeaveGroupLoading(false);
              }
            }}
          >
            {leaveGroupLoading ? 'Trwa…' : 'tak'}
          </Button>
        </div>
      </div>
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

  return (
    <>
      {removeModal}
      {inviteModal}
      {createGroupModal}
      {leaveGroupModal}
      <TooltipPortal tooltip={tooltip} />
      <nav className="right-sidebar-panel flex flex-col w-72 h-full p-4 bg-white/5 backdrop-blur-2xl shadow-glass rounded-2xl overflow-visible">
        
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
              />
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
                                  onInviteToGroup={handleInviteToGroup}
                                  canInviteToGroup={canInviteToAnyOwnedGroup}
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
                          if (unreadGroupInviteCount > 0) markGroupInvitesRead();
                        }}
                      >
                        <FriendInvitesIcon count={unreadGroupInviteCount} ariaLabel="Zaproszenia do grup" />
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
                      ) : errors.invites ? (
                        <div className="text-xs text-red-400">{errors.invites}</div>
                      ) : groupInvites.length === 0 ? (
                        <div className="text-xs text-white/60 px-2 py-3">Brak zaproszeń</div>
                      ) : (
                        <div className="w-full max-w-md mx-auto rounded-lg py-1">
                          {status.invites === 'loading' && groupInvites.length > 0 && (
                            <div className="flex justify-center items-center py-1">
                              <span className="inline-block animate-spin rounded-full border-2 border-emerald-300 border-t-transparent w-5 h-5" />
                            </div>
                          )}
                          <ul className="space-y-2">
                            {groupInvites.map((inv: GroupInvite) => (
                              <li key={inv.id} className="py-0.5 m-0 relative">
                                <div className="w-full text-left rounded-lg transition group bg-transparent hover:bg-indigo-400/30 transition-transform duration-100 flex items-center gap-2 pr-[5px]">
                                  <div className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center text-sm font-semibold text-white relative overflow-hidden">
                                    {inv.groupAvatarUrl ? (
                                      <img
                                        src={inv.groupAvatarUrl}
                                        alt={inv.groupName || 'Grupa'}
                                        className="w-full h-full object-cover rounded-full"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <span>{(inv.groupName || '??').slice(0, 2).toUpperCase()}</span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm truncate transition-colors duration-200 text-white group-hover:text-indigo-100 group-focus:text-indigo-50">{inv.groupName}</div>
                                    <div className="text-xs text-white/60 truncate">Od: {inv.fromName ?? inv.fromPublicId ?? 'Użytkownik'}</div>
                                  </div>
                                  <button
                                    aria-label="Akceptuj zaproszenie do grupy"
                                    className="w-6 h-6 flex items-center justify-center rounded-full border border-green-400 text-green-500 hover:bg-green-500 hover:text-white transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-green-300 -ml-[2px]"
                                    onClick={async (e) => {
                                      setTooltip(null);
                                      e.currentTarget.blur();
                                      try {
                                        await acceptInvite(inv.id);
                                      } catch {
                                        // ignore UI errors for now
                                      }
                                    }}
                                    onMouseEnter={e => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setTooltip({ text: 'Akceptuj', x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                                    }}
                                    onMouseLeave={() => setTooltip(null)}
                                    onFocus={e => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setTooltip({ text: 'Akceptuj', x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                                    }}
                                    onBlur={() => setTooltip(null)}
                                  >
                                    <CheckIcon className="w-3 h-3" />
                                  </button>
                                  <button
                                    aria-label="Odrzuć zaproszenie do grupy"
                                    className="w-6 h-6 flex items-center justify-center rounded-full border border-red-400 text-red-500 hover:bg-red-500 hover:text-white transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-red-300 -ml-[2px]"
                                    onClick={async (e) => {
                                      setTooltip(null);
                                      e.currentTarget.blur();
                                      try {
                                        await rejectInvite(inv.id);
                                      } catch {
                                        // ignore UI errors for now
                                      }
                                    }}
                                    onMouseEnter={e => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setTooltip({ text: 'Odrzuć', x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                                    }}
                                    onMouseLeave={() => setTooltip(null)}
                                    onFocus={e => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setTooltip({ text: 'Odrzuć', x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                                    }}
                                    onBlur={() => setTooltip(null)}
                                  >
                                    <XMarkIcon className="w-3 h-3" />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
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
                      ) : errors.groups ? (
                        <div className="text-xs text-red-400 mt-2">{errors.groups}</div>
                      ) : groups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40">
                          <NowaGrupaButton onClick={() => setCreateGroupOpen(true)} />
                        </div>
                      ) : (
                        <>
                          {status.groups === 'loading' && groups.length > 0 && (
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
                                const unread = unreadCounts[getChatId('group', g.id)] || 0;
                                return (
                                  <GroupRow
                                    key={g.id}
                                    group={g}
                                    unread={unread}
                                    unreadInvite={unreadGroupIds.has(g.id)}
                                    isMenuOpen={openMenuGroupId === g.id}
                                    onOpenChat={handleOpenGroupChat}
                                    onOpenMenu={handleOpenGroupMenu}
                                    onAction={handleGroupAction}
                                    onCloseMenu={handleCloseGroupMenu}
                                    isCreator={g.createdBy === currentGroupUserId}
                                    setTooltip={setTooltip}
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