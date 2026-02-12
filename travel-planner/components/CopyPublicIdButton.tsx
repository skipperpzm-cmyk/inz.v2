"use client";
import React, { useEffect, useRef, useState } from 'react';

interface CopyPublicIdButtonProps {
  publicId: string;
}

export default function CopyPublicIdButton({ publicId }: CopyPublicIdButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  async function fallbackCopy(text: string) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      const sel = document.getSelection();
      const range = document.createRange();
      range.selectNodeContents(ta);
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      const ok = document.execCommand('copy');
      if (sel) sel.removeAllRanges();
      document.body.removeChild(ta);
      return ok;
    } catch (err) {
      return false;
    }
  }

  async function handleCopy() {
    if (!publicId) return;
    let ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(publicId);
        ok = true;
      }
    } catch (err) {
      ok = false;
    }
    if (!ok) {
      ok = await fallbackCopy(publicId);
    }

    if (ok) {
      setCopied(true);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, 2000) as unknown as number;
    }
  }

  return (
    <div className="relative w-full max-w-64">
      <label htmlFor="public-id" className="sr-only">Public ID</label>

      <input
        id="public-id"
        type="text"
        className="col-span-6 block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 pr-20 text-sm text-gray-500 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:placeholder:text-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
        value={publicId || ''}
        disabled
        readOnly
      />

      <div className="sr-only" aria-live="polite" role="status">{copied ? `Skopiowano ${publicId}` : ''}</div>

      <button
        onClick={handleCopy}
        type="button"
        aria-label="Kopiuj ID"
        className="absolute inset-y-0 right-2.5 z-10 inline-flex items-center rounded-lg border border-gray-200 bg-white px-2.5 text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
          className={copied ? 'me-1.5 h-3 w-3 text-blue-700 dark:text-blue-500' : 'me-1.5 h-3 w-3'}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6" />
          <rect x="3" y="3" width="14" height="14" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className={copied ? 'inline-flex items-center text-xs font-semibold text-blue-700 dark:text-blue-500' : 'inline-flex items-center text-xs font-semibold'}>
          {copied ? 'Skopiowano' : 'Kopiuj'}
        </span>
      </button>
    </div>
  );
}
