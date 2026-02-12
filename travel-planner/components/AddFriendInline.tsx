"use client";
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { UserPlusIcon } from '@heroicons/react/24/solid';
import { useToast } from './toast/ToastProvider';

type Props = {
  onAdd: (data: { id: string; name: string }) => void | Promise<void>;
  onCancel: () => void;
};

export default function AddFriendInline({ onAdd, onCancel }: Props) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  type AddFriendResult = {
    id: string;
    name: string;
    publicId?: string | null;
    avatarUrl?: string | null;
  };
  type AddFriendApiRow = {
    id: string;
    name?: string | null;
    public_id?: string | null;
    avatar_url?: string | null;
  };
  const [addFriendResults, setAddFriendResults] = useState<AddFriendResult[]>([]);
  const toast = useToast();

  const valid = useMemo(() => {
    const idTrim = id.trim();
    const nameTrim = name.trim();
    const idIsDigits = idTrim.length === 0 ? false : /^\d+$/.test(idTrim);
    return (idTrim.length >= 2 && idIsDigits) || nameTrim.length >= 2;
  }, [id, name]);

  const idHasInvalidChars = useMemo(() => {
    const idTrim = id.trim();
    if (idTrim.length === 0) return false;
    return !/^\d+$/.test(idTrim);
  }, [id]);

  function isAddFriendApiRow(value: unknown): value is AddFriendApiRow {
    return typeof value === 'object' && value !== null && 'id' in value;
  }

  useEffect(() => {
    const fetchResults = async () => {
      const query = id.trim() || name.trim();
      if (query.length < 2) {
        setAddFriendResults([]);
        return;
      }
      try {
        const res = await fetch(`/api/profiles/search-list?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          const rows = Array.isArray(data?.data) ? data.data.filter(isAddFriendApiRow) : [];
          const mapped = rows.map((r: AddFriendApiRow) => ({
            id: String(r.id),
            name: String(r.name ?? 'Nieznany'),
            publicId: r.public_id ?? null,
            avatarUrl: r.avatar_url ?? null,
          }));
          setAddFriendResults(mapped);
        } else {
          setAddFriendResults([]);
        }
      } catch {
        setAddFriendResults([]);
      }
    };
    fetchResults();
  }, [id, name]);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setTouched(true);
    setError(null);
    if (!valid) return;
    setLoading(true);
    try {
      await onAdd({ id: id.trim(), name: name.trim() });
      setId(''); setName(''); setTouched(false);
      toast.push({ message: 'Zaproszenie wysłane', type: 'success' });
    } catch (err: any) {
      const msg = err?.message ?? 'Nie udało się wysłać zaproszenia';
      setError(msg);
      toast.push({ message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  const initials = useMemo(() => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return (id.trim().slice(0,2) || '').toUpperCase();
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }, [id, name]);

  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const tooltipText = 'Dodaj do znajomych';
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Render form for manual add (with validation)
  // and render search results (with '+' button) OUTSIDE the form.
  // This ensures clicking '+' does NOT trigger form submit or validation.
  return (
    <div className="flex justify-center">
      <div className="flex-1">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="mx-1">
            <label className="text-xs text-white/60 mb-1 block">Publiczne ID</label>
            <input
              value={id}
              onChange={e => {
                // Only allow digits, max 8
                const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                setId(val);
              }}
              onBlur={() => setTouched(true)}
              className={`w-[96px] px-3 py-2 rounded-lg bg-white/6 border ${touched && id.trim().length > 0 && (id.trim().length <= 1 || idHasInvalidChars) ? 'border-red-500' : 'border-white/8'} text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30`}
              inputMode="numeric"
              maxLength={8}
              autoComplete="off"
            />
            {touched && id.trim().length > 0 && id.trim().length <= 1 && <div className="text-xs text-red-400 mt-1">ID jest zbyt krótkie (min. 2 znaki)</div>}
            {touched && idHasInvalidChars && <div className="text-xs text-red-400 mt-1">Publiczne ID może zawierać tylko cyfry</div>}
          </div>

          <div className="mx-1">
            <label className="text-xs text-white/60 mb-1 block">Nazwa</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Nazwa użytkownika"
              className={`w-full px-3 py-2 rounded-lg bg-white/6 border ${touched && name.trim().length > 0 && name.trim().length <= 1 ? 'border-red-500' : 'border-white/8'} text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30`}
            />
            {touched && name.trim().length > 0 && name.trim().length <= 1 && <div className="text-xs text-red-400 mt-1">Nazwa jest zbyt krótka (min. 2 znaki)</div>}
          </div>

          {touched && !valid && (
            <div className="text-xs text-red-400 mt-1">Wprowadź publiczne ID lub nazwę (min. 2 znaki)</div>
          )}

          {error && (
            <div className="text-xs text-red-400 mt-1">{error}</div>
          )}

          <div className="flex items-center justify-end gap-2">
            {/* Removed buttons for cancel and add */}
          </div>
        </form>

        {/* Wyniki wyszukiwania i przyciski '+' są poza <form> — kliknięcie '+' nie wywołuje walidacji! */}
        {addFriendResults.length > 0 && (
          <div className="mt-4 bg-white/6 py-1 px-0.5 rounded-lg">
            <ul className="space-y-2">
              {addFriendResults.map((result) => (
                <li key={result.id} className="flex items-center gap-3 py-1 px-0.5">
                  <div className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center text-sm font-semibold text-white">
                    {result.avatarUrl ? (
                      <img src={result.avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      (result.name || '??').slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{result.name}</div>
                    <div className="text-xs text-white/60">ID: {result.publicId}</div>
                  </div>
                  {/* Przycisk '+' nie jest w <form> i nie triggeruje submit! */}
                  <button
                    type="button"
                    className="ml-1 p-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center justify-center relative"
                    style={{ minWidth: 28, minHeight: 28 }}
                    ref={el => { btnRefs.current[result.id] = el; }}
                    onMouseEnter={e => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={async () => {
                      setLoading(true);
                      setError(null);
                      try {
                        await onAdd({ id: result.id, name: result.name });
                        toast.push({ message: 'Zaproszenie wysłane', type: 'success' });
                      } catch (err: any) {
                        const msg = err?.message ?? 'Nie udało się wysłać zaproszenia';
                        setError(msg);
                        toast.push({ message: msg, type: 'error' });
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    aria-label="Dodaj do znajomych"
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
                      {tooltipText}
                    </span>,
                    document.body
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
