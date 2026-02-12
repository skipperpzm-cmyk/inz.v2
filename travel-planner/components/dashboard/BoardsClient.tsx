"use client";
import React, { useState } from 'react';
import Card from '../Card';

export default function BoardsClient() {
  const [boards] = useState([] as any[]);

  return (
    <div className="space-y-4 lg:pl-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Tablice</h1>
      </div>

      <Card className="dashboard-card p-4 justify-start">
        <div className="flex flex-col h-full">
          <div>
            <h3 className="text-lg font-semibold text-white">Tablice</h3>
          </div>
          <div className="mt-8 flex flex-col flex-1">
            <p className="text-sm text-slate-300">DO ZROBIENIA: interfejs tablic (makieta)</p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {boards.length === 0 && <div className="text-slate-400">Brak tablic (makieta)</div>}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
