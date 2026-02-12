"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import Button from './ui/button';

export default function Navbar() {
  const pathname = usePathname();

  const normalize = (p?: string) => (p ? p.replace(/\/+$|\/$/, '') : '');
  const isActive = (href: string) => {
    if (!pathname) return false;
    const np = normalize(pathname);
    const nh = normalize(href);
    return np === nh;
  };

  const linkClass = (href: string) =>
    `text-sm font-medium tracking-tight transition transform-gpu duration-150 ${
      pathname === href
        ? 'text-white'
        : 'text-slate-100/80 hover:text-white focus:outline-none'
    }`;

  return (
    <motion.nav
      className="w-full"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {/* Nav content — container provided by layout to ensure consistent alignment */}
      <div className="relative z-10 flex items-center justify-between w-full">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-32 h-12 flex items-center justify-center">
            <span className="text-lg font-semibold text-white">Travel Planner</span>
          </div>
        </Link>

        <div className="flex items-center gap-4 mr-6">
          <Link href="/login" aria-label="Logowanie">
            <Button
              variant="primary"
              className={isActive('/login') ? 'bg-gray-600/60 shadow-lg border border-white/40 text-white' : ''}
              aria-current={isActive('/login') ? 'page' : undefined}
            >
              Zaloguj się
            </Button>
          </Link>
          <Link href="/register" aria-label="Rejestracja">
            <Button
              variant="primary"
              className={isActive('/register') ? 'bg-gray-600/60 shadow-lg border border-white/40 text-white' : ''}
              aria-current={isActive('/register') ? 'page' : undefined}
            >
              Zarejestruj się
            </Button>
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}

/*
  Navbar is a small client component that highlights the active route.
  TODO: replace usePathname-based active detection with a more robust solution if needed.
*/
