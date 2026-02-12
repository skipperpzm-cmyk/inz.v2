"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Button from '../ui/button';
import { useToast } from '../toast/ToastProvider';

export default function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Hasła muszą być takie same.');
      return;
    }
    setError('');
    setLoading(true);
    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          throw new Error(data.message ?? 'Nie można się zarejestrować.');
        }
        toast.push({ type: 'success', message: data.message ?? 'Konto utworzone' });
        router.push('/login?registered=1');
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-glass backdrop-blur-2xl space-y-5"
    >
      <div className="space-y-1">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-300/70">Załóż konto</p>
        <h2 className="text-2xl font-semibold text-white">Zacznij planowanie</h2>
      </div>
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
        <label className="block text-sm text-slate-200/80">Nazwa użytkownika</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          type="text"
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
      <div>
        <label className="block text-sm text-slate-200/80">Potwierdź hasło</label>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          type="password"
          className="mt-1 w-full px-3 py-2"
          required
        />
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="flex items-center justify-between">
        <Button type="submit" disabled={loading}>
          {loading ? 'Rejestrowanie...' : 'Zarejestruj się'}
        </Button>
        <Link href="/login" className="text-sm text-slate-200/80 hover:text-white">
          Masz już konto?
        </Link>
      </div>
    </form>
  );
}
