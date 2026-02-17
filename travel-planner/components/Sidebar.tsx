"use client";
import React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import LogoutButton from './layout/LogoutButton';
import { Cog6ToothIcon, PlusIcon, BellIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { getIconForHref } from './icons';
import { profileHref } from '../lib/profileUrl';
import { getBrowserSupabase } from '../lib/supabaseClient';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  entityId?: string | null;
  readAt: string | null;
  createdAt: string | null;
  payload?: Record<string, any>;
};

type UserProp = {
  id: string;
  email: string;
  username?: string | null;
  publicId?: string | null;
  avatarUrl?: string | null;
};

function PrimaryNewTrip({ disabled, onNavigate }: { disabled?: boolean; onNavigate: () => void }) {
  const handleClick = () => {
    if (disabled) return;
    onNavigate();
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

const isPublicRoute = (pathname: string) => {
  if (pathname === '/' || pathname === '/login' || pathname === '/register' || pathname === '/signin') {
    return true;
  }
  return pathname.startsWith('/demo') || pathname.startsWith('/u/');
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
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = React.useState(false);
  const [notificationsUnread, setNotificationsUnread] = React.useState(0);
  const [notificationActionPendingId, setNotificationActionPendingId] = React.useState<string | null>(null);

  const loadNotifications = React.useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setNotificationsUnread(0);
      return;
    }
    setNotificationsLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=8', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const items = Array.isArray(data?.items) ? (data.items as NotificationItem[]) : [];
      setNotifications(items);
      setNotificationsUnread(Number(data?.unreadCount ?? 0));
    } catch {
      // ignore transient fetch/network aborts
    } finally {
      setNotificationsLoading(false);
    }
  }, [user]);

  const getNotificationInviteId = React.useCallback((item: NotificationItem) => {
    const payloadInviteId = item.payload && typeof item.payload.inviteId === 'string' ? item.payload.inviteId : '';
    const payloadBoardId = item.payload && typeof item.payload.boardId === 'string' ? item.payload.boardId : '';
    if (item.type === 'board_invite') {
      return payloadInviteId || payloadBoardId || item.entityId || '';
    }
    return payloadInviteId;
  }, []);

  const isBoardInviteActionable = React.useCallback(
    (item: NotificationItem) => item.type === 'board_invite' && Boolean(getNotificationInviteId(item)),
    [getNotificationInviteId]
  );

  const runBoardInviteAction = React.useCallback(
    async (item: NotificationItem, action: 'accept' | 'reject') => {
      const inviteId = getNotificationInviteId(item);
      if (!inviteId || notificationActionPendingId) return;
      setNotificationActionPendingId(item.id);
      try {
        const res = await fetch(`/api/boards/invites/${encodeURIComponent(inviteId)}/${action}`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) return;

        await fetch('/api/notifications', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [item.id] }),
        });

        await loadNotifications();
      } catch {
        // ignore transient network errors; list will refresh via realtime/poll
      } finally {
        setNotificationActionPendingId(null);
      }
    },
    [getNotificationInviteId, loadNotifications, notificationActionPendingId]
  );

  React.useEffect(() => {
    setAvatarUrl(user?.avatarUrl);
    setDisplayName(user?.username ?? user?.email ?? '');
  }, [user?.avatarUrl, user?.email, user?.username]);

  React.useEffect(() => {
    if (!user) return;
    void loadNotifications();
  }, [user, loadNotifications]);

  React.useEffect(() => {
    if (!user?.id) return;
    const supabase = getBrowserSupabase();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const refreshRealtimeToken = async () => {
      try {
        const tokenRes = await fetch('/api/supabase/realtime-token', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!tokenRes.ok) return false;
        const tokenJson = await tokenRes.json().catch(() => ({}));
        if (cancelled) return false;
        if (typeof tokenJson?.token === 'string') {
          supabase.realtime.setAuth(tokenJson.token);
          return true;
        }
      } catch {
        // ignore
      }
      return false;
    };

    (async () => {
      const authed = await refreshRealtimeToken();
      if (!authed || cancelled) return;

      channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void loadNotifications();
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id, loadNotifications]);

  const profileLink = React.useMemo(() => {
    return user ? profileHref((user as any)?.publicId ?? (user as any)?.public_id ?? user.id) : null;
  }, [user]);

  // Ensure client-side shows the latest username after login (client nav may cause a race).
  React.useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      if (typeof window !== 'undefined' && isPublicRoute(window.location.pathname)) {
        if (mounted) {
          setDisplayName('');
          setAvatarUrl(null);
        }
        return;
      }
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
    };
    if (user) loadUser();
    const onAuthChanged = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.status === 'logged-out') {
        setDisplayName('');
        setAvatarUrl(null);
      } else {
        loadUser();
      }
    };
    window.addEventListener('auth:changed', onAuthChanged);
    return () => { mounted = false; window.removeEventListener('auth:changed', onAuthChanged); };
  }, [user]);

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

    const unreadIds = notifications.filter((item) => !item.readAt).map((item) => item.id);
    if (unreadIds.length > 0) {
      fetch('/api/notifications', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unreadIds }),
      })
        .then(() => loadNotifications())
        .catch(() => null);
    }
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

  const isActiveHref = React.useCallback(
    (href: string) => pathname === href || (href !== '/dashboard' && Boolean(pathname?.startsWith(href))),
    [pathname]
  );

  const navigateWithRefresh = React.useCallback(
    (href: string) => {
      onNavigate?.();
      if (isActiveHref(href)) {
        router.refresh();
        return;
      }

      router.push(href);
      setTimeout(() => router.refresh(), 0);
    },
    [isActiveHref, onNavigate, router]
  );

  const navigateWithoutRefresh = React.useCallback(
    (href: string) => {
      onNavigate?.();
      if (isActiveHref(href)) return;
      router.push(href);
    },
    [isActiveHref, onNavigate, router]
  );

  const handleNavClick = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      if (readOnly) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      navigateWithRefresh(href);
    },
    [navigateWithRefresh, readOnly]
  );

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
                {notificationsUnread > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-xs font-semibold text-white bg-red-500 rounded-full">
                    {notificationsUnread > 99 ? '99+' : notificationsUnread}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* popup rendered to body via portal to avoid stacking-context issues */}
        </div>
      )}

      <div className="my-2 h-px bg-white/6 rounded-full" />

      <div className="px-2 mb-3">
        <PrimaryNewTrip disabled={readOnly} onNavigate={() => navigateWithRefresh('/dashboard/newtrip')} />
      </div>

      <div className="flex-1 overflow-y-auto px-1 space-y-4">
        <div>
          <div className="px-3 mb-2">
            <div className="text-xs uppercase tracking-widest text-white/40">Podstawy</div>
          </div>
          <ul className="space-y-1">
            {coreNav.map((it) => renderItem(it, pathname, onNavigate, readOnly, handleNavClick))}
          </ul>
        </div>

        <div className="my-2 h-px bg-white/6 rounded-full" />

        <div>
          <div className="px-3 mb-2">
            <div className="text-xs uppercase tracking-widest text-white/40">Organizacja</div>
          </div>
          <ul className="space-y-1">
            {orgNav.map((it) => renderItem(it, pathname, onNavigate, readOnly, handleNavClick))}
          </ul>
        </div>

        <div className="my-2 h-px bg-white/6 rounded-full" />

        <div>
          <div className="px-3 mb-2">
            <div className="text-xs uppercase tracking-widest text-white/40">Biblioteka</div>
          </div>
          <ul className="space-y-1">
            {libraryNav.map((it) => renderItem(it, pathname, onNavigate, readOnly, handleNavClick))}
          </ul>
        </div>

        <div className="my-2 h-px bg-white/6 rounded-full" />

        <div>
          <div className="px-3 mb-2">
            <div className="text-xs uppercase tracking-widest text-white/40">System</div>
          </div>
          <ul className="space-y-1">
            {systemNav.map((it) => renderItem(it, pathname, onNavigate, readOnly, handleNavClick))}
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
                      <Link href={it.href} onClick={(event) => handleNavClick(event, it.href)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${active ? 'bg-indigo-500/20 text-indigo-100 font-semibold' : 'text-slate-200 hover:text-white hover:bg-indigo-500/10'}`}>
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
                  onClick={(event) => handleNavClick(event, '/dashboard/settings/profile')}
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
          style={{ left: `${popupPos.left}px`, top: `${popupPos.top}px` }}
          className="fixed z-[9999] w-56 bg-slate-900 rounded-md p-1 text-sm text-slate-200 shadow-glass"
          role="menu"
          aria-label="Powiadomienia"
        >
          {notificationsLoading ? (
            <div className="px-3 py-2 text-xs text-white/60">Ładowanie…</div>
          ) : notifications.length === 0 ? (
            <div className="px-3 py-2 text-xs text-white/60">Brak powiadomień</div>
          ) : (
            <ul className="divide-y divide-white/6">
              {notifications.map((item) => {
                const targetHref = item.type === 'group_invite'
                  ? '/dashboard/groups'
                  : item.type === 'friend_invite'
                    ? '/dashboard'
                    : '/dashboard/notifications';
                const description = item.message || item.title;
                const boardInviteActionable = isBoardInviteActionable(item);
                const actionPending = notificationActionPendingId === item.id;
                return (
                  <li key={item.id}>
                    <div className={`w-full text-left px-3 py-2 rounded-md transition ${item.readAt ? 'text-white/80 hover:bg-indigo-500/10' : 'bg-indigo-500/10 text-white hover:bg-indigo-500/20'}`}>
                      <button
                        role="menuitem"
                        tabIndex={0}
                        onClick={() => {
                          setNotifOpen(false);
                          navigateWithoutRefresh(targetHref);
                        }}
                        className="w-full text-left"
                      >
                        <div className="text-xs font-semibold truncate">{item.title}</div>
                        <div className="text-[11px] text-white/70 truncate mt-0.5">{description}</div>
                      </button>
                      {boardInviteActionable && (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            disabled={actionPending}
                            onClick={() => {
                              void runBoardInviteAction(item, 'accept');
                            }}
                            className="app-text-btn-gradient inline-flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                          >
                            {actionPending ? '...' : 'Akceptuj'}
                          </button>
                          <button
                            type="button"
                            disabled={actionPending}
                            onClick={() => {
                              void runBoardInviteAction(item, 'reject');
                            }}
                            className="inline-flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-semibold text-red-200 hover:text-white hover:bg-red-500/20 disabled:opacity-60"
                          >
                            Odrzuć
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            className="w-full mt-1 px-3 py-2 text-left text-xs text-indigo-200 hover:text-white hover:bg-indigo-500/10 rounded-md transition"
            onClick={() => {
              setNotifOpen(false);
              navigateWithoutRefresh('/dashboard/notifications');
            }}
          >
            Zobacz wszystkie
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

function renderItem(
  it: { href: string; label: string },
  pathname: string | null | undefined,
  onNavigate: (() => void) | undefined,
  readOnly: boolean | undefined,
  onNavClick: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void
) {
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
      <Link href={it.href} onClick={(event) => onNavClick(event, it.href)} className={`${baseClasses} cursor-pointer`}>
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

