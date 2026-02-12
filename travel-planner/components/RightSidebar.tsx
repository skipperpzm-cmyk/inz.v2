"use client";
import React, { useEffect, useState, useRef, useCallback } from 'react';
// Back button with scale animation
function BackButton({ onClick }: { onClick: () => void }) {
  const [isPressed, setIsPressed] = useState(false);
    return (
      <button
        onClick={onClick}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        className={`flex items-center justify-center w-7 h-7 text-white hover:text-indigo-300 outline-none border-none mr-2 ml-[2px] transition-all duration-100 hover:bg-white/10 rounded-full${isPressed ? ' scale-95' : ''}`}
        aria-label="Powrót"
        style={{ boxShadow: 'none', border: 'none' }}
      >
        <GradientChevronLeftIcon className="w-5 h-5" />
      </button>
    );
}
// ...existing code...
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserGroupIcon, MagnifyingGlassIcon, UserPlusIcon, UserIcon } from '@heroicons/react/24/outline';
import { UserMinusIcon } from '@heroicons/react/24/outline';
import { ChevronLeftIcon as ChevronLeftSolid } from '@heroicons/react/24/solid';
import { useChat } from './chat/ChatContext';
import AddFriendInline from './AddFriendInline';
import FriendInvitesIcon from './FriendInvitesIcon';
import FriendRequests from './FriendRequests';
import { useFriendContext, FriendRelationState } from './FriendContext';
import useUserGroups from '../hooks/useUserGroups';

// If UserMinusIcon is not available, define a custom SVG icon
// representing a user with a minus sign
// Uncomment below if needed:
/*
const UserMinusIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a4 4 0 10-8 0 4 4 0 008 0zm6 8v-2a4 4 0 00-3-3.87M6 20v-2a4 4 0 013-3.87M16 11h6" />
  </svg>
);
*/
function DodajZnajomegoButton({ onClick }: { onClick: () => void }) {
  const [isPressed, setIsPressed] = useState(false);
  const handleMouseDown = () => setIsPressed(true);
  const handleMouseUp = () => setIsPressed(false);
  const handleMouseLeave = () => setIsPressed(false);
  const handleClick = () => { onClick(); };
  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      className={
        `mt-2 flex items-center justify-center rounded-full py-[8px] text-xs font-semibold tracking-tight focus:outline-none bg-gradient-to-r from-[#5865F2] via-[#7C3AED] to-[#A78BFA] text-indigo-100 transition-transform duration-100 hover:brightness-110 hover:ring-2 hover:ring-indigo-400/40${isPressed ? ' scale-95' : ''}`
      }
      style={{ paddingLeft: '10px', paddingRight: '10px' }}
    >
      <UserPlusIcon className="w-4 h-4 text-white mr-1" aria-hidden />
      <span>Dodaj pierwszego znajomego</span>
    </button>
  );
}

function GradientChevronLeftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <defs>
        <linearGradient id="chevron-gradient" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818cf8" />
          <stop offset="0.5" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <ChevronLeftSolid fill="url(#chevron-gradient)" width={20} height={20} />
    </svg>
  );
}

type FriendRowProps = {
  id: string;
  name: string;
  publicId?: string | null;
  avatarUrl?: string | null;
  online?: boolean;
  // isActive: boolean; // usunięte, niepotrzebne
  unread: number;
  isMenuOpen: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  relationState: FriendRelationState;
  onOpenChat: (id: string, name: string, avatarUrl: string | null, chatId: string) => void;
  onOpenMenu: (id: string) => void;
  onConfirmRemove: (id: string) => void;
  onCloseMenu: () => void;
};

