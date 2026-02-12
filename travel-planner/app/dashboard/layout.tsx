import React from 'react';
import { redirect } from 'next/navigation';
import DashboardLayoutComp from '../../components/layout/DashboardLayout';
import { getCurrentUser } from '../../lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const user = await getCurrentUser();
    if (!user) redirect('/login');

    return <DashboardLayoutComp user={user}>{children}</DashboardLayoutComp>;
}