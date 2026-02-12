import { and, asc, desc, eq } from 'drizzle-orm';
import { trips } from '../schema';
import { requireDb } from 'src/db/db';

export const TRIP_TYPES = ['city-break', 'vacation', 'adventure', 'business', 'family'] as const;
export const TRIP_STATUSES = ['planned', 'ongoing', 'completed'] as const;

export type TripType = (typeof TRIP_TYPES)[number];
export type TripStatus = (typeof TRIP_STATUSES)[number];

export type TripCreateInput = {
  userId: string;
  title: string;
  description?: string | null;
  country: string;
  city?: string | null;
  tripType: TripType;
  startDate: string | Date;
  endDate: string | Date;
  status?: TripStatus;
  isFavorite?: boolean;
};

export type TripUpdateInput = Partial<Omit<TripCreateInput, 'userId'>>;

export type TripRecord = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  country: string;
  city: string | null;
  tripType: TripType;
  startDate: string;
  endDate: string;
  durationDays: number;
  status: TripStatus;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
};

const DAY_IN_MS = 86_400_000;

const sanitizeDateInput = (value: string | Date) => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error('Invalid date value');
    return value.toISOString().slice(0, 10);
  }

  const trimmed = value.trim();
  if (!trimmed) throw new Error('Invalid date value');
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid date value');
  }
  return parsed.toISOString().slice(0, 10);
};

const computeDurationDays = (start: string, end: string) => {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return 1;
  }
  const diff = Math.floor((endMs - startMs) / DAY_IN_MS);
  return diff > 0 ? diff : 1;
};

const toDateIso = (value: unknown) => {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = value.toString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
};

const toTimestampIso = (value: unknown) => {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value.toString());
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const mapTripForUi = (row: typeof trips.$inferSelect): TripRecord => ({
  id: row.id,
  userId: row.userId,
  title: row.title,
  description: row.description ?? null,
  country: row.country,
  city: row.city ?? null,
  tripType: row.tripType as TripType,
  startDate: toDateIso(row.startDate),
  endDate: toDateIso(row.endDate),
  durationDays: row.durationDays,
  status: row.status as TripStatus,
  isFavorite: row.isFavorite,
  createdAt: toTimestampIso(row.createdAt),
  updatedAt: toTimestampIso(row.updatedAt),
});

export async function getTripsByUser(userId: string, options?: { sort?: 'newest' | 'upcoming' }) {
  const db = requireDb();
  // First, detect which columns are present in the `trips` table. Some deployments
  // may not have the newer columns yet (migration not applied). Querying
  // information_schema lets us choose a safe select list to avoid runtime errors.
  const info = await db.execute(
    `select column_name from information_schema.columns where table_name = 'trips' and table_schema = current_schema()`
  );
  const infoRows = ((info as any).rows ?? info) as Array<any>;
  const presentCols = new Set(infoRows.map((r) => String(r.column_name ?? r.column_name)));

  const required = [
    'id',
    'user_id',
    'title',
    'description',
    'country',
    'city',
    'trip_type',
    'start_date',
    'end_date',
    'duration_days',
    'status',
    'is_favorite',
    'created_at',
    'updated_at',
  ];

  const hasAll = required.every((c) => presentCols.has(c));

  const orderClause = options?.sort === 'upcoming' && presentCols.has('start_date') ? asc(trips.startDate) : desc(trips.createdAt);

  if (hasAll) {
    const rows = await db.select().from(trips).where(eq(trips.userId, userId)).orderBy(orderClause);
    return rows.map(mapTripForUi);
  }

  // Fallback: select a minimal set of columns that are safe to query.
  const safeUserId = String(userId).replace(/'/g, "''");
  const raw = await db.execute(
    `select id, user_id, title, start_date, end_date, created_at from trips where user_id = '${safeUserId}' order by created_at desc`
  );
  const rows = ((raw as any).rows ?? raw) as Array<any>;

  return rows.map((r) => {
    const start = toDateIso(r.start_date ?? r.startDate ?? null);
    const end = toDateIso(r.end_date ?? r.endDate ?? null);
    const duration = computeDurationDays(start || new Date().toISOString().slice(0, 10), end || new Date().toISOString().slice(0, 10));
    return {
      id: r.id,
      userId: r.user_id,
      title: r.title,
      description: null,
      country: 'Unknown',
      city: null,
      tripType: 'city-break' as TripType,
      startDate: start || '',
      endDate: end || '',
      durationDays: duration,
      status: 'planned' as TripStatus,
      isFavorite: false,
      createdAt: toTimestampIso(r.created_at ?? r.createdAt),
      updatedAt: toTimestampIso(r.created_at ?? r.createdAt),
    } as TripRecord;
  });
}

export async function getTripById(tripId: string, userId: string) {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
    .limit(1);
  return row ? mapTripForUi(row) : null;
}

export async function createTrip(data: TripCreateInput) {
  const db = requireDb();
  const startDate = sanitizeDateInput(data.startDate);
  const endDate = sanitizeDateInput(data.endDate);
  const durationDays = computeDurationDays(startDate, endDate);

  const inserted = await db
    .insert(trips)
    .values({
      userId: data.userId,
      title: data.title,
      description: data.description ?? null,
      country: data.country,
      city: data.city ?? null,
      tripType: data.tripType,
      startDate,
      endDate,
      durationDays,
      status: data.status ?? 'planned',
      isFavorite: data.isFavorite ?? false,
      updatedAt: new Date(),
    })
    .returning();

  return inserted[0] ? mapTripForUi(inserted[0]) : null;
}

export async function updateTrip(tripId: string, userId: string, data: TripUpdateInput) {
  const db = requireDb();
  const [existing] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
    .limit(1);

  if (!existing) return null;

  const nextStart = data.startDate ? sanitizeDateInput(data.startDate) : toDateIso(existing.startDate);
  const nextEnd = data.endDate ? sanitizeDateInput(data.endDate) : toDateIso(existing.endDate);
  const durationDays = computeDurationDays(nextStart, nextEnd);

  const updated = await db
    .update(trips)
    .set({
      title: data.title ?? existing.title,
      description: data.description !== undefined ? data.description : existing.description,
      country: data.country ?? existing.country,
      city: data.city !== undefined ? data.city : existing.city,
      tripType: data.tripType ?? (existing.tripType as TripType),
      startDate: nextStart,
      endDate: nextEnd,
      durationDays,
      status: data.status ?? (existing.status as TripStatus),
      isFavorite: typeof data.isFavorite === 'boolean' ? data.isFavorite : existing.isFavorite,
      updatedAt: new Date(),
    })
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
    .returning();

  return updated[0] ? mapTripForUi(updated[0]) : null;
}

export async function deleteTrip(tripId: string, userId: string) {
  const db = requireDb();
  await db.delete(trips).where(and(eq(trips.id, tripId), eq(trips.userId, userId)));
  return true;
}
