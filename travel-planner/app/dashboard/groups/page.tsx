import React from 'react';
import GroupsListClient from '../../../components/groups/GroupsListClient';

export default async function GroupsIndexPage() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Twoje grupy</h1>
        <p className="text-sm text-slate-300 mt-2">Lista wszystkich grup, do których należysz.</p>
      </div>

      <GroupsListClient />
    </div>
  );
}
