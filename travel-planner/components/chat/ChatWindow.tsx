"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/auth-helpers-nextjs";
import type { ChatMessageRow } from "src/db/schema";
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import { useRef as useReactRef } from 'react';
import { useChat } from "./ChatContext";
import { cn } from "../../lib/utils";
import useUserGroups, { UserGroup } from "../../hooks/useUserGroups";

type GroupMember = {
  id: string;
  full_name?: string | null;
  username?: string | null;
  public_id?: string | null;
  role?: string | null;
};

interface ChatWindowProps {
  chatId: string;
  userId: string;
}

// Type for group
// Remove Group interface, use UserGroup from useUserGroups

export default function ChatWindow({ chatId, userId }: ChatWindowProps) {
  const { chats, setChatMessages, appendMessage, resetUnread, openGroupChat } = useChat();
  const chat = chats.find((c) => c.id === chatId);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupPrivate, setNewGroupPrivate] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
      ),
    []
  );

  // Use useUserGroups for initial load, but manage local state for instant updates
  const { groups: initialGroups, loading: groupsLoading, error: groupsError } = useUserGroups();
  const [groups, setGroups] = useState<UserGroup[]>(initialGroups);
  // Keep local groups in sync with hook on first load
  useEffect(() => { setGroups(initialGroups); }, [initialGroups]);

  const isGroup = chat ? chat.kind === "group" : false;
  const groupInfo = isGroup && chat ? groups.find((g) => g.id === chat.peerId) : null;

  // Chat history loading: fetch only once per chat open
  useEffect(() => {
    if (!chat) return;
    setLoading(true);
    setError(null);
    let cancelled = false;
    let url = `/api/messages?chatId=${encodeURIComponent(chatId)}`;
    if (chat.kind === "group") {
      url = `/api/messages?groupId=${encodeURIComponent(chat.peerId)}`;
    }
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setChatMessages(chatId, data.messages || []);
          setLoading(false);
          resetUnread(chatId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load messages");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [chatId]);

  useEffect(() => {
    if (!chat) return;

    const sub = supabase
      .channel("chat_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload: { new: ChatMessageRow }) => {
          const msg = payload.new;
          const isFriendMatch =
            chat.kind === "friend" &&
            ((msg.senderId === userId && msg.receiverId === chat.peerId) ||
              (msg.senderId === chat.peerId && msg.receiverId === userId));
          const isGroupMatch = chat.kind === "group" && msg.groupId === chat.peerId;

          if (isFriendMatch || isGroupMatch) {
            appendMessage(chatId, {
              id: msg.id,
              senderId: msg.senderId,
              receiverId: msg.receiverId,
              groupId: msg.groupId,
              content: msg.content || "",
              timestamp: new Date(msg.createdAt).getTime(),
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [appendMessage, chat, chatId, supabase, userId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chat && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat]);
  // Scroll to bottom on new messages
  useEffect(() => {
    if (chat && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat]);

  // Group selector UI
  function renderGroupSelector() {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 w-full max-w-md">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Wybierz grupę</h2>
          {groupsLoading ? (
            <div className="text-gray-500">Ładowanie grup...</div>
          ) : groupsError ? (
            <div className="text-red-500">Błąd: {groupsError.message}</div>
          ) : (
            <>
              <ul className="mb-4 max-h-48 overflow-y-auto">
                {groups.map((g) => (
                  <li key={g.id} className="mb-2">
                    <button
                      className="w-full text-left px-4 py-2 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900 transition"
                      onClick={() => {
                        openGroupChat(g.id, g.name);
                        setShowGroupSelector(false);
                      }}
                    >
                      <span className="font-medium text-gray-900 dark:text-white">{g.name}</span>
                      <span className="ml-2 text-xs text-gray-500">{g.is_private ? 'Prywatna' : 'Publiczna'}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                className="w-full py-2 mt-2 rounded bg-indigo-500 text-white hover:bg-indigo-600 transition"
                onClick={() => setCreatingGroup(true)}
              >Utwórz nową grupę</button>
            </>
          )}
          <button className="mt-4 text-sm text-gray-500 hover:text-gray-700" onClick={() => setShowGroupSelector(false)}>Anuluj</button>
        </div>
      </div>
    );
  }

  const renderGroupCreate = () => (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Utwórz nową grupę</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newGroupName.trim()) return;
            setCreatingGroup(true);
            try {
              const res = await fetch("/api/groups", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newGroupName.trim(), description: newGroupDesc.trim() || null, is_private: newGroupPrivate }),
              });
              const json = await res.json().catch(() => ({}));
              if (!res.ok || json.error) throw new Error(json.error || "Failed to create group");
              setNewGroupName(""); setNewGroupDesc(""); setNewGroupPrivate(false);
              setCreatingGroup(false); setShowGroupSelector(false);
              // Optionally: refresh group list
            } catch (err) {
              setCreatingGroup(false);
              alert("Nie udało się utworzyć grupy");
            }
          }}
        >
          <input className="w-full mb-2 px-3 py-2 rounded border" placeholder="Nazwa grupy" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
          <input className="w-full mb-2 px-3 py-2 rounded border" placeholder="Opis (opcjonalnie)" value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} />
          <label className="flex items-center mb-4">
            <input type="checkbox" className="mr-2" checked={newGroupPrivate} onChange={e => setNewGroupPrivate(e.target.checked)} /> Prywatna grupa
          </label>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2 rounded bg-indigo-500 text-white hover:bg-indigo-600 transition">Utwórz</button>
            <button type="button" className="flex-1 py-2 rounded bg-gray-300 text-gray-700 hover:bg-gray-400 transition" onClick={() => setCreatingGroup(false)}>Anuluj</button>
          </div>
        </form>
      </div>
    </div>
  );

  const header = (
    <div className="flex items-center px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      {isGroup && groupInfo ? (
        <div className="flex-1">
          <div className="font-semibold text-lg text-gray-900 dark:text-white">{groupInfo.name}</div>
          <div className="text-xs text-gray-500 mb-1">
            {groupInfo.is_private ? "Prywatna" : "Publiczna"}
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {groupMembers.length > 0 ? (
              groupMembers.map((m: any) => (
                <span key={m.id} className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200">
                  {m.full_name || m.username || m.public_id || "Uzytkownik"}
                  {m.role === "admin" && <span className="ml-1 text-indigo-500 font-bold">(admin)</span>}
                </span>
              ))
            ) : (
              <span className="text-xs text-gray-400">Brak czlonkow</span>
            )}
          </div>
        </div>
      ) : (
        <div className="font-semibold text-lg text-gray-900 dark:text-white">Czat prywatny</div>
      )}
      <button
        className="ml-2 px-3 py-1 rounded bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-200 text-xs hover:bg-indigo-200 dark:hover:bg-indigo-700"
        onClick={() => setShowGroupSelector(true)}
      >
        Zmien grupe
      </button>
    </div>
  );

  // Empty state and chat body with single parent
  const emptyState = (
    <div className="flex flex-col h-full items-center justify-center">
      <button
        className="px-6 py-3 rounded bg-indigo-500 text-white hover:bg-indigo-600 transition"
        onClick={() => setShowGroupSelector(true)}
      >
        Wybierz grupe
      </button>
      {showGroupSelector && renderGroupSelector()}
      {creatingGroup && renderGroupCreate()}
    </div>
  );

  const chatBody = (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded shadow-md relative">
      {showGroupSelector && renderGroupSelector()}
      {creatingGroup && renderGroupCreate()}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        {isGroup && groupInfo ? (
          <div>
            <div className="font-semibold text-lg text-gray-900 dark:text-white">{groupInfo.name}</div>
            <div className="text-xs text-gray-500 mb-1">{groupInfo.is_private ? 'Prywatna' : 'Publiczna'}</div>
            <div className="flex flex-wrap gap-2 mt-1">
              {groupMembers.length > 0 ? (
                groupMembers.map((m: any) => (
                  <span key={m.id} className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200">
                    {m.full_name || m.username || m.public_id || "Uzytkownik"}
                    {m.role === "admin" && <span className="ml-1 text-indigo-500 font-bold">(admin)</span>}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-400">Brak członków</span>
              )}
            </div>
          </div>
        ) : (
          <div className="font-semibold text-lg text-gray-900 dark:text-white">Czat prywatny</div>
        )}
        <button
          className="ml-2 px-3 py-1 rounded bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-200 text-xs hover:bg-indigo-200 dark:hover:bg-indigo-700"
          onClick={() => setShowGroupSelector(true)}
        >Zmień grupę</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center text-gray-400">Loading...</div>
        ) : error ? (
          <div className="text-center text-red-500">{error}</div>
        ) : chat && chat.messages.length === 0 ? (
          <div className="text-center text-gray-400">No messages yet.</div>
        ) : (
          chat && chat.messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "mb-2 flex",
                msg.senderId === userId ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "px-3 py-2 rounded-lg max-w-xs",
                  msg.senderId === userId
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} className="p-2 border-t border-gray-200 dark:border-gray-700 flex">
        <input
          className="flex-1 rounded-l px-3 py-2 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-r hover:bg-blue-600 transition"
        >
          Send
        </button>
      </form>
    </div>
  );

  // Message send handler
  function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim() || !chat) return;
    setInput("");
    setLoading(true);
    let payload: any = { chatId, content: input };
    if (chat.kind === "group") {
      payload = { groupId: chat.peerId, content: input };
    }
    fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Send failed");
        resetUnread(chatId);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to send message");
        setLoading(false);
      });
  }

  return chat ? chatBody : emptyState;
}