const FriendRow = React.memo(function FriendRow({
  id,
  name,
  publicId,
  avatarUrl,
  online,
  // isActive, // usunięte, niepotrzebne
  unread,
  isMenuOpen,
  menuRef,
  relationState,
  onOpenChat,
  onOpenMenu,
  onConfirmRemove,
  onCloseMenu,
}: FriendRowProps) {
  const chatId = `friend:${id}`;
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = () => {
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 125);
    onOpenChat(id, name, avatarUrl ?? null, chatId);
  };

  return (
    <motion.li
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      layout
      className="py-0.5 m-0 relative"
    >
      <div className="w-full text-left rounded-lg transition group bg-transparent hover:bg-indigo-400/30 transition-transform duration-100" style={{cursor: 'pointer'}} onClick={handleClick} tabIndex={0} role="button" aria-pressed={isPressed}>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center text-sm font-semibold text-white relative">
            <div className={`absolute right-[6px] bottom-[6px] w-2 h-2 rounded-full transition-colors duration-200 ${online ? 'bg-green-400' : 'bg-gray-400'}`} aria-hidden="true"></div>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              (name || '??').slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className={"text-sm truncate transition-colors duration-200 text-white group-hover:text-indigo-100 group-focus:text-indigo-50"}>{name}</div>
            <div className="text-xs text-white/60">ID: {publicId ?? '—'}</div>
          </div>
          {unread > 0 && (
            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-red-500 text-white min-w-[1.5rem] h-5 transition-all duration-300 animate-fadein">
              {unread}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity ml-2 rounded-full text-white hover:bg-white/10 focus:bg-white/20 flex items-center justify-center w-7 h-7 p-0 absolute top-1 right-1"
        tabIndex={-1}
        aria-label="Więcej akcji"
        onClick={(e) => {
          e.stopPropagation();
          onOpenMenu(id);
        }}
      >
        <span className="text-base font-bold select-none flex items-center justify-center w-4 h-4">...</span>
      </button>
      {isMenuOpen && (
        <div
          ref={menuRef}
          className="absolute right-2 top-10 z-[999] w-32 py-1 px-1 text-xs rounded-md shadow-lg border transition-all duration-200 ease-out origin-top-right bg-white text-gray-900 border-white/10 dark:bg-gray-900 dark:text-white dark:border-gray-700"
          style={{
            minWidth: 96,
            maxWidth: 140,
            maxHeight: 120,
            overflow: 'auto',
            transform: isMenuOpen ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-8px)',
            opacity: isMenuOpen ? 1 : 0,
            pointerEvents: isMenuOpen ? 'auto' : 'none',
          }}
        >
          <button
            type="button"
            className={`w-full text-left px-1.5 py-1 rounded flex items-center gap-2 transition-colors
              ${relationState === FriendRelationState.FRIENDS
                ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-400 cursor-not-allowed bg-transparent'}
            `}
            disabled={relationState !== FriendRelationState.FRIENDS}
            onClick={() => {
              onCloseMenu();
              if (relationState === FriendRelationState.FRIENDS) {
                onConfirmRemove(id);
              }
            }}
          >
            <UserMinusIcon className="w-4 h-4 mr-1 text-red-500 dark:text-red-400" aria-hidden="true" />
            <span>Usuń znajomego</span>
          </button>
        </div>
      )}
    </motion.li>
  );
});

