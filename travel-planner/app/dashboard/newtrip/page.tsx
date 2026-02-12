import React from 'react';
import { redirect } from 'next/navigation';
import Card from '../../../components/Card';
import NewTripForm from '../../../components/trips/NewTripForm';
import { getCurrentUser } from '../../../lib/auth';
import { TRIP_TYPES } from '../../../src/db/repositories/trip.repository';

const TRIP_TYPE_LABELS: Record<string, string> = {
  'city-break': 'City break',
  vacation: 'Wakacje',
  adventure: 'Przygoda',
  business: 'Delegacja',
  family: 'Rodzinna',
};

export default async function NewTripPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const tripTypeOptions = TRIP_TYPES.map((value) => ({ value, label: TRIP_TYPE_LABELS[value] ?? value }));

  return (
    <div className="space-y-6 lg:pl-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-slate-300">Utwórz nową podróż</p>
        <h1 className="text-3xl font-semibold text-white">Nowa podróż</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-1">
        <Card className="dashboard-card rounded-2xl p-6 justify-start">
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-semibold text-white">Formularz tworzenia podróży</h2>
              <p className="mt-2 text-sm text-slate-300">Wprowadź podstawowe dane podróży. Formularz działa identycznie jak wcześniej.</p>
            </div>
            <NewTripForm tripTypes={tripTypeOptions} />
          </div>
        </Card>
      </div>
    </div>
  );
}
