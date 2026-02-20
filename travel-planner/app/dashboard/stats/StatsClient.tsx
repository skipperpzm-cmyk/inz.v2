'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Card from '../../../components/Card';

type StatsMode = 'solo' | 'group';
type RangePreset = '7' | '30' | '90' | 'all' | 'custom';

type TrendPoint = {
  date: string;
  posts: number;
  comments: number;
  onlineSeconds: number;
};

type HeatmapCell = {
  dayOfWeek: number;
  hour: number;
  value: number;
};

type RankingEntry = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  posts: number;
  comments: number;
  onlineSeconds: number;
  reactions: number;
  score: number;
};

type BoardOption = { id: string; title: string };
type GroupUserOption = { id: string; name: string; avatarUrl: string | null };

type StatsResponse = {
  mode: StatsMode;
  filters: {
    range: RangePreset;
    boardId: string;
    startDate: string | null;
    endDate: string | null;
    userId: string;
  };
  options: {
    boards: BoardOption[];
    users: GroupUserOption[];
  };
  solo: {
    kpi: {
      posts: number;
      comments: number;
      onlineSeconds: number;
      completedTrips: number;
      deltas: {
        posts: number;
        comments: number;
        onlineSeconds: number;
        completedTrips: number;
      };
    };
    online: {
      totalSeconds: number;
      avgSessionSeconds: number;
      sessionsCount: number;
      trend: TrendPoint[];
    };
    trips: {
      completedTrips: number;
      totalTripDays: number;
      mostFrequentDirection: string | null;
      longestTripDays: number;
      averageBudget: number | null;
    };
    engagement: {
      mentionsReceived: number;
      reactionsReceived: number;
      averageCommentsOnPosts: number;
      topEmojis: Array<{ emoji: string; count: number }>;
    };
    activityTrend: TrendPoint[];
  };
  group: {
    kpi: {
      posts: number;
      comments: number;
      onlineSeconds: number;
      groupTrips: number;
      mostActiveUser: string | null;
    };
    ranking: RankingEntry[];
    heatmap: HeatmapCell[];
    trips: {
      totalTrips: number;
      totalTripDays: number;
      mostVisitedPlace: string | null;
      averageTripDays: number;
      mostActiveTraveler: string | null;
    };
    interactions: {
      topEmojis: Array<{ emoji: string; count: number }>;
      mostMentionedUser: string | null;
      averageCommentsPerPost: number;
      mostEngagingPost: {
        postId: string;
        excerpt: string;
        commentsCount: number;
      } | null;
    };
  };
};

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatPercent(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function formatCurrency(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(0)} zł`;
}

function TinyLineChart({ data }: { data: TrendPoint[] }) {
  const width = 800;
  const height = 180;
  const padding = 20;

  const points = useMemo(() => {
    if (data.length === 0) return [] as Array<{ x: number; posts: number; comments: number; online: number }>;
    const max = Math.max(
      1,
      ...data.map((item) => Math.max(item.posts, item.comments, Math.round(item.onlineSeconds / 3600)))
    );
    const step = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

    return data.map((item, idx) => {
      const x = padding + step * idx;
      const toY = (v: number) => height - padding - (v / max) * (height - padding * 2);
      return {
        x,
        posts: toY(item.posts),
        comments: toY(item.comments),
        online: toY(Math.round(item.onlineSeconds / 3600)),
      };
    });
  }, [data]);

  const path = (key: 'posts' | 'comments' | 'online') => {
    if (points.length === 0) return '';
    return points.map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x} ${point[key]}`).join(' ');
  };

  return (
    <div className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-2 overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[180px] w-full">
        <path d={path('posts')} stroke="rgba(56,189,248,0.9)" strokeWidth="2" fill="none" />
        <path d={path('comments')} stroke="rgba(52,211,153,0.9)" strokeWidth="2" fill="none" />
        <path d={path('online')} stroke="rgba(251,191,36,0.9)" strokeWidth="2" fill="none" />
      </svg>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-white/70">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400" />Posty</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" />Komentarze</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Czas online (h)</span>
      </div>
    </div>
  );
}

function ActivityHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const matrix = useMemo(() => {
    const map = new Map<string, number>();
    for (const cell of cells) map.set(`${cell.dayOfWeek}-${cell.hour}`, cell.value);
    return map;
  }, [cells]);

  const max = Math.max(1, ...cells.map((cell) => cell.value));
  const dayLabels = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 overflow-hidden">
      <div className="grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-1">
        <div />
        {Array.from({ length: 24 }, (_, hour) => (
          <div key={`h-${hour}`} className="text-[10px] text-white/50 text-center">{hour}</div>
        ))}

        {Array.from({ length: 7 }, (_, day) => (
          <React.Fragment key={`d-${day}`}>
            <div className="text-[10px] text-white/60 flex items-center">{dayLabels[day]}</div>
            {Array.from({ length: 24 }, (_, hour) => {
              const value = matrix.get(`${day}-${hour}`) ?? 0;
              const alpha = value <= 0 ? 0.08 : Math.min(0.92, 0.14 + (value / max) * 0.78);
              return (
                <div
                  key={`c-${day}-${hour}`}
                  title={`${dayLabels[day]} ${hour}:00 – ${value}`}
                  className="h-4 rounded"
                  style={{ backgroundColor: `rgba(99,102,241,${alpha})` }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function KpiTile({ title, value, delta }: { title: string; value: string; delta?: number }) {
  const deltaColor = (delta ?? 0) > 0 ? 'text-emerald-300' : (delta ?? 0) < 0 ? 'text-red-300' : 'text-white/50';
  return (
    <Card className="dashboard-card p-4 justify-start rounded-2xl bg-white/[0.035] border-white/10 !min-h-0">
      <p className="text-xs text-white/60">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      {typeof delta === 'number' && <p className={`mt-1 text-xs ${deltaColor}`}>{formatPercent(delta)} vs poprzedni okres</p>}
    </Card>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (next: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-white/15 bg-slate-900/90 px-2.5 text-xs text-white"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

export default function StatsClient() {
  const [tab, setTab] = useState<StatsMode>('solo');
  const [range, setRange] = useState<RangePreset>('30');
  const [boardId, setBoardId] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [groupUserId, setGroupUserId] = useState('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ mode: tab, range, boardId, userId: groupUserId });
        if (range === 'custom' && startDate && endDate) {
          params.set('startDate', startDate);
          params.set('endDate', endDate);
        }

        const response = await fetch(`/api/stats?${params.toString()}`, { credentials: 'include', cache: 'no-store' });
        if (!response.ok) throw new Error('Nie udało się pobrać statystyk.');
        const payload = (await response.json()) as StatsResponse;
        if (cancelled) return;
        setData(payload);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Nie udało się pobrać statystyk.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [tab, range, boardId, startDate, endDate, groupUserId]);

  const boards = data?.options.boards ?? [];
  const users = data?.options.users ?? [];

  return (
    <div className="h-full overflow-y-hidden space-y-4 lg:pl-6">
      <h1 className="text-2xl font-bold text-white">Statystyki</h1>

      <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('solo')}
            className={`rounded-lg px-3 py-1.5 text-xs border ${tab === 'solo' ? 'bg-white/15 border-white/25 text-white' : 'bg-white/5 border-white/10 text-white/75'}`}
          >
            SOLO
          </button>
          <button
            type="button"
            onClick={() => setTab('group')}
            className={`rounded-lg px-3 py-1.5 text-xs border ${tab === 'group' ? 'bg-white/15 border-white/25 text-white' : 'bg-white/5 border-white/10 text-white/75'}`}
          >
            GRUPA
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <FilterSelect
              value={range}
              onChange={(next) => setRange(next as RangePreset)}
              options={[
                { value: '7', label: '7 dni' },
                { value: '30', label: '30 dni' },
                { value: '90', label: '90 dni' },
                { value: 'all', label: 'Całość' },
                { value: 'custom', label: 'Custom' },
              ]}
            />

            <FilterSelect
              value={boardId}
              onChange={setBoardId}
              options={[
                { value: 'all', label: 'Wszystkie tablice' },
                ...boards.map((board) => ({ value: board.id, label: board.title })),
              ]}
            />

            {range === 'custom' && (
              <>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 rounded-lg border border-white/15 bg-slate-900/90 px-2.5 text-xs text-white" />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 rounded-lg border border-white/15 bg-slate-900/90 px-2.5 text-xs text-white" />
              </>
            )}

            {tab === 'group' && (
              <FilterSelect
                value={groupUserId}
                onChange={setGroupUserId}
                options={[
                  { value: 'all', label: 'Wszyscy użytkownicy' },
                  ...users.map((user) => ({ value: user.id, label: user.name })),
                ]}
              />
            )}
          </div>
      </div>

      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card
                key={`loading-kpi-${index}`}
                className="dashboard-card p-4 justify-start rounded-2xl bg-white/[0.035] border-white/10 !min-h-0 hover:animate-pulse"
              >
                <div className="h-3 w-24 rounded bg-white/10" />
                <div className="mt-2 h-7 w-20 rounded bg-white/15" />
                <div className="mt-2 h-3 w-32 rounded bg-white/10" />
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, index) => (
              <Card
                key={`loading-chart-${index}`}
                className="dashboard-card p-4 justify-start rounded-2xl bg-white/[0.035] border-white/10 !min-h-0 hover:animate-pulse"
              >
                <div className="h-4 w-44 rounded bg-white/10" />
                <div className="mt-3 h-40 w-full rounded-xl bg-white/10" />
              </Card>
            ))}
          </div>
        </div>
      )}

      {error && (
        <Card className="dashboard-card p-4 justify-start rounded-2xl bg-red-500/10 border-red-400/30 !min-h-0">
          <p className="text-sm text-red-200">{error}</p>
        </Card>
      )}

      {!loading && !error && data && tab === 'solo' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <KpiTile title="Liczba postów" value={String(data.solo.kpi.posts)} delta={data.solo.kpi.deltas.posts} />
            <KpiTile title="Liczba komentarzy" value={String(data.solo.kpi.comments)} delta={data.solo.kpi.deltas.comments} />
            <KpiTile title="Łączny czas online" value={formatDuration(data.solo.kpi.onlineSeconds)} delta={data.solo.kpi.deltas.onlineSeconds} />
            <KpiTile title="Liczba przebytych podróży" value={String(data.solo.kpi.completedTrips)} delta={data.solo.kpi.deltas.completedTrips} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="dashboard-card p-4 justify-start rounded-2xl bg-white/[0.035] border-white/10 !min-h-0">
              <h3 className="text-sm font-semibold text-white">Czas online</h3>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/85">Łącznie: {formatDuration(data.solo.online.totalSeconds)}</div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/85">Śr. sesja: {formatDuration(data.solo.online.avgSessionSeconds)}</div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/85">Sesje: {data.solo.online.sessionsCount}</div>
              </div>
              <div className="mt-3"><TinyLineChart data={data.solo.online.trend} /></div>
            </Card>

            <Card className="dashboard-card p-4 justify-start rounded-2xl bg-white/[0.035] border-white/10 !min-h-0">
              <h3 className="text-sm font-semibold text-white">Podróże użytkownika</h3>
              <div className="mt-3 space-y-2 text-sm text-white/85">
                <p>Ukończone podróże: {data.solo.trips.completedTrips}</p>
                <p>Łączna liczba dni podróży: {data.solo.trips.totalTripDays}</p>
                <p>Najczęstszy kierunek: {data.solo.trips.mostFrequentDirection ?? '—'}</p>
                <p>Najdłuższa podróż: {data.solo.trips.longestTripDays} dni</p>
                <p>Średni budżet: {formatCurrency(data.solo.trips.averageBudget)}</p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="dashboard-card p-4 justify-start rounded-2xl bg-white/[0.035] border-white/10 !min-h-0">
              <h3 className="text-sm font-semibold text-white">Zaangażowanie</h3>
              <div className="mt-3 space-y-2 text-sm text-white/85">
                <p>Wzmianki o mnie: {data.solo.engagement.mentionsReceived}</p>
                <p>Reakcje pod moimi postami: {data.solo.engagement.reactionsReceived}</p>
                <p>Średnia komentarzy pod moimi postami: {data.solo.engagement.averageCommentsOnPosts}</p>
                <p>Najczęściej używane emoji: {data.solo.engagement.topEmojis.length ? data.solo.engagement.topEmojis.map((entry) => `${entry.emoji} (${entry.count})`).join(', ') : '—'}</p>
              </div>
            </Card>

            <Card className="dashboard-card p-4 justify-start rounded-2xl bg-white/[0.035] border-white/10 !min-h-0">
              <h3 className="text-sm font-semibold text-white">Aktywność w czasie</h3>
              <div className="mt-3"><TinyLineChart data={data.solo.activityTrend} /></div>
            </Card>
          </div>
        </div>
      )}

      {!loading && !error && data && tab === 'group' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <KpiTile title="Posty" value={String(data.group.kpi.posts)} />
            <KpiTile title="Komentarze" value={String(data.group.kpi.comments)} />
            <KpiTile title="Czas online" value={formatDuration(data.group.kpi.onlineSeconds)} />
            <KpiTile title="Podróże grupowe" value={String(data.group.kpi.groupTrips)} />
            <KpiTile title="Najbardziej aktywny" value={data.group.kpi.mostActiveUser ?? '—'} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="dashboard-card p-4 justify-start rounded-2xl bg-white/[0.035] border-white/10 !min-h-0">
              <h3 className="text-sm font-semibold text-white">Ranking użytkowników (Top 5)</h3>
              <div className="mt-3 space-y-2">
                {data.group.ranking.length === 0 && <p className="text-sm text-white/60">Brak danych.</p>}
                {data.group.ranking.map((entry) => (
                  <div key={entry.userId} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{entry.name}</p>
                      <p className="text-xs text-white/60">Posty {entry.posts} • Komentarze {entry.comments} • Online {formatDuration(entry.onlineSeconds)}</p>
                    </div>
                    <p className="text-xs font-semibold text-indigo-200">{entry.score} pkt</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="dashboard-card p-4 justify-start rounded-2xl bg-white/[0.035] border-white/10 !min-h-0">
              <h3 className="text-sm font-semibold text-white">Heatmapa aktywności grupy</h3>
              <div className="mt-3"><ActivityHeatmap cells={data.group.heatmap} /></div>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="dashboard-card p-4 justify-start rounded-2xl bg-white/[0.035] border-white/10 !min-h-0">
              <h3 className="text-sm font-semibold text-white">Statystyki podróży grupowych</h3>
              <div className="mt-3 space-y-2 text-sm text-white/85">
                <p>Łączna liczba podróży: {data.group.trips.totalTrips}</p>
                <p>Łączna liczba dni podróży: {data.group.trips.totalTripDays}</p>
                <p>Najczęściej odwiedzane miejsce: {data.group.trips.mostVisitedPlace ?? '—'}</p>
                <p>Średnia długość podróży: {data.group.trips.averageTripDays.toFixed(1)} dni</p>
                <p>Najbardziej aktywny podróżnik: {data.group.trips.mostActiveTraveler ?? '—'}</p>
              </div>
            </Card>

            <Card className="dashboard-card p-4 justify-start rounded-2xl bg-white/[0.035] border-white/10 !min-h-0">
              <h3 className="text-sm font-semibold text-white">Interakcje grupowe</h3>
              <div className="mt-3 space-y-2 text-sm text-white/85">
                <p>Najczęściej używane emoji: {data.group.interactions.topEmojis.length ? data.group.interactions.topEmojis.map((entry) => `${entry.emoji} (${entry.count})`).join(', ') : '—'}</p>
                <p>Najwięcej wzmiankowany użytkownik: {data.group.interactions.mostMentionedUser ?? '—'}</p>
                <p>Średnia komentarzy na post: {data.group.interactions.averageCommentsPerPost}</p>
                <p>Najbardziej angażujący post: {data.group.interactions.mostEngagingPost ? `${data.group.interactions.mostEngagingPost.excerpt} (${data.group.interactions.mostEngagingPost.commentsCount} komentarzy)` : '—'}</p>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