export default function RightSidebar() {
  // Dropdown menu state for friend actions
  const [openMenuFriendId, setOpenMenuFriendId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const invitesBtnRef = useRef<HTMLButtonElement | null>(null);
  const addBtnRef = useRef<HTMLButtonElement | null>(null);

  // Type declarations
  type Friend = { id: string; name: string; publicId?: string | null; avatarUrl?: string | null; online?: boolean };

  // All hooks/state at the top
  const { openChat, openGroupChat, chats, unreadCounts, resetUnread } = useChat();
  const [active, setActive] = useState<'friends' | 'groups'>('friends');
  const [panel, setPanel] = useState<'none' | 'add' | 'invites'>('none');
  const [query, setQuery] = useState('');
  const { friends, friendsLoading, friendsError, pendingInvites, sentInvites, unreadInviteCount, markInvitesRead, sendInvite, getRelationState, unfriend } = useFriendContext();
  const { groups, loading: groupsLoading, error: groupsError } = useUserGroups();
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  useEffect(() => {
    if (panel !== 'invites') return;
    markInvitesRead();
  }, [panel, pendingInvites, markInvitesRead]);

  const displayedFriends = panel === 'none' && query.trim().length > 0
    ? friends.filter((f: Friend) =>
        (f.name?.toLowerCase() ?? '').includes(query.trim().toLowerCase()) ||
        (f.publicId?.toLowerCase() ?? '').includes(query.trim().toLowerCase())
      )
    : friends;

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

  const handleOpenMenu = useCallback((id: string) => {
    setOpenMenuFriendId(id);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setOpenMenuFriendId(null);
  }, []);

  const handleConfirmRemove = useCallback((id: string) => {
    setConfirmRemoveId(id);
  }, []);

  // Modal state for friend removal confirmation
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const friendToRemove = friends.find(fr => fr.id === confirmRemoveId);
  const removeModal = confirmRemoveId && (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      {/* Modal card */}
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
              setConfirmRemoveId(null);
            }}
            autoFocus
          >Tak</button>
          <button
            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold shadow hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/60 transition"
            onClick={() => setConfirmRemoveId(null)}
          >Nie</button>
        </div>
      </div>
    </div>
  );

  // Much larger delay for empty friends list, and smooth slide-in
  const [showEmptyButton, setShowEmptyButton] = useState(false);
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
      <nav className="flex flex-col w-72 h-full p-4 bg-white/5 backdrop-blur-2xl shadow-glass rounded-2xl overflow-visible">
        {/* AddFriendSearch removed: wyszukiwarka na górze right sidebar usunięta */}
        <div className="sticky top-0 z-20 -mx-4 px-4 pb-2 bg-transparent">
          <div className="flex w-full justify-center">
            <div role="tablist" className="inline-flex w-auto gap-2 bg-white/5 rounded-full p-1 shadow-inner border border-white/10">
              <button
                onClick={() => setActive('friends')}
                className={`px-4 py-2 text-sm rounded-full transition flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${active === 'friends' ? 'bg-indigo-500/80 text-white' : 'text-white/70 hover:bg-white/10'}`}
                style={{ minWidth: 100 }}
              >
                <UserIcon className="w-4 h-4" /> Znajomi
              </button>
              <button
                onClick={() => setActive('groups')}
                className={`px-4 py-2 text-sm rounded-full transition flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${active === 'groups' ? 'bg-indigo-500/80 text-white' : 'text-white/70 hover:bg-white/10'}`}
                style={{ minWidth: 100 }}
              >
                <UserGroupIcon className="w-4 h-4" /> Grupy
              </button>
            </div>
          </div>
          <div className="pt-3 border-b border-white/10" />
        </div>

        <div className="flex-1 overflow-y-auto px-1 py-2" style={{ position: 'relative', height: 420 }}>
          <div className="relative w-full h-[420px]">
            <div className="absolute inset-0 h-[420px]" style={{ opacity: active === 'friends' ? 1 : 0, pointerEvents: active === 'friends' ? 'auto' : 'none' }}>
              {active === 'friends' && (
                <div className="h-full overflow-y-auto">
                  <div className="flex items-center gap-2 mb-3 mt-1">
                    <div className="relative flex-1 min-w-0">
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Szukaj znajomego"
                        className="w-full px-3 py-2 rounded-lg bg-white/6 border border-white/10 text-white text-xs placeholder:text-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ml-[2px]"
                      />
                      <MagnifyingGlassIcon className="w-4 h-4 absolute right-3 top-2.5 text-white/60" />
                    </div>
                    <button
                      type="button"
                      ref={invitesBtnRef}
                      onClick={() => {
                        const next = panel === 'invites' ? 'none' : 'invites';
                        setPanel(next);
                        if (next === 'invites') {
                          markInvitesRead();
                        }
                      }}
                      aria-label="Zaproszenia do znajomych"
                      className="relative inline-flex items-center justify-center w-9 h-9 rounded-md bg-white/6 hover:bg-white/10 text-white transition-colors focus:outline-none border-none shadow-none"
                      onMouseEnter={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ text: 'Zaproszenia do znajomych', x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {/* Badge: liczba nieodczytanych zaproszeń */}
                      <FriendInvitesIcon count={unreadInviteCount} />
                    </button>
                    <button
                      type="button"
                      ref={addBtnRef}
                      onClick={() => setPanel((p) => p === 'add' ? 'none' : 'add')}
                      aria-label="Dodaj znajomych"
                      className="relative inline-flex items-center justify-center w-9 h-9 rounded-md bg-white/6 hover:bg-white/10 text-white transition-colors focus:outline-none border-none shadow-none"
                      onMouseEnter={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ text: 'Dodaj znajomych', x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <UserPlusIcon className="w-4 h-4" />
                    </button>
                          {/* Tooltip for buttons, rendered via portal for fixed positioning */}
                          {tooltip && createPortal(
                            <span
                              style={{
                                position: 'fixed',
                                left: tooltip.x,
                                top: tooltip.y,
                                transform: 'translate(-50%, 0)',
                                zIndex: 9999,
                                background: 'rgba(0,0,0,0.92)',
                                color: 'white',
                                fontSize: '12px',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                pointerEvents: 'none',
                                whiteSpace: 'nowrap',
                                boxShadow: '0 2px 8px 0 rgba(0,0,0,0.18)'
                              }}
                            >
                              {tooltip.text}
                            </span>,
                            document.body
                          )}
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
                        <strong className="text-white">Zaproszenia</strong>
                      </div>
                      <FriendRequests setTooltip={setTooltip} />
                    </div>
                  )}

                  {panel === 'none' && (
                    <div>
                      <div className="mb-2 text-sm text-white/60">Lista znajomych</div>
                      {friendsLoading ? (
                        <div className="flex justify-center items-center h-40">
                          <span className="inline-block animate-spin rounded-full border-4 border-indigo-400 border-t-transparent dark:border-indigo-300 dark:border-t-transparent w-8 h-8" />
                        </div>
                      ) : friendsError ? (
                        <div className="text-xs text-red-400">{friendsError}</div>
                      ) : displayedFriends.length === 0 && showEmptyButton ? (
                        <div className="flex flex-col items-center justify-center h-40">
                          <AnimatePresence>
                            {showEmptyButton && (
                              <motion.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 16 }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                              >
                                <DodajZnajomegoButton onClick={() => setPanel('add')} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : (
                        <AnimatePresence>
                          <motion.ul
                            className="space-y-0"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.4 }}
                          >
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
                          </motion.ul>
                        </AnimatePresence>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="absolute inset-0 transition-opacity duration-200 h-[420px]" style={{ opacity: active === 'groups' ? 1 : 0, pointerEvents: active === 'groups' ? 'auto' : 'none' }}>
              {active === 'groups' && (
                <div className="h-[420px] overflow-y-auto">
                  <div className="text-sm text-white/60">Twoje grupy</div>
                  {groupsLoading ? (
                    <div className="text-xs text-white/60 mt-2">Ładowanie...</div>
                  ) : groupsError ? (
                    <div className="text-xs text-red-400 mt-2">{groupsError.message}</div>
                  ) : groups.length === 0 ? (
                    <div className="text-xs text-white/60 mt-2">Brak grup</div>
                  ) : (
                    <ul className="space-y-0 mt-2">
                      {groups.map((g) => {
                        const chatId = getChatId('group', g.id);
                        const unread = unreadCounts[chatId] || 0;
                        const isActive = currentChatId === chatId;
                        return (
                          <li key={g.id} className="py-0.5 m-0">
                            <button
                              onClick={() => {
                                openGroupChat(g.id, g.name);
                                resetUnread(chatId);
                                setCurrentChatId(chatId);
                              }}
                              className={`w-full text-left rounded-lg transition group bg-transparent focus:outline-none ${isActive ? 'bg-indigo-500/80 text-white font-bold shadow-lg' : 'hover:bg-indigo-400/30 focus:bg-indigo-500/40'}`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center text-sm font-semibold text-white">
                                  {(g.name || '??').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-sm truncate transition-colors duration-200 ${isActive ? 'text-white' : 'text-white group-hover:text-indigo-100 group-focus:text-indigo-50'}`}>{g.name}</div>
                                  <div className="text-xs text-white/60">{g.is_private ? 'Prywatna' : 'Publiczna'}</div>
                                </div>
                                {unread > 0 && (
                                  <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-red-500 text-white min-w-[1.5rem] h-5 transition-all duration-300 animate-fadein">
                                    {unread}
                                  </span>
                                )}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}

