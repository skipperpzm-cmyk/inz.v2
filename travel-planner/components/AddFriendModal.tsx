"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (data: { id: string; name: string }) => void;
};

export default function AddFriendModal({ open, onClose, onAdd }: Props) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) {
      setId(''); setName(''); setTouched(false);
    }
  }, [open]);

  const valid = useMemo(() => id.trim().length >= 2 || name.trim().length >= 2, [id, name]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    onAdd({ id: id.trim(), name: name.trim() });
    onClose();
  }

  const initials = useMemo(() => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return (id.trim().slice(0,2) || '').toUpperCase();
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }, [id, name]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-lg mx-4 bg-gray-800 rounded-2xl p-5 shadow-2xl border border-white/6">
        <button onClick={onClose} aria-label="Zamknij" className="absolute right-3 top-3 p-1 rounded-md text-white hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30">
          <XMarkIcon className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-white/6 flex items-center justify-center text-lg font-semibold text-white">{initials}</div>
          <div>
            <h3 className="text-lg font-semibold text-white">Dodaj znajomego</h3>
            <p className="text-xs text-white/60">Wprowadź publiczne ID oraz nazwę użytkownika, aby dodać do listy.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Publiczne ID</label>
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="np. u123"
              className={`w-full px-3 py-2 rounded-lg bg-white/6 border ${touched && id.trim().length > 0 && id.trim().length <= 1 ? 'border-red-500' : 'border-white/8'} text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30`}
            />
            {touched && id.trim().length > 0 && id.trim().length <= 1 && <div className="text-xs text-red-400 mt-1">ID jest zbyt krótkie (min. 2 znaki)</div>}
          </div>

          <div>
            <label className="text-xs text-white/60 mb-1 block">Nazwa</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Imię i nazwisko"
              className={`w-full px-3 py-2 rounded-lg bg-white/6 border ${touched && name.trim().length > 0 && name.trim().length <= 1 ? 'border-red-500' : 'border-white/8'} text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30`}
            />
            {touched && name.trim().length > 0 && name.trim().length <= 1 && <div className="text-xs text-red-400 mt-1">Nazwa jest zbyt krótka (min. 2 znaki)</div>}
          </div>

          {touched && !valid && (
            <div className="text-xs text-red-400 mt-1">Wprowadź publiczne ID lub nazwę (min. 2 znaki)</div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-transparent border border-white/12 text-white hover:bg-white/5 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-1"
            >
              Anuluj
            </button>

            <button
              type="submit"
              disabled={!valid}
              className={`px-4 py-2 rounded-lg text-white transition-all duration-150 ${valid ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500' : 'bg-white/10 text-white/60 cursor-not-allowed'}`}
            >
              Dodaj
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
