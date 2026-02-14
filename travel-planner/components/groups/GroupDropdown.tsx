"use client";
import React, { useEffect, useRef } from "react";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import type { Group } from "../../types/group";

type Props = {
  group: Group;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onManage: () => void;
  showManage: boolean;
};

export default function GroupDropdown({ group, isOpen, onToggle, onClose, onManage, showManage }: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  if (!showManage) return null;

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [isOpen, onClose]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
        onClick={onToggle}
        aria-label={`Group actions for ${group.name}`}
      >
        <EllipsisVerticalIcon className="w-5 h-5" />
      </button>
      <div
        className={`absolute right-0 mt-[3px] min-w-max whitespace-nowrap rounded-lg border border-white/10 bg-black/60 backdrop-blur-xl shadow-xl p-1 transform transition-all duration-150 ease-out z-[9999] ${
          isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
        }`}
      >
        {showManage && (
          <button
            type="button"
            className="w-full text-left px-3 py-1 rounded text-xs text-white/90 hover:bg-white/10 transition whitespace-nowrap flex items-center"
            onClick={() => {
              onManage();
              onClose();
            }}
          >
            Zarządzaj grupą
          </button>
        )}
      </div>
    </div>
  );
}
