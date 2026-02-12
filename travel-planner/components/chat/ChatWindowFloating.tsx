"use client";
import React, { useEffect, useRef, useState } from "react";
import { useChat } from "./ChatContext";
import { cn } from "../../lib/utils";
import { createPortal } from "react-dom";

interface ChatWindowFloatingProps {
  chatId: string;
  userId: string;
  onClose: () => void;
}

export default function ChatWindowFloating({ chatId, userId, onClose }: ChatWindowFloatingProps) {
  const { chats, resetUnread, unreadCounts } = useChat();
  const chat = chats.find((c) => c.id === chatId);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!minimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat?.messages, minimized]);

  // Handle send
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setInput("");
    setLoading(true);
    try {
      let payload: any = { chatId, content: input };
      if (chat && chat.kind === "group") {
        payload = { groupId: chat.peerId, content: input };
      }
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Send failed");
      resetUnread(chatId);
      setLoading(false);
    } catch {
      setError("Failed to send message");
      setLoading(false);
    }
  };

  // Floating window content
  const floatingContent = (
    <div
      className={cn(
        minimized
          ? "fixed bottom-4 right-4 z-[1000] w-16 h-16 bg-blue-500 rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-all duration-300 scale-90 opacity-80"
          : "fixed bottom-4 right-4 z-[1000] w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-300 dark:border-gray-700 flex flex-col transition-all duration-300 scale-100 opacity-100 h-96"
      )}
      style={{
        pointerEvents: "auto",
        transform: minimized ? "translateY(0)" : "translateY(-20px)",
        transition: "transform 0.3s ease-in-out",
      }}
      onClick={minimized ? () => setMinimized(false) : undefined}
    >
      {minimized ? (
        <span className="text-white font-semibold text-lg truncate" title={chat?.title || 'Czat'}>
          {chat?.title ? chat.title[0].toUpperCase() : 'C'}
        </span>
      ) : (
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 rounded-t-xl">
            <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
              {chat?.title || "Czat"}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="text-xs px-2 py-1 rounded bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-700"
                onClick={() => setMinimized(true)}
              >
                Minimalizuj
              </button>
              <button
                className="text-xs px-2 py-1 rounded bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-600"
                onClick={() => {
                  setMinimized(false);
                  setTimeout(onClose, 0);
                }}
              >
                Zamknij
              </button>
            </div>
          </div>
          {/* Chat content */}
          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="text-center text-gray-400">Loading...</div>
            ) : error ? (
              <div className="text-center text-red-500">{error}</div>
            ) : (chat?.messages?.length ?? 0) === 0 ? (
              <div className="text-center text-gray-400">No messages yet.</div>
            ) : (
              chat?.messages?.map((msg) => (
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
          {/* Input */}
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
      )}
      {unreadCounts[chatId] > 0 && minimized && (
        <span className="absolute top-2 right-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">
          {unreadCounts[chatId]}
        </span>
      )}
    </div>
  );

  // Render floating window in portal
  if (typeof window !== "undefined") {
    return createPortal(floatingContent, document.body);
  }
  return null;
}
