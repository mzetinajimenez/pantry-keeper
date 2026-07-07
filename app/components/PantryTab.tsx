"use client";

import { useMemo, useState } from "react";
import type { Item } from "@/lib/types";
import { CartIcon, Chip, EmptyState, ExpiryBadge, HeaderShell, daysUntil } from "./ui";

type SortKey = "name" | "recent" | "expiring";

// Expiring within a week (or already expired) — powers the header chip + filter.
function isExpiring(it: Item): boolean {
  const d = daysUntil(it.expiration_date);
  return d !== null && d <= 7;
}

type Props = {
  items: Item[];
  menu: React.ReactNode;
  onEdit: (item: Item) => void;
  onAdjustQty: (item: Item, delta: number) => void;
  onToggleNeeded: (item: Item) => void;
  onAddManual: () => void;
  onScan: () => void;
};

export default function PantryTab({
  items,
  menu,
  onEdit,
  onAdjustQty,
  onToggleNeeded,
  onAddManual,
  onScan,
}: Props) {
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [expiringOnly, setExpiringOnly] = useState(false);

  const expiringCount = useMemo(() => items.filter(isExpiring).length, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = items.filter((it) => {
      if (locationFilter && it.location !== locationFilter) return false;
      if (expiringOnly && !isExpiring(it)) return false;
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) ||
        (it.brand ?? "").toLowerCase().includes(q) ||
        (it.category ?? "").toLowerCase().includes(q) ||
        (it.barcode ?? "").includes(q)
      );
    });
    const sorted = [...filtered];
    if (sort === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    } else if (sort === "recent") {
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else {
      sorted.sort((a, b) => {
        const aN = a.expiration_date === null;
        const bN = b.expiration_date === null;
        if (aN !== bN) return aN ? 1 : -1;
        return (a.expiration_date ?? "").localeCompare(b.expiration_date ?? "");
      });
    }
    return sorted;
  }, [items, search, locationFilter, sort, expiringOnly]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => it.location && set.add(it.location));
    return [...set].sort();
  }, [items]);

  return (
    <>
      <HeaderShell
        subtitle={`${visible.length} item${visible.length === 1 ? "" : "s"}`}
        actions={
          <>
            <button
              onClick={onAddManual}
              aria-label="Add item manually"
              className="flex h-8 w-8 items-center justify-center rounded-full text-2xl leading-none text-pine-700 active:bg-pine-50"
            >
              ＋
            </button>
            {menu}
          </>
        }
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search pantry items"
          placeholder="Do I have… (name, brand, category)"
          className="mt-3 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base focus:border-pine-600 focus:outline-none focus:ring-1 focus:ring-pine-600"
        />
        <div role="group" aria-label="Filter and sort" className="mt-2 flex gap-2 overflow-x-auto pb-1">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort items"
            className="shrink-0 rounded-full border border-stone-300 bg-white px-3 py-1 text-sm font-medium text-stone-600"
          >
            <option value="name">A–Z</option>
            <option value="recent">Recent</option>
            <option value="expiring">Expiring</option>
          </select>
          {expiringCount > 0 && (
            <Chip active={expiringOnly} onClick={() => setExpiringOnly((v) => !v)} tone="warn">
              ⏳ {expiringCount} expiring
            </Chip>
          )}
          {locations.length > 0 && (
            <>
              <Chip active={!locationFilter} onClick={() => setLocationFilter("")}>
                All
              </Chip>
              {locations.map((loc) => (
                <Chip
                  key={loc}
                  active={locationFilter === loc}
                  onClick={() => setLocationFilter(locationFilter === loc ? "" : loc)}
                >
                  {loc}
                </Chip>
              ))}
            </>
          )}
        </div>
      </HeaderShell>

      <main className="px-4 pb-32 pt-3">
        {visible.length === 0 ? (
          items.length > 0 ? (
            <EmptyState emoji="🔍" title="No matches" hint="Try a different search or filter." />
          ) : (
            <FirstRun onScan={onScan} onAddManual={onAddManual} />
          )
        ) : (
          <ul aria-label="Pantry items" className="space-y-2">
            {visible.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onEdit={onEdit}
                onAdjustQty={onAdjustQty}
                onToggleNeeded={onToggleNeeded}
              />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function ItemRow({
  item,
  onEdit,
  onAdjustQty,
  onToggleNeeded,
}: {
  item: Item;
  onEdit: (item: Item) => void;
  onAdjustQty: (item: Item, delta: number) => void;
  onToggleNeeded: (item: Item) => void;
}) {
  const out = item.quantity <= 0;
  return (
    <li
      className={`flex items-center gap-2 rounded-2xl border bg-white p-3 shadow-sm ${
        out ? "border-terracotta-600/30" : "border-stone-200"
      }`}
    >
      <div onClick={() => onEdit(item)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-stone-50 object-contain" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-lg">
            🥫
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold text-stone-800">{item.name}</p>
          <p className="truncate text-sm text-stone-500">
            {[item.brand, item.location].filter(Boolean).join(" · ") || "—"}
          </p>
          {(item.expiration_date || out) && (
            <div className="mt-1 flex gap-1">
              {out && (
                <span className="inline-block rounded-full bg-terracotta-100 px-2 py-0.5 text-xs font-medium text-terracotta-700">
                  out
                </span>
              )}
              <ExpiryBadge date={item.expiration_date} />
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => onToggleNeeded(item)}
        aria-label={item.needed === 1 ? "On shopping list" : "Add to shopping list"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
          item.needed === 1
            ? "border-pine-600 bg-pine-600 text-white"
            : "border-stone-300 text-stone-400 active:bg-stone-100"
        }`}
      >
        <CartIcon />
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => onAdjustQty(item, -1)}
          aria-label="Decrease"
          className="h-9 w-9 rounded-full border border-stone-300 text-lg text-stone-600 active:bg-stone-100"
        >
          −
        </button>
        <span className="w-11 text-center tabular-nums">
          <span className={`text-lg font-bold ${out ? "text-terracotta-600" : "text-stone-900"}`}>
            {+item.quantity.toFixed(2)}
          </span>
          <span className="block text-[11px] leading-none text-stone-400">{item.unit}</span>
        </span>
        <button
          onClick={() => onAdjustQty(item, 1)}
          aria-label="Increase"
          className="h-9 w-9 rounded-full border border-stone-300 text-lg text-stone-600 active:bg-stone-100"
        >
          +
        </button>
      </div>
    </li>
  );
}

function FirstRun({ onScan, onAddManual }: { onScan: () => void; onAddManual: () => void }) {
  return (
    <div className="px-2 py-10 text-center">
      <p className="text-5xl">🥫</p>
      <h2 className="font-display mt-4 text-2xl font-bold text-pine-800">Welcome to your pantry</h2>
      <ol className="mx-auto mt-6 max-w-xs space-y-4 text-left">
        <Step n={1} title="Add what you have" text="Scan a barcode or add items by hand." />
        <Step n={2} title="See it at a glance" text="Quantity, location, and expiry for everything." />
        <Step n={3} title="Cook & shop smarter" text="Build recipes to see what you can make, and shop from one list." />
      </ol>
      <button
        onClick={onScan}
        className="mt-8 w-full max-w-xs rounded-xl bg-pine-600 py-3.5 font-semibold text-white shadow-sm active:bg-pine-700"
      >
        📷 Scan your first item
      </button>
      <button
        onClick={onAddManual}
        className="mx-auto mt-3 block w-full max-w-xs rounded-xl border border-stone-300 bg-white py-3 font-medium text-stone-700 active:bg-stone-100"
      >
        Add by hand
      </button>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pine-100 text-sm font-bold text-pine-800">
        {n}
      </span>
      <div>
        <p className="font-semibold text-stone-800">{title}</p>
        <p className="text-sm text-stone-500">{text}</p>
      </div>
    </li>
  );
}
