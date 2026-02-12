import React from 'react';
import Card from '../../../../components/Card';

export default function Page() {
  return (
    <div className="space-y-4 lg:pl-6">
      <h1 className="text-2xl font-bold text-red-600">Strefa zagrożenia</h1>

      <Card className="dashboard-card p-4 justify-start">
        <div className="flex flex-col h-full">
          <div>
            <h3 className="text-lg font-semibold text-white">Strefa zagrożenia</h3>
          </div>
          <div className="mt-8 flex flex-col flex-1">
            <p className="text-sm text-slate-300">DO ZROBIENIA: usuwanie konta</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
