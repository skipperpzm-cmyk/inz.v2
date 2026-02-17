"use client";

import React, { useMemo, useState } from 'react';
import { useToast } from '../toast/ToastProvider';
import type { TripRecord } from '../../src/db/repositories/trip.repository';

type Props = {
  trips: TripRecord[];
};

type SortMode = 'newest' | 'upcoming';

const statusLabel: Record<string, string> = {
  planned: 'Planowana',
  ongoing: 'W trakcie',
  completed: 'Zakończona',
};

const statusStyle: Record<string, string> = {
  planned: 'bg-sky-500/15 text-sky-200 border border-sky-400/30',
  ongoing: 'bg-amber-500/15 text-amber-200 border border-amber-400/30',
  completed: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30',
};

const formatDate = (value: string) => {
  if (!value) return 'Do ustalenia';
  const formatter = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: 'short', year: 'numeric' });
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed)) return value;
  return formatter.format(new Date(parsed));
};

const formatRange = (start: string, end: string) => `${formatDate(start)} — ${formatDate(end)}`;

const toSortValue = (value: string) => {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
};

const formatLocation = (trip: TripRecord) => {
  if (trip.city) {
    return `${trip.city}, ${trip.country}`;
  }
  return trip.country;
};

export default function TripsList({ trips }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [items, setItems] = useState<TripRecord[]>(trips);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const toast = useToast();

  const orderedTrips = useMemo(() => {
    const source = items;
    if (sortMode === 'upcoming') {
      return [...source].sort((a, b) => toSortValue(a.startDate) - toSortValue(b.startDate));
    }
    return source;
  }, [items, sortMode]);

  if (!items.length) {
    return <p className="text-sm text-slate-300">Brak podróży — zapisz pierwszą, aby pojawiła się na liście.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-300">Sortowanie</p>
        <div className="flex gap-2">
          {(
            [
              { value: 'newest' as SortMode, label: 'Najnowsze' },
              { value: 'upcoming' as SortMode, label: 'Nadchodzące' },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSortMode(option.value)}
              className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                sortMode === option.value
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-slate-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-3">
        {orderedTrips.map((trip) => (
          <li key={trip.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-slate-900/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-white">{trip.title}</p>
                <p className="text-sm text-slate-300">{formatLocation(trip)}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[trip.status] ?? statusStyle.planned}`}>
                {statusLabel[trip.status] ?? trip.status}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-200">
              <span>{formatRange(trip.startDate, trip.endDate)}</span>
              <span>•</span>
              <span>
                {trip.durationDays} {trip.durationDays === 1 ? 'dzień' : 'dni'}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('Czy na pewno chcesz usunąć tę podróż?')) return;
                    try {
                      setLoadingId(trip.id);
                      const res = await fetch(`/api/trips/${encodeURIComponent(trip.id)}`, { method: 'DELETE' });
                      const json = await res.json().catch(() => ({}));
                      if (!res.ok || json.error) throw new Error(json.error || 'Delete failed');
                      // Remove from UI immediately
                      setItems((s) => s.filter((t) => t.id !== trip.id));
                      try { toast.push({ type: 'success', message: 'Podróż usunięta' }); } catch (e) { /* ignore */ }
                    } catch (err: any) {
                      console.error(err);
                      try { toast.push({ type: 'error', message: err?.message || 'Usuwanie nie powiodło się' }); } catch (e) { }
                    } finally {
                      setLoadingId(null);
                    }
                  }}
                  disabled={loadingId === trip.id}
                  className={`app-text-btn-danger ml-3 inline-flex items-center rounded-lg px-3 py-1 text-xs font-semibold ${loadingId === trip.id ? 'opacity-60' : ''}`}
                >
                  {loadingId === trip.id ? '...' : 'Usuń'}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
