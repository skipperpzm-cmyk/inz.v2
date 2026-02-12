import React from 'react';
import { redirect } from 'next/navigation';
import Card from '../../../components/Card';
import TripsList from '../../../components/trips/TripsList';
import { getCurrentUser } from '../../../lib/auth';
import { getTripsByUser, TRIP_TYPES } from '../../../src/db/repositories/trip.repository';
import Link from 'next/link';

const TRIP_TYPE_LABELS: Record<string, string> = {
  'city-break': 'City break',
  vacation: 'Wakacje',
  adventure: 'Przygoda',
  business: 'Delegacja',
  family: 'Rodzinna',
};

export default async function TripsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const trips = await getTripsByUser(user.id);
  const tripTypeOptions = TRIP_TYPES.map((value) => ({ value, label: TRIP_TYPE_LABELS[value] ?? value }));

  return (
    <div className="space-y-6 lg:pl-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-slate-300">Zaplanuj i śledź swoje podróże</p>
        <h1 className="text-3xl font-semibold text-white">Podróże</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-1">
        <Card className="dashboard-card rounded-2xl p-6 justify-start">
          <div className="flex h-full flex-col gap-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Twoje podróże</h2>
                <p className="mt-2 text-sm text-slate-300">Lista synchronizowana z bazą danych — po odświeżeniu zobaczysz te same informacje.</p>
              </div>
              <div>
                <Link
                  href="/dashboard/newtrip"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-glass hover:brightness-105"
                >
                  New Trip
                </Link>
              </div>
            </div>
            <TripsList trips={trips} />
          </div>
        </Card>
      </div>
    </div>
  );
}
