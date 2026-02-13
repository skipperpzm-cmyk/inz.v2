"use client";
import React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import LogoutButton from './layout/LogoutButton';
import { Cog6ToothIcon, PlusIcon, BellIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { getIconForHref } from './icons';
import { profileHref } from '../lib/profileUrl';

type UserProp = {
  id: string;
  email: string;
  username?: string | null;
  publicId?: string | null;
  avatarUrl?: string | null;
};

function PrimaryNewTrip({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const handleClick = () => {
    if (disabled) return;
    router.push('/dashboard/newtrip');
  };

  return (
      <button
      type="button"
      onClick={handleClick}
      aria-label="Nowa podróż"
      disabled={disabled}
      aria-disabled={disabled ? 'true' : undefined}
      className={`sidebar-new-trip-btn relative inline-flex w-full items-center justify-center bg-gradient-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transform transition-all duration-500 ease-in-out hover:scale-[1.02] hover:brightness-110 hover:animate-pulse active:scale-[0.95] active:duration-100 active:ease-in-out focus:outline-none ${
        disabled ? 'opacity-60 cursor-not-allowed pointer-events-none hover:scale-100 hover:brightness-100 hover:animate-none' : ''
      }`}
    >
      <PlusIcon className="w-4 h-4 text-white mr-2" aria-hidden />
      <span>Nowa podróż</span>
    </button>
  );
}

type SidebarProps = {
  onNavigate?: () => void;
  user?: UserProp | null;
  readOnly?: boolean;
};

export default function Sidebar({ onNavigate, user, readOnly = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [groupsOpen, setGroupsOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [avatarUrl, setAvatarUrl] = React.useState<string | null | undefined>(user?.avatarUrl);
  const [displayName, setDisplayName] = React.useState<string>(user?.username ?? user?.email ?? '');
  // Use ID-based profile links
  const bellRef = React.useRef<HTMLButtonElement | null>(null);
  const popupRef = React.useRef<HTMLDivElement | null>(null);
  const [popupPos, setPopupPos] = React.useState<{ left: number; top: number } | null>(null);

  React.useEffect(() => {
    setAvatarUrl(user?.avatarUrl);
    setDisplayName(user?.username ?? user?.email ?? '');
  }, [user?.avatarUrl, user?.email, user?.username]);

  const profileLink = React.useMemo(() => {
    return user ? profileHref((user as any)?.publicId ?? (user as any)?.public_id ?? user.id) : null;
  }, [user]);

  // Ensure client-side shows the latest username after login (client nav may cause a race).
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/user/me');
        if (!res.ok) return;
        const json = await res.json();
        if (!mounted) return;
        if (json.usernameDisplay || json.username) {
          setDisplayName(json.usernameDisplay ?? json.username);
        }
        if (json.avatarUrl) setAvatarUrl(json.avatarUrl);
      } catch (err) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  React.useEffect(() => {
    function onAvatarUpdate(e: Event) {
      const custom = e as CustomEvent<string>;
      setAvatarUrl(custom.detail);
    }
    window.addEventListener('avatar-updated', onAvatarUpdate as EventListener);
    return () => window.removeEventListener('avatar-updated', onAvatarUpdate as EventListener);
  }, []);

  React.useEffect(() => {
    function onPseudonimUpdate(e: Event) {
      const custom = e as CustomEvent<string>;
      if (typeof custom.detail === 'string') setDisplayName(custom.detail);
    }
    window.addEventListener('pseudonim-updated', onPseudonimUpdate as EventListener);
    return () => window.removeEventListener('pseudonim-updated', onPseudonimUpdate as EventListener);
  }, []);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node | null;
      const clickedInsideBell = bellRef.current && bellRef.current.contains(target);
      const clickedInsidePopup = popupRef.current && popupRef.current.contains(target);
      if (!clickedInsideBell && !clickedInsidePopup) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [notifOpen]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setNotifOpen(false);
    }
    if (notifOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [notifOpen]);

  React.useEffect(() => {
    if (!notifOpen) {
      setPopupPos(null);
      return;
    }

    // When opened by clicking the bell we compute and set `popupPos` synchronously
    // in the click handler so the portal mounts with correct coords. This effect
    // only attaches listeners to keep the popup in place while open (resize/scroll).
    function positionPopup() {
      const bell = bellRef.current;
      const popup = popupRef.current;
      if (!bell) return;
      const bellRect = bell.getBoundingClientRect();
      const popupWidth = popup ? popup.offsetWidth : 224; // tailwind w-56 = 14rem = 224px
      const popupHeight = popup ? popup.offsetHeight : 200;

      let left = Math.round(bellRect.left);
      let top = Math.round(bellRect.top);

      const margin = 8;
      if (left + popupWidth > window.innerWidth - margin) left = window.innerWidth - popupWidth - margin;
      if (top + popupHeight > window.innerHeight - margin) top = window.innerHeight - popupHeight - margin;
      if (left < margin) left = margin;
      if (top < margin) top = margin;

      // update on viewport changes (do not call on initial mount to avoid flashes)
      setPopupPos({ left, top });
    }

    window.addEventListener('resize', positionPopup);
    window.addEventListener('scroll', positionPopup, true);
    return () => {
      window.removeEventListener('resize', positionPopup);
      window.removeEventListener('scroll', positionPopup, true);
    };
  }, [notifOpen]);

  // Toggle handler that computes popup position BEFORE showing it to avoid initial jump
  const handleToggleNotif = () => {
    if (notifOpen) {
      setNotifOpen(false);
      return;
    }
    const bell = bellRef.current;
    if (!bell) return; // cannot anchor without the bell element

    const bellRect = bell.getBoundingClientRect();
    const popupWidth = 224; // tailwind w-56 = 14rem = 224px
    const popupHeight = 200; // estimate
    const margin = 8;

    let left = Math.round(bellRect.left);
    let top = Math.round(bellRect.top);
    if (left + popupWidth > window.innerWidth - margin) left = window.innerWidth - popupWidth - margin;
    if (top + popupHeight > window.innerHeight - margin) top = window.innerHeight - popupHeight - margin;
    if (left < margin) left = margin;
    if (top < margin) top = margin;

    // Set position synchronously before opening so the portal mounts in-place
    setPopupPos({ left, top });
    setNotifOpen(true);
  };

  const coreNav = [
    { href: '/dashboard', label: 'Przegląd' },
    { href: '/dashboard/trips', label: 'Podróże' },
    { href: '/dashboard/boards', label: 'Tablice' },
    { href: '/dashboard/calendar', label: 'Kalendarz' },
  ];

  const orgNav = [
    { href: '/dashboard/notes', label: 'Notatki' },
    { href: '/dashboard/stats', label: 'Statystyki' },
  ];

  const libraryNav = [
    { href: '/dashboard/saved', label: 'Zapisane' },
    { href: '/dashboard/archive', label: 'Archiwum' },
  ];

  const systemNav = [
    { href: '/about', label: 'O aplikacji' },
  ];

  const groupsNav = [
    { href: '/dashboard/groups', label: 'Grupy' },
  ];

  return (
    <>
    <nav className="flex flex-col w-72 h-full p-4 bg-white/5 backdrop-blur-2xl shadow-glass rounded-2xl">
      {/* Avatar + user identity: TOP, always visible */}
      {user && (
        <div className="mb-4 px-2 relative">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0 w-full">
              {profileLink ? (
                <Link
                  href={profileLink}
                  className="flex-shrink-0"
                  onClick={() => onNavigate?.()}
                  onKeyDown={(e) => {
                    // support Space and Enter for keyboard activation
                    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
                      e.preventDefault();
                      router.push(profileLink);
                    }
                  }}
                >
                  <div role="link" tabIndex={0} className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white bg-white/6 overflow-hidden">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt={displayName || user?.email || 'Użytkownik'} className="w-full h-full object-cover" />
                    ) : (
                      <span>{(displayName || user?.email || '').slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                </Link>
              ) : (
                <div
                  aria-disabled="true"
                  title="Profil publiczny niedostępny"
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white bg-white/6 overflow-hidden opacity-70 cursor-default"
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt={displayName || user?.email || 'Użytkownik'} className="w-full h-full object-cover" />
                  ) : (
                    <span>{(displayName || user?.email || '').slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{displayName || user.email}</div>
                <div className="text-xs text-slate-300">Zalogowano</div>
              </div>
            </div>

            <div className="flex-shrink-0">
              <button
                ref={bellRef}
                type="button"
                aria-label="Powiadomienia"
                aria-expanded={notifOpen}
                onClick={handleToggleNotif}
                className="relative w-9 h-9 rounded-lg flex items-center justify-center text-slate-200 hover:text-white hover:bg-indigo-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition"
              >
                <BellIcon className="w-5 h-5 block" aria-hidden />
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-red-500 rounded-full">3</span>
              </button>
            </div>
          </div>

          {/* popup rendered to body via portal to avoid stacking-context issues */}
        </div>
      )}

      <div className="my-2 h-px bg-white/6 rounded-full" />

      <div className="px-2 mb-3">
        <PrimaryNewTrip disabled={readOnly} />
      </div>

      <div className="flex-1 overflow-y-auto px-1 space-y-4">
        <div>
          <div className="px-3 mb-2">
            <div className="text-xs uppercase tracking-widest text-white/40">Podstawy</div>
          </div>
          <ul className="space-y-1">
            {coreNav.map((it) => renderItem(it, pathname, onNavigate, readOnly))}
          </ul>
        </div>

        <div className="my-2 h-px bg-white/6 rounded-full" />

        <div>
          <div className="px-3 mb-2">
            <div className="text-xs uppercase tracking-widest text-white/40">Organizacja</div>
          </div>
          <ul className="space-y-1">
            {orgNav.map((it) => renderItem(it, pathname, onNavigate, readOnly))}
          </ul>
        </div>

        <div className="my-2 h-px bg-white/6 rounded-full" />

        <div>
          <div className="px-3 mb-2">
            <div className="text-xs uppercase tracking-widest text-white/40">Biblioteka</div>
          </div>
          <ul className="space-y-1">
            {libraryNav.map((it) => renderItem(it, pathname, onNavigate, readOnly))}
          </ul>
        </div>

        <div className="my-2 h-px bg-white/6 rounded-full" />

        <div>
          <div className="px-3 mb-2">
            <div className="text-xs uppercase tracking-widest text-white/40">System</div>
          </div>
          <ul className="space-y-1">
            {systemNav.map((it) => renderItem(it, pathname, onNavigate, readOnly))}
          </ul>
        </div>
        <div className="my-2 h-px bg-white/6 rounded-full" />

        <div>
          <div className="px-3 mb-2">
            <div className="text-xs uppercase tracking-widest text-white/40">Groups</div>
          </div>
          <div className="px-3">
              <button
              type="button"
              aria-expanded={groupsOpen}
              onClick={() => setGroupsOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition transform-gpu focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 bg-white/5 text-slate-200 hover:text-white hover:bg-indigo-500/10"
            >
              <span className="flex items-center gap-2">
                <PlusIcon className="w-4 h-4 text-slate-300" aria-hidden />
                <span>Groups</span>
              </span>
              <ChevronRightIcon className={`w-4 h-4 transform transition ${groupsOpen ? 'rotate-90' : ''}`} aria-hidden />
            </button>

            {groupsOpen && (
              <ul className="mt-2 space-y-1">
                {groupsNav.map((it) => {
                  const active = pathname === it.href || (it.href !== '/dashboard/groups' && pathname?.startsWith(it.href));
                  return (
                    <li key={it.href}>
                      <Link href={it.href} onClick={() => onNavigate?.()} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${active ? 'bg-indigo-500/20 text-indigo-100 font-semibold' : 'text-slate-200 hover:text-white hover:bg-indigo-500/10'}`}>
                        {it.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {user && (
        <div className="mt-auto pt-4">
          <div className="border-t border-white/6 pt-4 flex items-center justify-between">
            <div className="flex items-center">
              {!readOnly && (
                <Link
                  href="/dashboard/settings/profile"
                  aria-label="Ustawienia"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/6 border border-white/8 text-sm text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
                >
                  {/* Heroicons Cog (outline) */}
                    <Cog6ToothIcon className="w-5 h-5 text-white" aria-hidden="true" />
                </Link>
              )}
            </div>

            <div className="flex items-center">
              <div className="flex-shrink-0">
                {readOnly ? (
                  <span className="inline-flex items-center rounded-lg bg-white/6 px-3 py-2 text-xs font-semibold text-slate-200 uppercase tracking-wide opacity-80 cursor-default">
                    Podgląd
                  </span>
                ) : (
                  <LogoutButton />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
      {typeof document !== 'undefined' && notifOpen && popupPos && createPortal(
        <div
          ref={popupRef}
          style={{ left: '290px', top: '75px' }}
          className="fixed z-[9999] w-56 bg-slate-900 rounded-md p-1 text-sm text-slate-200 shadow-glass"
          role="menu"
          aria-label="Powiadomienia"
        >
          <ul className="divide-y divide-white/6">
            {[
              'Nowa wiadomość od Ani: Hej, jedziemy?',
              'Potwierdzenie rezerwacji #2342',
              'Przypomnienie: Spakuj dokumenty przed podróżą',
            ].map((txt, idx) => (
              <li key={idx}>
                <button
                  role="menuitem"
                  tabIndex={0}
                  onClick={() => setNotifOpen(false)}
                  className="w-full text-left px-3 py-2 hover:bg-indigo-500/10 focus:bg-indigo-500/10 rounded-md transition"
                >
                  {txt}
                </button>
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </>
  );
}

function renderItem(it: { href: string; label: string }, pathname?: string | null, onNavigate?: () => void, readOnly?: boolean) {
  const active = pathname === it.href || (it.href !== '/dashboard' && pathname?.startsWith(it.href));
  const IconComp = getIconForHref(it.href);
  const baseClasses = `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition transform-gpu focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
    active ? 'bg-indigo-500/20 text-indigo-100 font-semibold shadow-inner' : 'text-slate-200/80 hover:text-white hover:bg-indigo-500/10'
  }`;
  const content = (
    <>
      <span className={`w-6 h-6 flex items-center justify-center flex-shrink-0 align-middle ${active ? 'text-white' : 'text-slate-300'}`} aria-hidden>
        <IconComp />
      </span>
      <span className="flex-1 min-w-0 leading-none">{it.label}</span>
    </>
  );

  if (readOnly) {
    return (
      <li key={it.href}>
        <div role="link" aria-disabled="true" className={`${baseClasses} opacity-70 cursor-not-allowed pointer-events-none`}>
          {content}
        </div>
      </li>
    );
  }

  return (
    <li key={it.href}>
      <Link href={it.href} onClick={() => onNavigate?.()} className={`${baseClasses} cursor-pointer`}>
        {content}
      </Link>
    </li>
  );
}

/*
  Sidebar: client component that highlights the active link and keeps consistent width.
  Props:
  - onNavigate: optional callback (useful for closing mobile drawer after navigation)
*/

