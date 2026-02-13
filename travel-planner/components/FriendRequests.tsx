"use client";

import React, { useState, useEffect } from 'react';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { FriendInvite, useFriendContext } from './FriendContext';

interface FriendRequestsProps {
  onAccepted?: (invite: FriendInvite) => void;
  onRejected?: (invite: FriendInvite) => void;
  setTooltip?: (t: { text: string; x: number; y: number } | null) => void;
}

export default function FriendRequests({ onAccepted, onRejected, setTooltip }: FriendRequestsProps) {
  const { pendingInvites, sentInvites, invitesLoading, acceptInvite, rejectInvite, cancelInvite } = useFriendContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout | undefined;
    if (loading || invitesLoading) {
      timeout = setTimeout(() => setShowLoader(true), 500);
    } else {
      setShowLoader(false);
    }
    return () => timeout && clearTimeout(timeout);
  }, [loading, invitesLoading]);

  async function handleAccept(invite: FriendInvite) {
    try {
      setLoading(true);
      await acceptInvite(invite.id);
      onAccepted?.(invite);
      if (setTooltip) setTooltip(null);
    } catch (err) {
      setError('Błąd akceptacji');
    } finally {
      setLoading(false);
    }
  }

  async function handleReject(invite: FriendInvite) {
    try {
      setLoading(true);
      await rejectInvite(invite.id);
      onRejected?.(invite);
      if (setTooltip) setTooltip(null);
    } catch (err) {
      setError('Błąd odrzucenia');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(invite: FriendInvite) {
    try {
      setLoading(true);
      await cancelInvite(invite.id);
    } catch (err) {
      setError('Błąd usuwania zaproszenia');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto rounded-lg py-4">
      {(loading || invitesLoading) ? (
        showLoader ? (
          <div className="flex justify-center items-center py-6">
            <span className="inline-block animate-spin rounded-full border-4 border-indigo-400 border-t-transparent dark:border-indigo-300 dark:border-t-transparent w-8 h-8" />
          </div>
        ) : (
          <div className="py-6" />
        )
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : pendingInvites.length === 0 && sentInvites.length === 0 ? (
        <div className="text-xs text-white/60">Brak zaproszeń</div>
      ) : (
        <div className="space-y-4 animate-slidein">
          {pendingInvites.length > 0 && (
            <div>
              <div className="text-xs text-white/60 mb-2">Przychodzące</div>
              <ul className="space-y-2">
                {pendingInvites.map((invite) => (
                  <li key={invite.id} className="py-0.5 m-0 relative">
                    <div className="w-full text-left rounded-lg transition group bg-transparent hover:bg-indigo-400/30 transition-transform duration-100 flex items-center gap-2 pr-[5px]">
                      <div className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center text-sm font-semibold text-white relative">
                        {invite.from_avatar_url ? (
                          <img src={invite.from_avatar_url} alt={invite.from_name || 'avatar'} className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <span>{(invite.from_name || '??').slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate transition-colors duration-200 text-white group-hover:text-indigo-100 group-focus:text-indigo-50">{invite.from_name}</div>
                        <div className="text-xs text-white/60">ID: {invite.from_public_id}</div>
                      </div>
                      <button
                        aria-label="Akceptuj zaproszenie"
                        className="w-6 h-6 flex items-center justify-center rounded-full border border-green-400 text-green-500 hover:bg-green-500 hover:text-white transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-green-300 -ml-[2px]"
                        onClick={(e) => {
                          if (setTooltip) setTooltip(null);
                          e.currentTarget.blur();
                          handleAccept(invite);
                        }}
                        onMouseEnter={e => {
                          if (setTooltip) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({ text: 'Akceptuj', x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                          }
                        }}
                        onMouseLeave={() => setTooltip && setTooltip(null)}
                        onFocus={e => {
                          if (setTooltip) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({ text: 'Akceptuj', x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                          }
                        }}
                        onBlur={() => setTooltip && setTooltip(null)}
                      >
                        <CheckIcon className="w-3 h-3" />
                      </button>
                      <button
                        aria-label="Odrzuć zaproszenie"
                        className="w-6 h-6 flex items-center justify-center rounded-full border border-red-400 text-red-500 hover:bg-red-500 hover:text-white transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-red-300 -ml-[2px]"
                        onClick={(e) => {
                          if (setTooltip) setTooltip(null);
                          e.currentTarget.blur();
                          handleReject(invite);
                        }}
                        onMouseEnter={e => {
                          if (setTooltip) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({ text: 'Odrzuć', x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                          }
                        }}
                        onMouseLeave={() => setTooltip && setTooltip(null)}
                        onFocus={e => {
                          if (setTooltip) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({ text: 'Odrzuć', x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                          }
                        }}
                        onBlur={() => setTooltip && setTooltip(null)}
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sentInvites.length > 0 && (
            <div>
              <div className="text-xs text-white/60 mb-2">Wysłane</div>
              <ul className="space-y-2">
                {sentInvites.map((invite) => (
                  <li key={invite.id} className="py-0.5 m-0 relative">
                    <div className="w-full text-left rounded-lg transition group bg-transparent hover:bg-indigo-400/30 transition-transform duration-100 flex items-center gap-2 pr-[5px]">
                      <div className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center text-sm font-semibold text-white relative">
                        {invite.to_avatar_url ? (
                          <img src={invite.to_avatar_url} alt={invite.to_name || 'avatar'} className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <span>{(invite.to_name || '??').slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate transition-colors duration-200 text-white group-hover:text-indigo-100 group-focus:text-indigo-50">{invite.to_name ?? 'Nieznany'}</div>
                        <div className="text-xs text-white/60">ID: {invite.to_public_id}</div>
                      </div>
                      <div className="relative ml-2">
                        <button
                          aria-label="Usuń wysłane zaproszenie"
                          className="w-6 h-6 flex items-center justify-center rounded-full border border-red-400 text-red-500 hover:bg-red-500 hover:text-white transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-red-300"
                          onClick={e => {
                            if (setTooltip) setTooltip(null);
                            e.currentTarget.blur();
                            handleCancel(invite);
                          }}
                          onMouseEnter={e => {
                            if (setTooltip) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltip({ text: 'Cofnij zaproszenie', x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                            }
                          }}
                          onMouseLeave={() => setTooltip && setTooltip(null)}
                          onFocus={e => {
                            if (setTooltip) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltip({ text: 'Cofnij zaproszenie', x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                            }
                          }}
                          onBlur={() => setTooltip && setTooltip(null)}
                        >
                          <XMarkIcon className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
