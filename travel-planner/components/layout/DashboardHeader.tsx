import React, { Suspense } from 'react';
import MobileSidebarToggle from './MobileSidebarToggle';
import { getIconForKey } from '../../components/icons';
// AvatarMenu and Logout moved to sidebar bottom; header keeps controls minimal.

interface UserProp {
  id: string;
  email: string;
  username?: string | null;
  avatarUrl?: string | null;
}

export default function DashboardHeader({ title = 'Overview', user }: { title?: string; user?: UserProp | null }) {
  // Hide the default 'Overview' header (and its icon) — pages provide their own headings.
  if (!title || title === 'Overview') return null;

  return (
    <div className="w-full mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="lg:hidden">
            <MobileSidebarToggle />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-300">
                <span className="text-slate-100 bg-indigo-500/20 p-2 rounded-md backdrop-blur-sm">
                  {(() => {
                    const Icon = getIconForKey(title as string);
                    return <Icon />;
                  })()}
                </span>
            </span>
            <div>
              <h2 className="text-xl font-semibold text-white">{title}</h2>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Header right-side kept intentionally minimal; user controls live in sidebar */}
        </div>
      </div>
    </div>
  );
}
