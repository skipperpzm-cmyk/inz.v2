import React from 'react';
import GroupCreateForm from '../../../../components/groups/GroupCreateForm';

export default async function NewGroupPage() {
  return (
    <div className="p-6 lg:p-8">
      <GroupCreateForm />
    </div>
  );
}
