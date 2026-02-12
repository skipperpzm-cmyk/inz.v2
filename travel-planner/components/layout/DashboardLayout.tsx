"use client";
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Sidebar from '../Sidebar';
import RightSidebar from '../RightSidebar';
import { ChatProvider } from '../chat/ChatContext';
import ChatView from '../ChatView';
import DashboardHeader from './DashboardHeader';
import BackgroundLayer from '../BackgroundLayer';
import AnimatedBackground from '../AnimatedBackground';
import ChatBubbles from '../chat/ChatBubbles';

interface UserProp {
  id: string;
  email: string;
  username?: string | null;
  avatarUrl?: string | null;
  backgroundUrl?: string | null;
}

type DashboardLayoutProps = {
  children: React.ReactNode;
  user?: UserProp | null;
  title?: string;
  readOnlySidebar?: boolean;
};

export default function DashboardLayout({ children, user, title, readOnlySidebar = false }: DashboardLayoutProps) {
  const pathname = usePathname();
  const defaultBackgroundImage = '/backgrounds/background_user_1.svg';
  const [backgrounds, setBackgrounds] = useState<string[]>([defaultBackgroundImage]);

  const [showAnimated, setShowAnimated] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/backgrounds');
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        if (Array.isArray(json) && json.length) {
          const merged = Array.from(new Set([defaultBackgroundImage, ...json]));
          setBackgrounds(merged);
        }
      } catch (err) {
        // ignore fetch errors; default background stays in place
      }
    })();
    return () => {
      active = false;
    };
  }, [defaultBackgroundImage]);

  // Decide whether to show animated background (no user image selected)
  useEffect(() => {
    function compute(initial = false) {
      try {
        const stored = localStorage.getItem('tp_background');
        if (stored && backgrounds.includes(stored)) return false;
      } catch (err) {
        // ignore
      }
      // If user has explicit backgroundUrl that is allowed, show that instead of animated.
      if (user?.backgroundUrl && backgrounds.includes(user.backgroundUrl)) return false;
      // If user has no selected background, use the default background image (first in `backgrounds`).
      if (!user?.backgroundUrl && backgrounds.length > 0) return false;
      return true;
    }

    setShowAnimated(compute());

    function onUpdate(e: Event) {
      const custom = e as CustomEvent<string | null>;
      const detail = custom.detail;
      if (!detail) {
        setShowAnimated(true);
        return;
      }
      setShowAnimated(!backgrounds.includes(detail));
    }

    window.addEventListener('background-updated', onUpdate as EventListener);
    return () => window.removeEventListener('background-updated', onUpdate as EventListener);
    // backgrounds and user are included in dependencies so recompute when they change
  }, [backgrounds, user]);

  return (
    <ChatProvider>
      <div className="min-h-screen relative flex flex-col">
      {/* Pass `fallback={null}` so absence of a user background shows the animated backdrop */}
      <BackgroundLayer initial={user?.backgroundUrl} allowed={backgrounds} fallback={null} />
      {/* Render animated background only when no image is active to avoid duplicates */}
      {showAnimated && <AnimatedBackground />}

      {/* Fixed sidebar on large screens */}
      <aside className="hidden lg:block fixed left-8 top-8 bottom-8 w-72 z-20">
        <div className="h-full">
          <Sidebar user={user} readOnly={readOnlySidebar} />
        </div>
      </aside>

      {/* Right fixed sidebar on large screens */}
      <aside className="hidden lg:block fixed right-8 top-8 bottom-8 w-72 z-20">
        <div className="h-full">
          <RightSidebar />
        </div>
      </aside>

      {/* Main content area: shifted to the right and left on large screens to account for fixed sidebars */}
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 8 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
        className="dashboard-theme dashboard-main lg:ml-[20rem] lg:mr-[20rem] p-6 flex-1 overflow-x-hidden relative z-10"
      >
        <div className="flex-1 flex flex-col gap-4">
          <header>
            <DashboardHeader title={title} user={user} />
          </header>

          <main className="flex-1 overflow-auto">
            <div className="h-full min-h-[480px] grid grid-cols-1 md:grid-cols-1">
              {/* ChatView removed from dashboard-main; chat is now floating via ChatBubbles */}
              {children}
            </div>
          </main>
        </div>
      </motion.div>
      <ChatBubbles />
      </div>
    </ChatProvider>
  );
}
