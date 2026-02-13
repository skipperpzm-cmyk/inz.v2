"use client";
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { MagnifyingGlassIcon, UserPlusIcon, UserMinusIcon } from '@heroicons/react/24/outline';
import { ChevronLeftIcon as ChevronLeftSolid } from '@heroicons/react/24/solid';
import { FriendRelationState } from './FriendContext';
import type { Group } from './GroupContext';

export function BackButton({ onClick }: { onClick: () => void }) {
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

export function DodajZnajomegoButton({ onClick }: { onClick: () => void }) {
  const [isPressed, setIsPressed] = useState(false);
  const handleMouseDown = () => setIsPressed(true);
  const handleMouseUp = () => setIsPressed(false);
  const handleMouseLeave = () => setIsPressed(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      className={`mt-2 flex items-center justify-center rounded-full py-[8px] text-xs font-semibold tracking-tight focus:outline-none bg-gradient-to-r from-[#5865F2] via-[#7C3AED] to-[#A78BFA] text-indigo-100 transition-transform duration-100 hover:brightness-110 hover:ring-2 hover:ring-indigo-400/40${isPressed ? ' scale-95' : ''}`}
      style={{ paddingLeft: '10px', paddingRight: '10px' }}
    >
      <UserPlusIcon className="w-5 h-5 text-white mr-1" aria-hidden />
      <span>Dodaj pierwszego znajomego</span>
    </button>
  );
}

export function NowaGrupaButton({ onClick }: { onClick: () => void }) {
  const [isPressed, setIsPressed] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      className={`mt-2 flex items-center justify-center rounded-full py-[8px] text-xs font-semibold tracking-tight focus:outline-none bg-gradient-to-r from-[#10B981] via-[#22C55E] to-[#84CC16] text-white transition-transform duration-100 hover:brightness-110 hover:ring-2 hover:ring-emerald-400/40${isPressed ? ' scale-95' : ''}`}
      style={{ paddingLeft: '10px', paddingRight: '10px' }}
    >
      <span className="mr-1" style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ position: 'relative', display: 'inline-block', width: 20, height: 20 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <svg width="8" height="8" viewBox="0 0 12 12" fill="none" style={{ position: 'absolute', right: -2, bottom: -2, zIndex: 1 }}>
            <circle cx="6" cy="6" r="6" fill="#22c55e" />
            <path d="M6 3.5v5M3.5 6h5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </span>
      </span>
      <span>Utwórz nową grupę</span>
    </button>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 text-white/60" style={{ transform: 'translateY(-50%)' }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-3 py-2 rounded-lg bg-white/6 border border-white/10 text-white text-xs placeholder:text-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ml-[2px]"
      />
    </div>
  );
}

export function TooltipPortal({ tooltip }: { tooltip: { text: string; x: number; y: number } | null }) {
  if (!tooltip) return null;
  return createPortal(
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
  );
}

export function ActionIconButton({
  ariaLabel,
  tooltipText,
  onClick,
  setTooltip,
  children,
}: {
  ariaLabel: string;
  tooltipText: string;
  onClick: () => void;
  setTooltip: (next: { text: string; x: number; y: number } | null) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-md bg-white/6 hover:bg-white/10 text-white transition-colors focus:outline-none border-none shadow-none"
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip({ text: tooltipText, x: rect.left + rect.width / 2, y: rect.bottom + 6 });
      }}
      onMouseLeave={() => setTooltip(null)}
    >
      {children}
    </button>
  );
}

export function SectionTabButton({
  active,
  label,
  icon,
  showDot,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  showDot: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2 text-sm rounded-full transition flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${active ? 'bg-indigo-500/80 text-white' : 'text-white/70 hover:bg-white/10'}`}
      style={{ minWidth: 100 }}
    >
      {icon}
      <span>{label}</span>
      {children}
      {showDot && (
        <span
          className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500 transition-opacity duration-200 opacity-100"
          aria-hidden
        />
      )}
    </button>
  );
}

type FriendRowProps = {
  id: string;
  name: string;
  publicId?: string | null;
  avatarUrl?: string | null;
  online?: boolean;
  unread: number;
  isMenuOpen: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  relationState: FriendRelationState;
  onOpenChat: (id: string, name: string, avatarUrl: string | null, chatId: string) => void;
  onOpenMenu: (id: string) => void;
  onConfirmRemove: (id: string) => void;
  onCloseMenu: () => void;
};

export const FriendRow = React.memo(function FriendRow({
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
    <li className="py-0.5 m-0 relative">
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
        <span className="text-base font-bold select-none flex items-center justify-center w-5 h-5">...</span>
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
            <UserMinusIcon className="w-5 h-5 mr-1 text-red-500 dark:text-red-400" aria-hidden="true" />
            <span>Usuń znajomego</span>
          </button>
        </div>
      )}
    </li>
  );
});

type FriendSelectRowProps = {
  friend: { id: string; name: string; publicId?: string | null; avatarUrl?: string | null; online?: boolean };
  selected: boolean;
  onToggle: (id: string) => void;
};

export const FriendSelectRow = React.memo(function FriendSelectRow({ friend, selected, onToggle }: FriendSelectRowProps) {
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

export const GroupRow = React.memo(function GroupRow({
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
    <li className="py-0.5 m-0 relative">
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
        <span className="text-base font-bold select-none flex items-center justify-center w-5 h-5">...</span>
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
    </li>
  );
});

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
