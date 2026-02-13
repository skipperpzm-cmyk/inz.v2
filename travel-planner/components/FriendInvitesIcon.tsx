"use client";
import React from 'react';
import { InboxIcon } from '@heroicons/react/24/outline';

type Props = {
  count?: number;
  onClick?: () => void;
  ariaLabel?: string;
};

export default function FriendInvitesIcon({ count = 0, onClick, ariaLabel = 'Zaproszenia do znajomych' }: Props) {
  return (
    <span
      aria-label={ariaLabel}
      className="relative inline-flex items-center justify-center w-9 h-9"
    >
      <InboxIcon className="w-5 h-5" aria-hidden />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white bg-red-500 rounded-full shadow-sm">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </span>
  );
}
