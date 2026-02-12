"use client";
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className = '' }: CardProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [inDashboard, setInDashboard] = React.useState(false);

  React.useEffect(() => {
    try {
      if (!ref.current) return;
      setInDashboard(Boolean(ref.current.closest('.dashboard-main')));
    } catch (e) {
      // ignore
    }
  }, []);

  // Landing/default style (kept for non-dashboard usages)
  const landingClasses = 'card landing-card bg-white/20 backdrop-blur-xl saturate-150 border border-white/20 shadow-glass rounded-2xl p-5';

  // Dashboard-specific glassmorphism (neutral glass matching sidebar)
  const dashboardClasses = 'bg-white/5 backdrop-blur-md shadow-lg rounded-xl p-5 border border-white/6 text-white';

  const classes = `${inDashboard ? dashboardClasses : landingClasses} min-h-24 max-h-[80vh] overflow-hidden flex flex-col h-full justify-center gap-4 ${className}`;

  return (
    <div ref={ref} className={classes} style={{ willChange: 'box-shadow' }}>
      {children}
    </div>
  );
}
