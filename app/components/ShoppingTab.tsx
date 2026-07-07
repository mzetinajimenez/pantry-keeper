"use client";

import { useMemo, useState } from "react";
import type { Item } from "@/lib/types";
import { CheckIcon, EmptyState, HeaderShell } from "./ui";

type Props = {
  items: Item[];
  menu: React.ReactNode;
  onGotIt: (item: Item) => void;
  onEdit: (item: Item) => void;
  onNeedIt: (item: Item) => void;
  onCreateNeeded: (name: string) => void;
};

const isListed = (it: Item) => it.needed === 1 || it.quantity <= 0;

export default function ShoppingTab({ items, menu, onGotIt, onEdit, onNeedIt, onCreateNeeded }: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const list = useMemo(() => items.filter(isListed), [items]);
  // Live stock checker: any pantry match for the query, with current stock.
  const matches = useMemo(() => {
    if (!q) return [];
    return items
      .filter((it) => it.name.toLowerCase().includes(q) || (it.brand ?? "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [items, q]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q) return;
    const exact = items.find((it) => it.name.trim().toLowerCase() === q);
    if (exact) {
      if (!isListed(exact)) onNeedIt(exact); // don't duplicate a known item
    } else {
      onCreateNeeded(query.trim());
    }
    setQuery("");
  }

  return (
    <>
      <HeaderShell subtitle={`${list.length} to buy`} actions={menu}>
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Check stock or add to shopping list"
            placeholder="Check stock or add… e.g. milk"
            className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base focus:border-pine-600 focus:outline-none focus:ring-1 focus:ring-pine-600"
          />
          <button type="submit" className="rounded-xl bg-pine-600 px-5 font-semibold text-white active:bg-pine-700">
            Add
          </button>
        </form>
      </HeaderShell>

      <main className="px-4 pb-32 pt-3">
        {q ? (
          <>
            <p className="mb-2 text-sm font-medium text-stone-500">In your pantry</p>
            {matches.length === 0 ? (
              <p className="rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-500">
                Nothing called “{query.trim()}” yet — tap Add to put it on the list.
              </p>
            ) : (
              <ul className="space-y-2">
                {matches.map((it) => (
                  <li key={it.id} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
                    <div onClick={() => onEdit(it)} className="min-w-0 flex-1 cursor-pointer">
                      <p className="truncate font-medium text-stone-800">{it.name}</p>
                      <p className={`truncate text-sm ${it.quantity <= 0 ? "font-medium text-terracotta-700" : "text-stone-500"}`}>
                        {it.quantity <= 0 ? "out of stock" : `have ${+it.quantity.toFixed(2)} ${it.unit}`}
                        {it.brand ? ` · ${it.brand}` : ""}
                      </p>
                    </div>
                    {isListed(it) ? (
                      <span className="shrink-0 rounded-full bg-pine-50 px-2.5 py-1 text-xs font-medium text-pine-700">
                        on list
                      </span>
                    ) : (
                      <button
                        onClick={() => onNeedIt(it)}
                        className="shrink-0 rounded-full border border-pine-600 px-3 py-1.5 text-sm font-semibold text-pine-700 active:bg-pine-50"
                      >
                        Need it
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : list.length === 0 ? (
          <EmptyState
            emoji="🎉"
            title="Nothing to buy"
            hint="Type above to check what you have or add something, or flag items from the pantry."
          />
        ) : (
          <ul className="space-y-2">
            {list.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
                <button
                  onClick={() => onGotIt(item)}
                  aria-label="Mark as bought"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-stone-300 text-pine-700 active:bg-pine-50"
                >
                  <CheckIcon />
                </button>
                <div onClick={() => onEdit(item)} className="min-w-0 flex-1 cursor-pointer">
                  <p className="truncate font-medium text-stone-800">{item.name}</p>
                  <p className="truncate text-sm text-stone-500">
                    {item.quantity <= 0 ? "out of stock" : `have ${+item.quantity.toFixed(2)} ${item.unit}`}
                    {item.brand ? ` · ${item.brand}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-stone-400">Got it?</span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
