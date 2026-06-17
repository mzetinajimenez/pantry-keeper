"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Item, ItemInput } from "@/lib/types";
import * as api from "@/lib/api";
import Scanner from "./Scanner";
import ItemForm from "./ItemForm";

type Toast = { id: number; text: string };

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function ExpiryBadge({ date }: { date: string | null }) {
  const d = daysUntil(date);
  if (d === null) return null;
  let cls = "bg-slate-100 text-slate-600";
  let text = `exp ${date}`;
  if (d < 0) {
    cls = "bg-red-100 text-red-700";
    text = "expired";
  } else if (d === 0) {
    cls = "bg-red-100 text-red-700";
    text = "today";
  } else if (d <= 7) {
    cls = "bg-amber-100 text-amber-700";
    text = `${d}d left`;
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{text}</span>;
}

export default function InventoryClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [adding, setAdding] = useState<Partial<Item> | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await api.fetchItems();
      setItems(data);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Derived: client-side filtering keeps the list snappy as you type.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (locationFilter && it.location !== locationFilter) return false;
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) ||
        (it.brand ?? "").toLowerCase().includes(q) ||
        (it.category ?? "").toLowerCase().includes(q) ||
        (it.barcode ?? "").includes(q)
      );
    });
  }, [items, search, locationFilter]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => it.location && set.add(it.location));
    return [...set].sort();
  }, [items]);

  const totalQty = useMemo(
    () => filtered.reduce((sum, it) => sum + it.quantity, 0),
    [filtered]
  );

  async function adjustQty(item: Item, delta: number) {
    const next = Math.max(0, item.quantity + delta);
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, quantity: next } : it)));
    try {
      await api.updateItem(item.id, { quantity: next });
    } catch (e) {
      toast((e as Error).message);
      load();
    }
  }

  async function handleDetected(barcode: string) {
    setScanning(false);
    const existing = items.find((it) => it.barcode === barcode);
    if (existing) {
      await adjustQty(existing, 1);
      toast(`+1 ${existing.name} (now ${existing.quantity + 1})`);
      return;
    }
    // New barcode — try to enrich, then open the add form prefilled.
    let prefill: Partial<Item> = { barcode, quantity: 1 };
    try {
      const product = await api.lookupBarcode(barcode);
      if (product.found) {
        prefill = {
          barcode,
          name: product.name ?? "",
          brand: product.brand,
          category: product.category,
          image_url: product.image_url,
          quantity: 1,
        };
        toast(`Found: ${product.name}`);
      } else {
        toast("Product not in database — add it manually");
      }
    } catch {
      toast("Lookup failed — add it manually");
    }
    setAdding(prefill);
  }

  async function handleCreate(input: ItemInput) {
    await api.createItem(input);
    setAdding(null);
    await load();
    toast(`Added ${input.name}`);
  }

  async function handleUpdate(input: ItemInput) {
    if (!editing) return;
    await api.updateItem(editing.id, input);
    setEditing(null);
    await load();
    toast("Saved");
  }

  async function handleDelete() {
    if (!editing) return;
    const name = editing.name;
    await api.deleteItem(editing.id);
    setEditing(null);
    await load();
    toast(`Deleted ${name}`);
  }

  return (
    <div className="mx-auto min-h-full max-w-2xl">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <div className="flex items-baseline justify-between">
            <h1 className="text-xl font-bold tracking-tight">🥫 Pantry Keeper</h1>
            <span className="text-sm text-slate-500">
              {filtered.length} item{filtered.length === 1 ? "" : "s"} · {totalQty} total
            </span>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, brand, category…"
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          {locations.length > 0 && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
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
            </div>
          )}
        </div>
      </header>

      {/* List */}
      <main className="px-4 pb-32 pt-3">
        {loading ? (
          <p className="py-16 text-center text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState hasItems={items.length > 0} />
        ) : (
          <ul className="space-y-2">
            {filtered.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <button
                  onClick={() => setEditing(item)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg bg-slate-50 object-contain"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg">
                      🥫
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="truncate text-sm text-slate-500">
                      {[item.brand, item.location].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <div className="mt-1">
                      <ExpiryBadge date={item.expiration_date} />
                    </div>
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => adjustQty(item, -1)}
                    aria-label="Decrease"
                    className="h-9 w-9 rounded-full border border-slate-300 text-lg text-slate-600 active:bg-slate-100"
                  >
                    −
                  </button>
                  <span className="w-12 text-center tabular-nums">
                    <span className="font-semibold">{+item.quantity.toFixed(2)}</span>
                    <span className="block text-[11px] leading-none text-slate-400">{item.unit}</span>
                  </span>
                  <button
                    onClick={() => adjustQty(item, 1)}
                    aria-label="Increase"
                    className="h-9 w-9 rounded-full border border-slate-300 text-lg text-slate-600 active:bg-slate-100"
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-3 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            onClick={() => setScanning(true)}
            className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 font-semibold text-white shadow-sm active:bg-green-700"
          >
            <CameraIcon /> Scan item
          </button>
          <button
            onClick={() => setAdding({ quantity: 1 })}
            className="flex flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white py-3.5 font-semibold text-slate-700 active:bg-slate-100"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Toasts */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto max-w-sm rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg"
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* Overlays */}
      {scanning && (
        <Scanner onDetected={handleDetected} onClose={() => setScanning(false)} />
      )}
      {adding && (
        <ItemForm
          title="Add item"
          submitLabel="Add to pantry"
          initial={adding}
          onSubmit={handleCreate}
          onCancel={() => setAdding(null)}
        />
      )}
      {editing && (
        <ItemForm
          title="Edit item"
          submitLabel="Save changes"
          initial={editing}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
        active
          ? "bg-green-600 text-white"
          : "border border-slate-300 bg-white text-slate-600"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ hasItems }: { hasItems: boolean }) {
  return (
    <div className="py-16 text-center text-slate-500">
      <p className="text-4xl">🧺</p>
      <p className="mt-3 font-medium">
        {hasItems ? "No matches" : "Your pantry is empty"}
      </p>
      <p className="mt-1 text-sm">
        {hasItems
          ? "Try a different search or filter."
          : "Tap “Scan item” to add your first product."}
      </p>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
