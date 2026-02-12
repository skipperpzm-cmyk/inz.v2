"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { useFriendContext, FriendRelationState } from './FriendContext';

export type AddFriendResult = {
  id: string;
  name: string | null;
  public_id?: string | null;
  avatar_url?: string | null;
};


type Props = {
  onSelect?: (user: AddFriendResult) => void;
  onInvite?: (user: AddFriendResult) => Promise<void> | void;
  excludeIds?: string[];
  className?: string;
};

export default function AddFriendSearch({ onSelect, onInvite, excludeIds = [], className }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddFriendResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getRelationState, currentUserId, sendInvite } = useFriendContext();
  const trimmedQuery = query.trim();
  const isDigitsOnly = /^\d+$/.test(trimmedQuery);

  const excluded = useMemo(() => new Set(excludeIds.map(String)), [excludeIds]);

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/profiles/search-list?q=${encodeURIComponent(trimmedQuery)}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();
        const data = Array.isArray(json?.data) ? json.data : [];
        setResults(data as AddFriendResult[]);
      } catch (err: any) {
        setError(err?.message ?? 'Błąd wyszukiwania');
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [trimmedQuery]);

  function renderHighlightedText(value: string | null | undefined) {
    const text = value ?? '';
    if (!trimmedQuery) return text;
    if (isDigitsOnly) return text;
    const lower = text.toLowerCase();
    const match = trimmedQuery.toLowerCase();
    const index = lower.indexOf(match);
    if (index === -1) return text;
    return (
      <>
        {text.slice(0, index)}
        <span className="text-white bg-white/10 rounded-sm px-0.5">
          {text.slice(index, index + match.length)}
        </span>
        {text.slice(index + match.length)}
      </>
    );
  }

  function renderHighlightedId(value: string | null | undefined) {
    const text = value ?? '';
    if (!isDigitsOnly || trimmedQuery.length < 2) return text || '—';
    if (!text) return '—';
    if (!text.startsWith(trimmedQuery)) return text;
    return (
      <>
        <span className="text-white bg-white/10 rounded-sm px-0.5">
          {text.slice(0, trimmedQuery.length)}
        </span>
        {text.slice(trimmedQuery.length)}
      </>
    );
  }

  return (
    <div className={className + ' mt-[2px]'}>
      <div className="mb-2">
        <label className="text-xs text-white/60 mb-1 block">Dodaj znajomego</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Wpisz publiczne ID lub fragment nazwy"
          className="w-full px-3 py-2 rounded-lg bg-white/6 border border-white/8 text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        />
      </div>

      {loading ? (
        <div className="text-xs text-white/60">Szukam...</div>
      ) : error ? (
        <div className="text-xs text-red-400">{error}</div>
      ) : trimmedQuery.length >= 2 && results.length === 0 ? (
        <div className="text-xs text-white/60">Brak wyników</div>
      ) : null}

      {results.length > 0 && (
        <ul className="space-y-1">
          {results.map((u) => {
            const isExcluded = excluded.has(String(u.id));
            // State machine
            const relationState = isExcluded ? 'EXCLUDED' : getRelationState(u.id);
            // Exhaustive switch
            let color = '';
            let aria = '';
            let tooltip = '';
            let disabled = false;
            switch (relationState) {
              case 'EXCLUDED':
                color = 'bg-gray-400 text-white cursor-not-allowed';
                aria = 'Nie można wysłać zaproszenia';
                tooltip = 'Nie można wysłać zaproszenia';
                disabled = true;
                break;
              case FriendRelationState.NONE:
                color = 'bg-blue-600 hover:bg-blue-700 text-white';
                aria = 'Wyślij zaproszenie do znajomych';
                tooltip = 'Wyślij zaproszenie do znajomych';
                disabled = false;
                break;
              case FriendRelationState.OUTGOING_PENDING:
                color = 'bg-yellow-400 text-blue-900 cursor-not-allowed';
                aria = 'Zaproszenie wysłane';
                tooltip = 'Zaproszenie wysłane';
                disabled = true;
                break;
              case FriendRelationState.INCOMING_PENDING:
                color = 'bg-blue-400 text-white cursor-not-allowed';
                aria = 'Użytkownik wysłał Ci zaproszenie';
                tooltip = 'Użytkownik wysłał Ci zaproszenie';
                disabled = true;
                break;
              case FriendRelationState.FRIENDS:
                color = 'bg-green-500 text-white cursor-not-allowed';
                aria = 'Już w znajomych';
                tooltip = 'Już w znajomych';
                disabled = true;
                break;
              case FriendRelationState.REJECTED:
                color = 'bg-gray-700 text-white cursor-not-allowed';
                aria = 'Zaproszenie odrzucone';
                tooltip = 'Zaproszenie odrzucone';
                disabled = true;
                break;
              default:
                // Exhaustive check
                const _exhaustive: never = relationState;
                throw new Error('Unknown relation state');
            }
            return (
              <li key={u.id} className="rounded-lg bg-white/6 px-2 py-2">
                <div className="flex items-center gap-2">
                  {u.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatar_url} alt={u.name ?? 'User'} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-xs text-white font-semibold">
                      {(u.name || '??').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{renderHighlightedText(u.name)}</div>
                    <div className="text-xs text-white/60">ID: {renderHighlightedId(u.public_id)}</div>
                  </div>
                  <div className="relative flex items-center">
                    <button
                      type="button"
                      aria-label={aria}
                      disabled={disabled}
                      onClick={async () => {
                        if (disabled) return;
                        if (onInvite) await onInvite(u);
                        await sendInvite(u.id);
                      }}
                      className={
                        `group ml-2 w-7 h-7 flex items-center justify-center rounded-full text-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400 ` +
                        color
                      }
                    >
                      +
                      <span
                        className={
                          `absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 rounded text-xs opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-200 z-20 shadow-lg select-none ` +
                          (relationState === FriendRelationState.FRIENDS ? 'bg-green-600 text-white' :
                            relationState === FriendRelationState.OUTGOING_PENDING ? 'bg-yellow-500 text-blue-900' :
                            relationState === FriendRelationState.INCOMING_PENDING ? 'bg-blue-500 text-white' :
                            relationState === FriendRelationState.REJECTED ? 'bg-gray-700 text-white' :
                            relationState === 'EXCLUDED' ? 'bg-gray-700 text-white' :
                            'bg-gray-900 text-white')
                        }
                        role="tooltip"
                        style={{ minWidth: 'max-content' }}
                      >
                        {tooltip}
                      </span>
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
