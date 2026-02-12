"use client";
import React, { useMemo } from 'react';
import { useChat } from './ChatContext';
import ChatWindowFloating from './ChatWindowFloating';

function getSnippet(text: string, max = 42) {
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

export default function ChatBubbles() {
  const { chats, activeChatId, setActiveChatId, unreadCounts, resetUnread } = useChat();
  const [floatingChatId, setFloatingChatId] = React.useState<string | null>(null);
  const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : '';

  React.useEffect(() => {
    const handler = (e: any) => {
      if (e.detail && e.detail.chatId) {
        setFloatingChatId(e.detail.chatId);
        resetUnread(e.detail.chatId);
      }
    };
    window.addEventListener('openFloatingChat', handler);
    return () => window.removeEventListener('openFloatingChat', handler);
  }, [resetUnread]);

  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      const aTime = a.messages[a.messages.length - 1]?.timestamp ?? 0;
      const bTime = b.messages[b.messages.length - 1]?.timestamp ?? 0;
      return bTime - aTime;
    });
  }, [chats]);

  if (sortedChats.length === 0 && !floatingChatId) return null;

  return (
    <>
      {/* Floating chat bubbles flex container removed */}
      {floatingChatId && (
        <ChatWindowFloating
          chatId={floatingChatId}
          userId={userId}
          onClose={() => setFloatingChatId(null)}
        />
      )}
    </>
  );
}
