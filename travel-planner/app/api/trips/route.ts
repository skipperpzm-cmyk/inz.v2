import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '../../../lib/auth';
import { createTrip, getTripsByUser, TRIP_STATUSES, TRIP_TYPES } from '../../../src/db/repositories/trip.repository';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type SortOption = 'newest' | 'upcoming';

const baseTripSchema = z.object({
  title: z.string().trim().min(3, 'Tytuł musi mieć co najmniej 3 znaki.'),
  description: z
    .string()
    .trim()
    .max(2000, 'Opis może mieć maksymalnie 2000 znaków.')
    .optional()
    .nullable(),
  country: z.string().trim().min(2, 'Kraj jest wymagany.'),
  city: z.string().trim().max(200, 'Miasto jest za długie.').optional().nullable(),
  tripType: z.enum(TRIP_TYPES, { message: 'Nieobsługiwany typ podróży.' }),
  startDate: z.string().regex(DATE_PATTERN, 'Data powinna być w formacie RRRR-MM-DD.'),
  endDate: z.string().regex(DATE_PATTERN, 'Data powinna być w formacie RRRR-MM-DD.'),
  status: z.enum(TRIP_STATUSES).optional(),
  isFavorite: z.boolean().optional(),
});

const createTripSchema = baseTripSchema.superRefine((data, ctx) => {
  const start = Date.parse(`${data.startDate}T00:00:00Z`);
  const end = Date.parse(`${data.endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || start >= end) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'Data zakończenia musi być późniejsza niż data rozpoczęcia.',
    });
  }
});

const normalizePayload = (input: z.infer<typeof createTripSchema>) => ({
  title: input.title.trim(),
  description: input.description?.trim() || null,
  country: input.country.trim(),
  city: input.city?.trim() || null,
  tripType: input.tripType,
  startDate: input.startDate,
  endDate: input.endDate,
  status: input.status,
  isFavorite: input.isFavorite,
});

const unauthorized = () => NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const sortParam = searchParams.get('sort') === 'upcoming' ? 'upcoming' : 'newest';

  const trips = await getTripsByUser(user.id, { sort: sortParam as SortOption });
  return NextResponse.json({ data: trips });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const payload = await request.json().catch(() => null);
  const parsed = createTripSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }

  const normalized = normalizePayload(parsed.data);
  const trip = await createTrip({ ...normalized, userId: user.id });
  return NextResponse.json({ data: trip }, { status: 201 });
}
