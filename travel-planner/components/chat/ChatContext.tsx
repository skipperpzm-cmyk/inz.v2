"use client";
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type ChatKind = 'friend' | 'group';

export type Message = {
  id: string;
  senderId: string;
  receiverId?: string | null;
  groupId?: string | null;
  content: string;
  timestamp: number;
  senderName?: string | null;
  senderAvatarUrl?: string | null;
};

export type Chat = {
  id: string;
  kind: ChatKind;
  peerId: string;
  title: string;
  avatarUrl?: string | null;
  messages: Message[];
};

type ChatContextValue = {
  chats: Chat[];
  openChat: (friendId: string, friendName: string, avatarUrl?: string | null) => void;
  openGroupChat: (groupId: string, groupName: string) => void;
  closeChat: (chatId: string) => void;
  setChatMessages: (chatId: string, messages: Message[]) => void;
  appendMessage: (chatId: string, message: Message) => void;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  unreadCounts: Record<string, number>;
  resetUnread: (chatId: string) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

function buildChatId(kind: ChatKind, peerId: string) {
  return `${kind}:${peerId}`;
}


export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const upsertChat = useCallback((next: Omit<Chat, 'messages'> & { messages?: Message[] }) => {
    setChats((prev) => {
      const existing = prev.find((c) => c.id === next.id);
      if (existing) {
        return prev.map((c) => (c.id === next.id ? { ...c, ...next, messages: c.messages } : c));
      }
      return [{ ...next, messages: next.messages ?? [] }, ...prev];
    });
  }, []);


  const resetUnread = useCallback((chatId: string) => {
    setUnreadCounts((prev) => ({ ...prev, [chatId]: 0 }));
  }, []);

  const openChat = useCallback((friendId: string, friendName: string, avatarUrl?: string | null) => {
    const id = buildChatId('friend', friendId);
    upsertChat({ id, kind: 'friend', peerId: friendId, title: friendName, avatarUrl: avatarUrl ?? null });
    setActiveChatId(id);
    setUnreadCounts((prev) => ({ ...prev, [id]: 0 }));
  }, [upsertChat]);

  const openGroupChat = useCallback((groupId: string, groupName: string) => {
    const id = buildChatId('group', groupId);
    upsertChat({ id, kind: 'group', peerId: groupId, title: groupName });
    setActiveChatId(id);
    setUnreadCounts((prev) => ({ ...prev, [id]: 0 }));
  }, [upsertChat]);

  const closeChat = useCallback((chatId: string) => {
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    setActiveChatId((cur) => (cur === chatId ? null : cur));
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
  }, []);

  const setChatMessages = useCallback((chatId: string, messages: Message[]) => {
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, messages } : c)));
  }, []);

  const appendMessage = useCallback((chatId: string, message: Message) => {
    setChats((prev) => prev.map((c) => {
      if (c.id !== chatId) return c;
      if (c.messages.some((m) => m.id === message.id)) return c;
      return { ...c, messages: [...c.messages, message] };
    }));
    setUnreadCounts((prev) => {
      // Only increment if not currently viewing this chat
      if (activeChatId === chatId) return { ...prev, [chatId]: 0 };
      return { ...prev, [chatId]: (prev[chatId] || 0) + 1 };
    });
  }, [activeChatId]);

  const value = useMemo(
    () => ({
      chats,
      openChat,
      openGroupChat,
      closeChat,
      setChatMessages,
      appendMessage,
      activeChatId,
      setActiveChatId,
      unreadCounts,
      resetUnread,
    }),
    [chats, openChat, openGroupChat, closeChat, setChatMessages, appendMessage, activeChatId, unreadCounts, resetUnread]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
