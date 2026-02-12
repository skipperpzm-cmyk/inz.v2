"use client";
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type Toast = { id: string; title?: string; message: string; type?: 'success' | 'error' };

const ToastContext = createContext<{ push: (t: Omit<Toast, 'id'>) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID();
    const toast: Toast = { id, ...t };
    setToasts((s) => [toast, ...s]);
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 4000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 bottom-6 z-50 flex flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-sm w-full p-3 rounded-xl backdrop-blur-md bg-white/6 border border-white/10 shadow-lg text-white ${
              t.type === 'error' ? 'ring-1 ring-red-600/30' : 'ring-1 ring-emerald-400/20'
            }`}
          >
            {t.title && <div className="font-semibold">{t.title}</div>}
            <div className="text-sm mt-1">{t.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
