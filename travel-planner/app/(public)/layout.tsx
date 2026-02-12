import React from 'react';
import Navbar from '../../components/Navbar';
import AnimatedBackground from '../../components/AnimatedBackground';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <AnimatedBackground />

      <div className="relative z-10 flex-1 flex flex-col bg-transparent">
        <header className="w-full py-6">
          <div className="mx-auto max-w-7xl px-6 w-full">
            <Navbar />
          </div>
        </header>

        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
