"use client";
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserGroupIcon, MagnifyingGlassIcon, UserPlusIcon, UserIcon, UserMinusIcon } from '@heroicons/react/24/outline';
import { ChevronLeftIcon as ChevronLeftSolid } from '@heroicons/react/24/solid';
import { useChat } from './chat/ChatContext';
import AddFriendInline from './AddFriendInline';
import FriendInvitesIcon from './FriendInvitesIcon';
import FriendRequests from './FriendRequests';
import { useFriendContext, FriendRelationState } from './FriendContext';
import { useGroupContext, Group, GroupInvite, Member } from './GroupContext';
import Modal from './Modal';
import Button from './ui/button';

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

function NowaGrupaButton({ onClick }: { onClick: () => void }) {
  const [isPressed, setIsPressed] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      className={
        `mt-2 flex items-center justify-center rounded-full py-[8px] text-xs font-semibold tracking-tight focus:outline-none bg-gradient-to-r from-[#10B981] via-[#22C55E] to-[#84CC16] text-white transition-transform duration-100 hover:brightness-110 hover:ring-2 hover:ring-emerald-400/40${isPressed ? ' scale-95' : ''}`
      }
      style={{ paddingLeft: '10px', paddingRight: '10px' }}
    >
      <UserGroupIcon className="w-4 h-4 text-white mr-1" aria-hidden />
      <span>Nowa grupa</span>
    </button>
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
      <div
        className="w-full text-left rounded-lg transition group bg-transparent hover:bg-indigo-400/30 transition-transform duration-100"
        style={{ cursor: 'pointer' }}
        onClick={handleClick}
        tabIndex={0}
        role="button"
        aria-pressed={isPressed}
      >
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
            <div className="text-sm truncate transition-colors duration-200 text-white group-hover:text-indigo-100 group-focus:text-indigo-50">{name}</div>
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

type FriendSelectRowProps = {
  friend: { id: string; name: string; publicId?: string | null; avatarUrl?: string | null; online?: boolean };
  selected: boolean;
  onToggle: (id: string) => void;
};

const FriendSelectRow = React.memo(function FriendSelectRow({ friend, selected, onToggle }: FriendSelectRowProps) {
  const [isPressed, setIsPressed] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 bg-white/5 rounded-lg px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-xs font-semibold text-white">
          {friend.avatarUrl ? (
            <img src={friend.avatarUrl} alt="Avatar" className="w-7 h-7 rounded-full object-cover" />
          ) : (
            (friend.name || '??').slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <div className="text-sm text-white truncate">{friend.name}</div>
          <div className="text-xs text-white/50 truncate">ID: {friend.publicId ?? '—'}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onToggle(friend.id)}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-transform duration-100 ${
          selected
            ? 'bg-emerald-500/80 text-white'
            : 'bg-white/10 text-white hover:bg-white/20'
        }${isPressed ? ' scale-95' : ''}`}
      >
        {selected ? 'Dodano' : 'Dodaj do grupy'}
      </button>
    </div>
  );
});

type GroupRowProps = {
  group: Group;
  unread: number;
  unreadInvite: boolean;
  isMenuOpen: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onOpenChat: (id: string, name: string, chatId: string) => void;
  onOpenMenu: (id: string) => void;
  onAction: (id: string, action: 'rename' | 'invite' | 'remove' | 'leave') => void;
  onCloseMenu: () => void;
};

const GroupRow = React.memo(function GroupRow({
  group,
  unread,
  unreadInvite,
  isMenuOpen,
  menuRef,
  onOpenChat,
  onOpenMenu,
  onAction,
  onCloseMenu,
}: GroupRowProps) {
  const chatId = `group:${group.id}`;
  const [isPressed, setIsPressed] = useState(false);
  const canManage = group.role === 'admin';

  const handleClick = () => {
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 125);
    onOpenChat(group.id, group.name, chatId);
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
      <div
        className="w-full text-left rounded-lg transition group bg-transparent hover:bg-indigo-400/30 transition-transform duration-100"
        style={{ cursor: 'pointer' }}
        onClick={handleClick}
        tabIndex={0}
        role="button"
        aria-pressed={isPressed}
      >
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center text-sm font-semibold text-white relative">
            {(group.name || '??').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-sm truncate transition-colors duration-200 text-white group-hover:text-indigo-100 group-focus:text-indigo-50">
                {group.name}
              </div>
              {unreadInvite && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/90 text-[10px] font-semibold text-white">
                  NOWA
                </span>
              )}
            </div>
            <div className="text-xs text-white/60 truncate">ID: {group.id}</div>
            <div className="text-xs text-white/40">{group.memberCount} członków</div>
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
          onOpenMenu(group.id);
        }}
      >
        <span className="text-base font-bold select-none flex items-center justify-center w-4 h-4">...</span>
      </button>
      {isMenuOpen && (
        <div
          ref={menuRef}
          className="absolute right-2 top-10 z-[9999] w-40 py-1 px-1 text-xs rounded-md shadow-lg border transition-all duration-200 ease-out origin-top-right bg-white text-gray-900 border-white/10 dark:bg-gray-900 dark:text-white dark:border-gray-700"
          style={{
            minWidth: 120,
            maxWidth: 180,
            maxHeight: 160,
            overflow: 'auto',
            transform: isMenuOpen ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-8px)',
            opacity: isMenuOpen ? 1 : 0,
            pointerEvents: isMenuOpen ? 'auto' : 'none',
          }}
        >
          <button
            type="button"
            className={`w-full text-left px-1.5 py-1 rounded flex items-center gap-2 transition-colors ${
              canManage ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 cursor-not-allowed'
            }`}
            disabled={!canManage}
            onClick={() => {
              onCloseMenu();
              if (canManage) onAction(group.id, 'rename');
            }}
          >
            <span>Zmień nazwę</span>
          </button>
          <button
            type="button"
            className={`w-full text-left px-1.5 py-1 rounded flex items-center gap-2 transition-colors ${
              canManage ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 cursor-not-allowed'
            }`}
            disabled={!canManage}
            onClick={() => {
              onCloseMenu();
              if (canManage) onAction(group.id, 'invite');
            }}
          >
            <span>Dodaj członka</span>
          </button>
          <button
            type="button"
            className={`w-full text-left px-1.5 py-1 rounded flex items-center gap-2 transition-colors ${
              canManage ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 cursor-not-allowed'
            }`}
            disabled={!canManage}
            onClick={() => {
              onCloseMenu();
              if (canManage) onAction(group.id, 'remove');
            }}
          >
            <span>Usuń członka</span>
          </button>
          <button
            type="button"
            className="w-full text-left px-1.5 py-1 rounded flex items-center gap-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
            onClick={() => {
              onCloseMenu();
              onAction(group.id, 'leave');
            }}
          >
            <span>Opuść grupę</span>
          </button>
        </div>
      )}
    </motion.li>
  );
});

export default function RightSidebar() {
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [openMenuFriendId, setOpenMenuFriendId] = useState<string | null>(null);
  const [openMenuGroupId, setOpenMenuGroupId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const groupMenuRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const invitesBtnRef = useRef<HTMLButtonElement | null>(null);
  const addBtnRef = useRef<HTMLButtonElement | null>(null);
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
  const [panel, setPanel] = useState<'none' | 'add' | 'invites'>('none');
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
    markAllNotificationsRead,
    createGroup,
    inviteToGroup,
    acceptInvite,
    rejectInvite,
    removeMember,
    leaveGroup,
    renameGroup,
    fetchMembers,
    refreshInvites,
  } = useGroupContext();

  useEffect(() => {
    if (panel !== 'invites') return;
    markInvitesRead();
  }, [panel, pendingInvites, markInvitesRead]);

  useEffect(() => {
    if (active !== 'groups') return;
    markAllNotificationsRead();
  }, [active, markAllNotificationsRead]);

  useEffect(() => {
    if (active !== 'groups' && groupPanel !== 'none') {
      setGroupPanel('none');
    }
  }, [active, groupPanel]);

  useEffect(() => {
    if (groupPanel !== 'invites') return;
    markGroupInviteNotificationsRead();
    refreshInvites();
  }, [groupPanel, markGroupInviteNotificationsRead, refreshInvites]);

  const displayedFriends = panel === 'none' && query.trim().length > 0
    ? friends.filter((f: Friend) =>
        (f.name?.toLowerCase() ?? '').includes(query.trim().toLowerCase()) ||
        (f.publicId?.toLowerCase() ?? '').includes(query.trim().toLowerCase())
      )
    : friends;

  const groupUnreadTotal = unreadGroupInviteCount + Object.values(unreadMessageCounts).reduce((sum, v) => sum + v, 0);

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
      <nav className="flex flex-col w-72 h-full p-4 bg-white/5 backdrop-blur-2xl shadow-glass rounded-2xl overflow-visible">
        
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
                <UserGroupIcon className="w-4 h-4" />
                <span>Grupy</span>
                {groupUnreadTotal > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-500 text-white min-w-[1.25rem]">
                    {groupUnreadTotal}
                  </span>
                )}
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
                  <div className="flex items-center justify-between mb-3 mt-1">
                    <div className="text-sm text-white/60">Twoje grupy</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next = groupPanel === 'invites' ? 'none' : 'invites';
                          setGroupPanel(next);
                          if (next === 'invites') {
                            markGroupInviteNotificationsRead();
                            refreshInvites();
                          }
                        }}
                        className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-white bg-white/10 hover:bg-white/20 transition"
                      >
                        <span>Zaproszenia</span>
                        {unreadGroupInviteCount > 0 && (
                          <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-500 text-white min-w-[1.25rem]">
                            {unreadGroupInviteCount}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateGroupOpen(true)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-white bg-emerald-500/80 hover:bg-emerald-500 transition"
                      >
                        <UserGroupIcon className="w-4 h-4" />
                        <span>Nowa grupa</span>
                      </button>
                    </div>
                  </div>
                  {groupPanel === 'invites' ? (
                    <div className="rounded-xl bg-white/4">
                      <div className="flex items-center mb-2">
                        <BackButton onClick={() => setGroupPanel('none')} />
                        <strong className="text-white">Zaproszenia do grup</strong>
                      </div>
                      {invitesLoading ? (
                        <div className="flex justify-center items-center h-40">
                          <span className="inline-block animate-spin rounded-full border-4 border-emerald-400 border-t-transparent w-8 h-8" />
                        </div>
                      ) : invitesError ? (
                        <div className="text-xs text-red-400">{invitesError}</div>
                      ) : groupInvites.length === 0 ? (
                        <div className="text-xs text-white/60 px-2 py-3">Brak zaproszeń.</div>
                      ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto">
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
                  ) : groupsLoading ? (
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
                    <AnimatePresence>
                      <motion.ul
                        className="space-y-0"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.4 }}
                      >
                        {groups.map((g) => {
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
                      </motion.ul>
                    </AnimatePresence>
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