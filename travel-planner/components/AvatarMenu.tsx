"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './toast/ToastProvider';
import { profileHref } from '../lib/profileUrl';

type UserProp = {
  id: string;
  email: string;
  username?: string | null;
  publicId?: string | null;
  avatarUrl?: string | null;
};

function initials(nameOrEmail: string) {
  const parts = nameOrEmail.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AvatarMenu({ user }: { user: UserProp }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const ref = useRef<HTMLDivElement | null>(null);
  

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const onLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (!res.ok) throw new Error('Wylogowanie nie powiodło się');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:changed', { detail: { status: 'logged-out' } }));
      }
      toast.push({ type: 'success', message: 'Wylogowano' });
      router.push('/');
    } catch (err) {
      // Graceful handling: keep menu open and log
      // In a real app, show toast
      // console.error(err);
      toast.push({ type: 'error', message: 'Wylogowanie nie powiodło się' });
      setOpen(false);
      router.push('/');
    }
  };

  const bgColor = 'bg-white/6';

  return (
    <div ref={ref} className="relative">
      <button
        aria-haspopup="true"
        aria-expanded={open}
          onClick={async () => {
            // Use `profileHref` helper to construct ID-based profile URL (public_id or internal id)
            const href = profileHref((user as any)?.publicId ?? (user as any)?.public_id ?? user?.id ?? null);
            if (href) {
              router.push(href);
              return;
            }
            toast.push({ type: 'error', message: 'Profil publiczny niedostępny' });
          }}
        className="flex items-center gap-3 focus:outline-none"
      >
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white ${bgColor} overflow-hidden transition duration-150`}
          aria-hidden
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={user.username ?? user.email} className="w-full h-full rounded-full object-cover" />
          ) : (
            <span>{initials(user.username ?? user.email)}</span>
          )}
        </div>
        <span className="hidden sm:inline-block text-sm text-slate-200">{user.username ?? user.email}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-40 rounded-xl bg-white/6 backdrop-blur-md border border-white/10 shadow-lg p-2 z-50 animate-fadeIn"
        >
          <button
            onClick={onLogout}
            role="menuitem"
            className="w-full text-left px-3 py-2 rounded-md text-sm text-white focus:outline-none"
          >
            Wyloguj się
          </button>
        </div>
      )}
    </div>
  );
}
