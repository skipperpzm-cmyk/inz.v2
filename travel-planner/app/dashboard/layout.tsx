import React from 'react';
import { redirect } from 'next/navigation';
import DashboardLayoutComp from '../../components/layout/DashboardLayout';
import { getCurrentUser, getCurrentUserId } from '../../lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const userId = await getCurrentUserId();
    if (!userId) redirect('/login');

    const profile = await getCurrentUser();
    const user = profile ?? { id: userId, email: '', username: null, avatarUrl: null, backgroundUrl: null };

    return <DashboardLayoutComp user={user}>{children}</DashboardLayoutComp>;
}