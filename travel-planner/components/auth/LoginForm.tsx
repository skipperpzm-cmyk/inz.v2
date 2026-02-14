"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Button from '../ui/button';
import { useToast } from '../toast/ToastProvider';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicInfo, setMagicInfo] = useState('');
  const [justRegistered, setJustRegistered] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setJustRegistered(params.get('registered') === '1');
    const token = params.get('token');
    if (!token) return;
    setError('');
    setVerifying(true);
    fetch('/api/auth/magic-link/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          throw new Error(data.message ?? 'Nie mozna zweryfikowac linku.');
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:changed', { detail: { status: 'logged-in' } }));
        }
        toast.push({ type: 'success', message: data.message ?? 'Zalogowano' });
        router.push('/dashboard');
        router.refresh();
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Nie mozna zweryfikowac linku.';
        setError(message);
      })
      .finally(() => setVerifying(false));
  }, []);

  // Lock scrolling while keeping the scrollbar visible on this page only.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

    // Ensure scrollbar is visible
    const prevOverflow = document.body.style.overflowY;
    document.body.style.overflowY = 'scroll';

    // Prevent scroll inputs
    const onWheel = (e: WheelEvent) => { e.preventDefault(); };
    const onTouch = (e: TouchEvent) => { e.preventDefault(); };
    const onKey = (e: KeyboardEvent) => {
      const blocked = ['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '];
      if (blocked.includes(e.key)) e.preventDefault();
    };

    // Reset any programmatic scrolling
    const onScroll = () => { window.scrollTo(0, scrollY); };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchmove', onTouch, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll);

    return () => {
      window.removeEventListener('wheel', onWheel as any);
      window.removeEventListener('touchmove', onTouch as any);
      window.removeEventListener('keydown', onKey as any);
      window.removeEventListener('scroll', onScroll as any);
      // restore previous overflow
      document.body.style.overflowY = prevOverflow || '';
      // restore original scroll position
      window.scrollTo(0, scrollY);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading || verifying) return; // avoid double submissions while waiting for the API response
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data.message ?? 'Nie można się zalogować.');
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:changed', { detail: { status: 'logged-in' } }));
      }
      toast.push({ type: 'success', message: data.message ?? 'Zalogowano' });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nie można się zalogować.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (magicLoading || verifying) return;
    if (!email) {
      setError('Podaj email, aby wyslac magic link.');
      return;
    }
    setError('');
    setMagicInfo('');
    setMagicLoading(true);

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data.message ?? 'Nie mozna wyslac magic linku.');
      }

      setMagicInfo(data.message ?? 'Sprawdz email, aby sie zalogowac.');
      toast.push({ type: 'success', message: data.message ?? 'Magic link wyslany' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nie mozna wyslac magic linku.';
      setError(message);
    } finally {
      setMagicLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-glass backdrop-blur-2xl space-y-5"
    >
      <div className="space-y-1">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-300/70">Witaj ponownie</p>
        <h2 className="text-2xl font-semibold text-white">Zaloguj się</h2>
      </div>
      {justRegistered && <p className="text-sm text-emerald-300">Konto utworzone — zaloguj się poniżej.</p>}
      {verifying && <p className="text-sm text-slate-200/80">Weryfikacja magic link...</p>}
      <div>
        <label className="block text-sm text-slate-200/80">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          className="mt-1 w-full px-3 py-2"
          required
        />
      </div>
      <div>
        <label className="block text-sm text-slate-200/80">Hasło</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          className="mt-1 w-full px-3 py-2"
          required
        />
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {magicInfo && <p className="text-sm text-emerald-300">{magicInfo}</p>}
      <div className="flex items-center justify-between">
        <Button type="submit" disabled={loading}>
          {loading ? 'Logowanie...' : 'Zaloguj się'}
        </Button>
        <Link href="/register" className="text-sm text-slate-200/80 hover:text-white">
          Załóż konto
        </Link>
      </div>
      <div className="flex items-center justify-between border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={handleMagicLink}
          className="text-sm text-slate-200/80 hover:text-white disabled:opacity-50"
          disabled={magicLoading}
        >
          {magicLoading ? 'Wysyłanie...' : 'Wyślij Magic Link'}
        </button>
      </div>
    </form>
  );
}
