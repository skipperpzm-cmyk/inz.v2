import React from 'react';

interface StatWidgetProps {
  title: string;
  value: number;
}

export default function StatWidget({ title, value }: StatWidgetProps) {
  return (
    // Stats adopt the same glass treatment but keep compact spacing for dashboard grids.
    <div className="stat-widget bg-slate-900/40 backdrop-blur-md shadow-md rounded-3xl p-4 text-indigo-100" style={{ willChange: 'box-shadow' }}>
      <h3 className="text-xs uppercase tracking-widest text-indigo-200/70">{title}</h3>
      <p className="text-2xl font-semibold text-indigo-50">{value}</p>
    </div>
  );
}
