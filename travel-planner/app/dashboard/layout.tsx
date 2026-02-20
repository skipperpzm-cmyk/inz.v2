import React from 'react';
import { redirect } from 'next/navigation';
import DashboardLayoutComp from '../../components/layout/DashboardLayout';
import { getCurrentUser, getCurrentUserIdWithReason } from '../../lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const auth = await getCurrentUserIdWithReason();
    if (!auth.userId && auth.reason === 'not-authenticated') redirect('/login');

    const profile = auth.userId ? await getCurrentUser() : null;
    const user = auth.userId
        ? (profile ?? { id: auth.userId, email: '', username: null, avatarUrl: null, backgroundUrl: null })
        : null;

    return <DashboardLayoutComp user={user}>{children}</DashboardLayoutComp>;
}