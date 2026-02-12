"use client";

import React, { useState } from 'react';
import Button from '../../components/ui/button';
import { useRouter } from 'next/navigation';
import { useToast } from '../../components/toast/ToastProvider';

export default function GroupCreateForm() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Nazwa jest wymagana');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, is_private: isPrivate }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to create group');
      toast.push({ type: 'success', message: 'Grupa utworzona' });
      router.push('/dashboard/groups');
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Nie udało się utworzyć grupy';
      setError(msg);
      toast.push({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white/5 rounded-2xl">
      <h2 className="text-lg font-semibold text-white mb-4">Utwórz nową grupę</h2>

      <div className="mb-4">
        <label className="block text-sm text-slate-300 mb-2">Nazwa</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/6 border border-white/10 text-white" placeholder="Nazwa grupy" />
      </div>

      <div className="mb-4">
        <label className="block text-sm text-slate-300 mb-2">Opis (opcjonalny)</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/6 border border-white/10 text-white resize-none" rows={4} />
      </div>

      <div className="mb-4 flex items-center gap-2">
        <input id="isPrivate" type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="w-4 h-4" />
        <label htmlFor="isPrivate" className="text-sm text-slate-300">Prywatna (tylko członkowie widzą grupę)</label>
      </div>

      {error && <div className="text-sm text-red-400 mb-3">{error}</div>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>{saving ? 'Tworzenie…' : 'Utwórz grupę'}</Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={saving}>Anuluj</Button>
      </div>
    </form>
  );
}
