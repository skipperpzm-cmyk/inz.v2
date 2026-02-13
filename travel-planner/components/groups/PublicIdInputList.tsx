"use client";
import React, { useMemo, useState } from "react";

type Props = {
  label?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  helperText?: string;
};

function isValidPublicId(value: string) {
  return /^\d{8}$/.test(value);
}

function normalizePublicIds(text: string) {
  return text
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function PublicIdInputList({ label, value, onChange, placeholder, helperText }: Props) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const existing = useMemo(() => new Set(value), [value]);

  const addFromInput = (raw: string) => {
    const parts = normalizePublicIds(raw);
    const valid: string[] = [];
    const invalid: string[] = [];

    parts.forEach((p) => {
      if (isValidPublicId(p)) valid.push(p);
      else invalid.push(p);
    });

    if (invalid.length > 0) {
      setError("Wszystkie ID muszą mieć 8 cyfr");
      return;
    }

    if (valid.length === 0) {
      setError("Wpisz publiczne ID");
      return;
    }

    const next = [...value];
    valid.forEach((id) => {
      if (!existing.has(id)) next.push(id);
    });
    onChange(next);
    setInput("");
    setError(null);
  };

  return (
    <div className="space-y-2">
      {label && <div className="text-xs text-white/70 uppercase tracking-widest">{label}</div>}
      {helperText && <div className="text-xs text-slate-300">{helperText}</div>}
      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/[^\d,\s]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addFromInput(input);
            }
          }}
          placeholder={placeholder ?? "Publiczne ID"}
          className="flex-1 px-3 py-2 rounded-lg bg-white/6 border border-white/10 text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        />
        <button
          type="button"
          onClick={() => addFromInput(input)}
          className="px-3 py-2 rounded-lg bg-indigo-500/80 text-white text-xs font-semibold hover:bg-indigo-500 transition"
        >
          Dodaj
        </button>
      </div>
      {error && <div className="text-xs text-red-400">{error}</div>}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((id) => (
            <span key={id} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs text-white">
              {id}
              <button
                type="button"
                onClick={() => onChange(value.filter((item) => item !== id))}
                className="text-white/70 hover:text-white"
                aria-label={`Usuń ${id}`}
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
