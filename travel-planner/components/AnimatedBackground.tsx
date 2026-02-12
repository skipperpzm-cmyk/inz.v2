"use client";
import React from 'react';

export default function AnimatedBackground({ className }: { className?: string }) {
  const [shouldRender, setShouldRender] = React.useState(true);

  React.useEffect(() => {
    // Prevent duplicate mounts across the app. If another instance is mounted,
    // do not render again. Use a global flag so landing and dashboard share the same instance.
    const win = typeof window !== 'undefined' ? (window as any) : undefined;
    if (!win) return;
    if (win.__animatedBackgroundMounted) {
      setShouldRender(false);
      return;
    }
    win.__animatedBackgroundMounted = true;
    return () => {
      try {
        win.__animatedBackgroundMounted = false;
      } catch (e) {
        // ignore
      }
    };
  }, []);

  if (!shouldRender) return null;

  // Use only the fixed `app-bg` container to ensure the layer is fixed to the viewport
  // and doesn't affect layout flow. Inline zIndex keeps it behind content.
  return (
    <div className={`${className ?? ''} app-bg fixed inset-0 pointer-events-none`} style={{ zIndex: -10 }} aria-hidden>
      <div className="bg-blob blob-1" />
      <div className="bg-blob blob-2" />
      <div className="bg-blob blob-3" />
      <div className="lava-bg" aria-hidden>
        <div className="lava-bubble lava-1" />
        <div className="lava-bubble lava-2" />
        <div className="lava-bubble lava-3" />
        <div className="lava-bubble lava-4" />
      </div>
    </div>
  );
}
