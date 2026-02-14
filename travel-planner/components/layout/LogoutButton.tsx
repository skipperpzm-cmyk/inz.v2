"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '../toast/ToastProvider';
import { ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline';

export default function LogoutButton() {
  const router = useRouter();
  const toast = useToast();

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
      toast.push({ type: 'error', message: 'Wylogowanie nie powiodło się' });
    }
  };

  return (
    <button
      onClick={onLogout}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/6 border border-white/8 text-sm text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40"
      aria-label="Wyloguj się"
    >
      <ArrowLeftOnRectangleIcon className="w-4 h-4 text-current" aria-hidden="true" />
      <span>Wyloguj się</span>
    </button>
  );
}
