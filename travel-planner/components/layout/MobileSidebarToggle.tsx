"use client";
import React, { useState } from 'react';
import Sidebar from '../../components/Sidebar';

export default function MobileSidebarToggle() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="inline-flex items-center justify-center p-2 rounded-lg bg-white/6 border border-white/8 text-white mr-3"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 5h14a1 1 0 010 2H3a1 1 0 110-2zm0 4h14a1 1 0 010 2H3a1 1 0 110-2zm0 4h14a1 1 0 010 2H3a1 1 0 110-2z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative w-72 p-5 m-4 bg-white/6 backdrop-blur-md border border-white/10 rounded-2xl shadow-glass">
            <div className="flex justify-end">
              <button onClick={() => setOpen(false)} className="p-1 rounded-md text-white">
                ✕
              </button>
            </div>
            <div className="mt-2">
              <Sidebar onNavigate={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
