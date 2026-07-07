"use client";

import { useEffect, useRef, useState } from "react";
import { DotsIcon } from "./ui";

export default function BackupMenu({
  onExport,
  onImport,
}: {
  onExport: () => void;
  onImport: (file: File) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Backup and data"
        className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 active:bg-stone-100"
      >
        <DotsIcon />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-30 w-48 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
        >
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onExport();
            }}
            className="block w-full px-4 py-2.5 text-left text-sm active:bg-stone-100"
          >
            ⬇ Export backup
          </button>
          <button
            role="menuitem"
            onClick={() => fileRef.current?.click()}
            className="block w-full px-4 py-2.5 text-left text-sm active:bg-stone-100"
          >
            ⬆ Import backup…
          </button>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          setOpen(false);
          if (file) onImport(file);
        }}
      />
    </div>
  );
}
