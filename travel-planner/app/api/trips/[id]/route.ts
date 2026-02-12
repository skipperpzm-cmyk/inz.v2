import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { deleteTrip } from '@/src/db/repositories/trip.repository';

import { NextRequest } from 'next/server';

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  // ...existing code...
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const tripId = params.id;
    if (!tripId) return NextResponse.json({ error: 'Missing trip id' }, { status: 400 });

    // Ensure trip exists and belongs to the current user
    const existing = await getTripById(tripId, user.id);
    if (!existing) return NextResponse.json({ error: 'Trip not found or access denied' }, { status: 404 });

    await deleteTrip(tripId, user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('delete trip error', err);
    return NextResponse.json({ error: 'Failed to delete trip' }, { status: 500 });
  }
}
import { z } from 'zod';
import { getTripById, updateTrip, TRIP_STATUSES, TRIP_TYPES, TripUpdateInput } from '@/src/db/repositories/trip.repository';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const paramsSchema = z.object({
  id: z.string().uuid('Nieprawidłowy identyfikator podróży.'),
});

const baseUpdateSchema = z.object({
  title: z.string().trim().min(3, 'Tytuł musi mieć co najmniej 3 znaki.').optional(),
  description: z
    .string()
    .trim()
    .max(2000, 'Opis może mieć maksymalnie 2000 znaków.')
    .optional()
    .nullable(),
  country: z.string().trim().min(2, 'Kraj jest wymagany.').optional(),
  city: z.string().trim().max(200, 'Miasto jest za długie.').optional().nullable(),
  tripType: z.enum(TRIP_TYPES).optional(),
  startDate: z.string().regex(DATE_PATTERN, 'Data powinna być w formacie RRRR-MM-DD.').optional(),
  endDate: z.string().regex(DATE_PATTERN, 'Data powinna być w formacie RRRR-MM-DD.').optional(),
  status: z.enum(TRIP_STATUSES).optional(),
  isFavorite: z.boolean().optional(),
});

const updateTripSchema = baseUpdateSchema.superRefine((data, ctx) => {
  if (data.startDate && data.endDate) {
    const start = Date.parse(`${data.startDate}T00:00:00Z`);
    const end = Date.parse(`${data.endDate}T00:00:00Z`);
    if (Number.isNaN(start) || Number.isNaN(end) || start >= end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'Data zakończenia musi być późniejsza niż data rozpoczęcia.',
      });
    }
  }
});

const normalizeUpdatePayload = (input: z.infer<typeof updateTripSchema>): TripUpdateInput => {
  const result: TripUpdateInput = {};

  if (input.title !== undefined) result.title = input.title.trim();
  if (input.description !== undefined) result.description = input.description?.trim() || null;
  if (input.country !== undefined) result.country = input.country.trim();
  if (input.city !== undefined) result.city = input.city?.trim() || null;
  if (input.tripType !== undefined) result.tripType = input.tripType;
  if (input.startDate !== undefined) result.startDate = input.startDate;
  if (input.endDate !== undefined) result.endDate = input.endDate;
  if (input.status !== undefined) result.status = input.status;
  if (input.isFavorite !== undefined) result.isFavorite = input.isFavorite;

  return result;
};

const unauthorized = () => NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  // ...existing code...
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ errors: parsedParams.error.flatten() }, { status: 400 });
  }

  const trip = await getTripById(parsedParams.data.id, user.id);
  if (!trip) {
    return NextResponse.json({ message: 'Trip not found.' }, { status: 404 });
  }

  return NextResponse.json({ data: trip });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  // ...existing code...
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ errors: parsedParams.error.flatten() }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsedBody = updateTripSchema.safeParse(payload);
  if (!parsedBody.success) {
    return NextResponse.json({ errors: parsedBody.error.flatten() }, { status: 400 });
  }

  const normalized = normalizeUpdatePayload(parsedBody.data);
  if (Object.keys(normalized).length === 0) {
    return NextResponse.json({ message: 'Brak danych do aktualizacji.' }, { status: 400 });
  }

  const trip = await updateTrip(parsedParams.data.id, user.id, normalized);
  if (!trip) {
    return NextResponse.json({ message: 'Trip not found.' }, { status: 404 });
  }

  return NextResponse.json({ data: trip });
}
