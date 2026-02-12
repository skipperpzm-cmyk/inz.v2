import React from 'react';
import Card from '../../../components/Card';
import StatWidget from '../../../components/StatWidget';

export default function Page() {
  return (
    <div className="space-y-4 lg:pl-6">
      <h1 className="text-2xl font-bold">Kalendarz</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatWidget title="Nadchodzące" value={0} />
        <StatWidget title="Wydarzenia" value={0} />
        <StatWidget title="Przypomnienia" value={0} />
      </div>

      <Card className="dashboard-card p-4 justify-start">
        <div className="flex flex-col h-full">
          <div>
            <h3 className="text-lg font-semibold text-white">Kalendarz</h3>
          </div>
          <div className="mt-8 flex flex-col flex-1">
            <p className="text-sm text-slate-300">DO ZROBIENIA: widok kalendarza</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
