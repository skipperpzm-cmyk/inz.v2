import React from 'react';
import DashboardLayoutComp from '../../../components/layout/DashboardLayout';

const demoUser = {
    id: 'demo-user',
    email: 'alex.preview@travelplanner.app',
    username: 'Alex',
    avatarUrl: null,
    backgroundUrl: null,
};

export default function DemoDashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardLayoutComp user={demoUser} title="Panel demonstracyjny" readOnlySidebar>
            {children}
        </DashboardLayoutComp>
    );
}
