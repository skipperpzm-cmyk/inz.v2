import React from 'react';
import AvatarMenu from './AvatarMenu';
import LogoutButton from './layout/LogoutButton';
import { Suspense } from 'react';

interface HeaderProps {
  title?: string;
  user?: {
    id: string;
    email: string;
    username?: string | null;
    avatarUrl?: string | null;
  } | null;
}

export default function Header({ title, user }: HeaderProps) {
  return (
    <div className="w-full flex items-center justify-between bg-transparent">
      <div className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/30 backdrop-blur-md border border-gray-700/50 shadow-lg rounded-3xl">
        <div>
          <h1 className="text-lg font-semibold text-white">{title ?? 'Panel'}</h1>
        </div>
        <div className="flex items-center gap-3">
          {user ? <AvatarMenu user={user} /> : <div className="w-9 h-9 rounded-full bg-white/10 overflow-hidden" />}
          {/* Logout button for easier access on larger screens */}
          <div className="ml-2">
            <Suspense>
              <LogoutButton />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
