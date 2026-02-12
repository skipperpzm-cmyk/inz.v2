"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';

type BackgroundLayerProps = {
  initial?: string | null;
  allowed?: string[];
  fallback?: string | null;
};

function normalizeBackground(value: string | null | undefined, allowed?: string[], fallback?: string | null) {
  if (!value) return fallback ?? null;
  if (allowed && !allowed.includes(value)) return fallback ?? null;
  return value;
}

export default function BackgroundLayer({ initial, allowed, fallback }: BackgroundLayerProps) {
  const allowedKey = useMemo(() => allowed?.join('|') ?? '', [allowed]);
  const [bg, setBg] = useState<string | null>(() => normalizeBackground(initial, allowed, fallback));

  useEffect(() => {
    function apply(value: string | null) {
      setBg(normalizeBackground(value, allowed, fallback));
    }

    try {
      const stored = localStorage.getItem('tp_background');
      if (stored) {
        apply(stored);
      } else {
        apply(initial ?? null);
      }
    } catch (err) {
      apply(initial ?? null);
    }

    function onUpdate(e: Event) {
      const custom = e as CustomEvent<string>;
      apply(typeof custom.detail === 'string' ? custom.detail : null);
    }
    window.addEventListener('background-updated', onUpdate as EventListener);
    return () => window.removeEventListener('background-updated', onUpdate as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedKey, fallback, initial]);

  const ref = useRef<HTMLVideoElement | null>(null);
  const isVideo = bg ? (bg.toLowerCase().endsWith('.mp4') || bg.toLowerCase().startsWith('video:')) : false;

  useEffect(() => {
    if (!isVideo) return;
    try {
      if (ref.current) {
        ref.current.playbackRate = 0.5;
        void ref.current.play().catch(() => {});
      }
    } catch (e) {
      // ignore
    }
  }, [bg, isVideo]);

  if (!bg) return null;

  if (isVideo) {
    return (
      <video
        ref={ref}
        aria-hidden
        className="fixed inset-0 w-full h-full object-cover"
        style={{ zIndex: -5, pointerEvents: 'none', filter: 'blur(6px)' }}
        src={bg}
        autoPlay
        loop
        muted
        playsInline
        onLoadedMetadata={(e) => { try { (e.currentTarget as HTMLVideoElement).playbackRate = 0.5; } catch { } }}
      />
    );
  }

  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: -5, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${bg})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(6px)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.75)'
        }}
      />
    </div>
  );
}
