"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useChat, type Message } from './chat/ChatContext';
import { getBrowserSupabase } from '../lib/supabaseClient';

function mapRow(row: any): Message {
  return {
    id: String(row.id),
    senderId: String(row.sender_id),
    receiverId: row.receiver_id ? String(row.receiver_id) : null,
    groupId: row.group_id ? String(row.group_id) : null,
    content: String(row.content ?? ''),
    timestamp: new Date(row.created_at).getTime(),
    senderName: row.sender_name ?? null,
    senderAvatarUrl: row.sender_avatar_url ?? null,
  };
}

export default function ChatWindow() {
  const { chats, activeChatId, appendMessage, setChatMessages } = useChat();
  const active = useMemo(() => chats.find((c) => c.id === activeChatId) || null, [chats, activeChatId]);
  const [text, setText] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/user/me');
        if (!res.ok) return;
        const json = await res.json();
        if (mounted && json?.id) setCurrentUserId(String(json.id));
      } catch (err) {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [active]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [active?.messages.length]);

  // Only fetch history once per chat open
  useEffect(() => {
    if (!active) return;
    let mounted = true;
    // Prevent duplicate fetches by tracking loaded chats
    let alreadyLoaded = false;
    setLoadingHistory(true);
    setHistoryError(null);
    async function loadHistory() {
      try {
        if (!active) throw new Error('No active chat');
        // Only fetch if not already loaded
        if (alreadyLoaded) return;
        alreadyLoaded = true;
        const qs = active.kind === 'group' ? `groupId=${encodeURIComponent(active.peerId)}` : `friendId=${encodeURIComponent(active.peerId)}`;
        const res = await fetch(`/api/messages?${qs}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();
        const rows = Array.isArray(json?.messages) ? json.messages : [];
        const mapped = rows.map(mapRow);
        if (mounted) setChatMessages(active.id, mapped);
      } catch (err: any) {
        if (mounted) setHistoryError(err?.message ?? 'Błąd ładowania historii');
      } finally {
        if (mounted) setLoadingHistory(false);
      }
    }
    loadHistory();
    return () => {
      mounted = false;
    };
  }, [active?.id, setChatMessages]);

  useEffect(() => {
    if (!active) return;
    const supabase = getBrowserSupabase();
    const channel = supabase.channel(`chat:${active.id}`);

    const base = { event: 'INSERT', schema: 'public', table: 'chat_messages' } as const;

    const handler = (payload: any) => {
      const row = payload?.new;
      if (!row) return;
      if (active.kind === 'group') {
        if (String(row.group_id) !== active.peerId) return;
      } else {
        const senderId = String(row.sender_id);
        const receiverId = row.receiver_id ? String(row.receiver_id) : '';
        if (!currentUserId) return;
        const isMatch =
          (senderId === currentUserId && receiverId === active.peerId) ||
          (senderId === active.peerId && receiverId === currentUserId);
        if (!isMatch) return;
      }

      appendMessage(active.id, mapRow(row));
    };

    if (active.kind === 'group') {
      channel.on('postgres_changes', { ...base, filter: `group_id=eq.${active.peerId}` }, handler);
    } else {
      if (currentUserId) {
        channel.on('postgres_changes', { ...base, filter: `sender_id=eq.${currentUserId}` }, handler);
      }
      channel.on('postgres_changes', { ...base, filter: `sender_id=eq.${active.peerId}` }, handler);
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [active, currentUserId, appendMessage]);

  async function handleSend() {
    if (!active || !text.trim()) return;
    setSendError(null);
    setSending(true);
    try {
      const body = active.kind === 'group'
        ? { groupId: active.peerId, content: text.trim() }
        : { friendId: active.peerId, content: text.trim() };

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = await res.json();
      if (json?.message) {
        appendMessage(active.id, mapRow(json.message));
      }
      setText('');
    } catch (err: any) {
      setSendError(err?.message ?? 'Nie udało się wysłać wiadomości');
    } finally {
      setSending(false);
    }
  }

  if (!active) return null;

  return (
    <div className="h-full flex flex-col bg-transparent">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/6">
        {active.kind === 'group' ? (
          <div className="w-10 h-10 rounded-full bg-white/6 flex items-center justify-center text-white">
            <UserGroupIcon className="w-5 h-5" />
          </div>
        ) : active.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={active.avatarUrl} alt={active.title} className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-white/6 flex items-center justify-center text-sm text-white font-semibold">
            {active.title.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm text-white font-semibold truncate">{active.title}</div>
          <div className="text-xs text-white/60">
            {active.kind === 'group' ? 'Czat grupowy' : 'Prywatny czat'}
          </div>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loadingHistory ? (
          <div className="text-xs text-white/60">Ładowanie historii...</div>
        ) : historyError ? (
          <div className="text-xs text-red-400">{historyError}</div>
        ) : active.messages.length === 0 ? (
          <div className="text-xs text-white/60">Brak wiadomości</div>
        ) : (
          active.messages.map((m) => {
            const isMe = currentUserId ? m.senderId === currentUserId : m.senderId === 'me';
            return (
              <div key={m.id} className={`max-w-[80%] ${isMe ? 'ml-auto text-right' : 'mr-auto text-left'}`}>
                <div className={`${isMe ? 'bg-indigo-600 text-white' : 'bg-white/6 text-white'} inline-block px-3 py-2 rounded-lg`}>
                  {active.kind === 'group' && !isMe && m.senderName ? (
                    <div className="text-[11px] text-white/70 mb-1">{m.senderName}</div>
                  ) : null}
                  {m.content}
                </div>
                <div className="text-[11px] text-white/50 mt-1">{new Date(m.timestamp).toLocaleTimeString()}</div>
              </div>
            );
          })
        )}
      </div>

      <div className="px-4 py-3 border-t border-white/6">
        {sendError && <div className="text-xs text-red-400 mb-2">{sendError}</div>}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Napisz wiadomość..."
            className="flex-1 px-3 py-2 rounded-lg bg-white/6 border border-white/8 text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 placeholder:text-xs"
            disabled={sending}
          />

          <button
            onClick={handleSend}
            aria-label="Wyślij"
            className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 flex items-center justify-center text-white disabled:opacity-60"
            disabled={sending}
          >
            <ArrowUpIcon className="w-4 h-4 rotate-45" />
          </button>
        </div>
      </div>
    </div>
  );
}
