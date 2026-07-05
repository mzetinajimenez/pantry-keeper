"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Item, ItemInput, Recipe } from "@/lib/types";
import * as api from "@/lib/api";
import Scanner from "./Scanner";
import ItemForm from "./ItemForm";

type Toast = { id: number; text: string };
type Tab = "pantry" | "shopping";

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
    text = "⚠ expired";
  } else if (d === 0) {
    cls = "bg-red-100 text-red-700";
    text = "⚠ today";
  } else if (d <= 7) {
    cls = "bg-amber-100 text-amber-700";
    text = `${d}d left`;
  }
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {text}
    </span>
  );
}

export default function InventoryClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pantry");
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [adding, setAdding] = useState<Partial<Item> | null>(null);
  const [listInput, setListInput] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const load = useCallback(async () => {
    try {
      setItems(await api.fetchItems());
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    // Best-effort, fire-and-forget: lower the odds of the browser evicting
    // IndexedDB (the only copy of the pantry). Failure is fine.
    void api.requestPersistentStorage();
  }, [load]);

  const isNeeded = (it: Item) => it.needed === 1 || it.quantity <= 0;

  const shoppingItems = useMemo(() => items.filter(isNeeded), [items]);

  // Pantry view: client-side search + location filter keeps typing snappy.
  const pantryItems = useMemo(() => {
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
    () => pantryItems.reduce((sum, it) => sum + it.quantity, 0),
    [pantryItems]
  );

  // Patch one item locally for optimistic UI, then persist.
  async function patchLocal(id: number, patch: Partial<ItemInput>, optimistic: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...optimistic } : it)));
    try {
      await api.updateItem(id, patch);
    } catch (e) {
      toast((e as Error).message);
      load();
    }
  }

  function adjustQty(item: Item, delta: number) {
    const next = Math.max(0, item.quantity + delta);
    patchLocal(item.id, { quantity: next }, { quantity: next });
  }

  function toggleNeeded(item: Item) {
    const next = item.needed === 1 ? 0 : 1;
    patchLocal(item.id, { needed: next }, { needed: next });
    toast(next ? `Added ${item.name} to shopping list` : `Removed ${item.name} from list`);
  }

  // "Got it" at the store: clear the flag and add one to stock.
  function gotIt(item: Item) {
    const nextQty = item.quantity + 1;
    patchLocal(item.id, { needed: 0, quantity: nextQty }, { needed: 0, quantity: nextQty });
    toast(`Got ${item.name} — now ${+nextQty.toFixed(2)} in stock`);
  }

  async function addToList(e: React.FormEvent) {
    e.preventDefault();
    const name = listInput.trim();
    if (!name) return;
    setListInput("");
    try {
      await api.createItem({ name, quantity: 0, needed: true });
      await load();
      toast(`Added ${name} to shopping list`);
    } catch (err) {
      toast((err as Error).message);
    }
  }

  async function handleDetected(barcode: string) {
    setScanning(false);
    const existing = items.find((it) => it.barcode === barcode);
    if (existing) {
      adjustQty(existing, 1);
      toast(`+1 ${existing.name} (now ${existing.quantity + 1})`);
      return;
    }
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

  // Backup: data lives only in this browser, so let the user save/restore a JSON copy.
  async function handleExport() {
    try {
      const data = await api.exportData();
      const payload = {
        app: "pantry-keeper",
        version: 2,
        exported_at: new Date().toISOString(),
        items: data.items,
        recipes: data.recipes,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pantry-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast(
        `Exported ${data.items.length} item${data.items.length === 1 ? "" : "s"} + ${data.recipes.length} recipe${data.recipes.length === 1 ? "" : "s"}`,
      );
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function handleImportFile(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      // v1 backups are a bare array or { items }; v2 adds { recipes }.
      const rawItems = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown })?.items;
      const rawRecipes = Array.isArray(parsed) ? undefined : (parsed as { recipes?: unknown })?.recipes;
      if (!Array.isArray(rawItems) || rawItems.length === 0) throw new Error("no items found");
      const restoredItems = rawItems as Item[];
      if (!restoredItems.every((it) => it && typeof it.name === "string")) {
        throw new Error("file is malformed");
      }
      let restoredRecipes: Recipe[] | undefined;
      if (rawRecipes !== undefined) {
        if (!Array.isArray(rawRecipes)) throw new Error("file is malformed");
        restoredRecipes = rawRecipes as Recipe[];
        if (!restoredRecipes.every((r) => r && typeof r.name === "string" && Array.isArray(r.ingredients))) {
          throw new Error("file is malformed");
        }
      }
      if (
        items.length > 0 &&
        !window.confirm(
          `Replace all ${items.length} current item${items.length === 1 ? "" : "s"}${
            restoredRecipes ? " and all recipes" : ""
          } with this backup (${restoredItems.length} item${restoredItems.length === 1 ? "" : "s"}${
            restoredRecipes ? ` + ${restoredRecipes.length} recipe${restoredRecipes.length === 1 ? "" : "s"}` : ""
          })? This can't be undone.`
        )
      ) {
        return;
      }
      const n = await api.importData({ items: restoredItems, recipes: restoredRecipes });
      await load();
      toast(
        `Restored ${n.items} item${n.items === 1 ? "" : "s"}${
          restoredRecipes ? ` + ${n.recipes} recipe${n.recipes === 1 ? "" : "s"}` : ""
        }`
      );
    } catch (e) {
      toast(`Import failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="mx-auto min-h-full max-w-2xl">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-bold tracking-tight">🥫 Pantry Keeper</h1>
            <div className="flex items-center gap-1">
              <span className="text-sm text-slate-500">
                {tab === "pantry"
                  ? `${pantryItems.length} item${pantryItems.length === 1 ? "" : "s"} · ${+totalQty.toFixed(2)} total`
                  : `${shoppingItems.length} to buy`}
              </span>
              <BackupMenu onExport={handleExport} onImport={handleImportFile} />
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-3 flex rounded-lg bg-slate-100 p-1">
            <TabButton active={tab === "pantry"} onClick={() => setTab("pantry")}>
              Pantry
            </TabButton>
            <TabButton active={tab === "shopping"} onClick={() => setTab("shopping")}>
              Shopping
              {shoppingItems.length > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 text-xs ${
                    tab === "shopping" ? "bg-green-100 text-green-700" : "bg-slate-300 text-slate-700"
                  }`}
                >
                  {shoppingItems.length}
                </span>
              )}
            </TabButton>
          </div>

          {tab === "pantry" ? (
            <>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search pantry items"
                placeholder="Search by name, brand, category…"
                className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              {locations.length > 0 && (
                <div
                  role="group"
                  aria-label="Filter by location"
                  className="mt-2 flex gap-2 overflow-x-auto pb-1"
                >
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
            </>
          ) : (
            <form onSubmit={addToList} className="mt-3 flex gap-2">
              <input
                value={listInput}
                onChange={(e) => setListInput(e.target.value)}
                placeholder="Add to shopping list…"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-green-600 px-5 font-semibold text-white active:bg-green-700"
              >
                Add
              </button>
            </form>
          )}
        </div>
      </header>

      {/* List */}
      <main className="px-4 pb-32 pt-3">
        {loading ? (
          <p className="py-16 text-center text-slate-400">Loading…</p>
        ) : tab === "pantry" ? (
          pantryItems.length === 0 ? (
            <EmptyState
              emoji="🧺"
              title={items.length > 0 ? "No matches" : "Your pantry is empty"}
              hint={
                items.length > 0
                  ? "Try a different search or filter."
                  : "Tap “Scan item” to add your first product."
              }
            />
          ) : (
            <ul aria-label="Pantry items" className="space-y-2">
              {pantryItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div
                    onClick={() => setEditing(item)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
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
                      {item.expiration_date && (
                        <div className="mt-1">
                          <ExpiryBadge date={item.expiration_date} />
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => toggleNeeded(item)}
                    aria-label={item.needed === 1 ? "On shopping list" : "Add to shopping list"}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                      item.needed === 1
                        ? "border-green-600 bg-green-600 text-white"
                        : "border-slate-300 text-slate-400 active:bg-slate-100"
                    }`}
                  >
                    <CartIcon />
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => adjustQty(item, -1)}
                      aria-label="Decrease"
                      className="h-9 w-9 rounded-full border border-slate-300 text-lg text-slate-600 active:bg-slate-100"
                    >
                      −
                    </button>
                    <span className="w-10 text-center tabular-nums">
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
          )
        ) : shoppingItems.length === 0 ? (
          <EmptyState
            emoji="🎉"
            title="Nothing to buy"
            hint="Flag items as “need more” or add things above, and they’ll show up here."
          />
        ) : (
          <ul className="space-y-2">
            {shoppingItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <button
                  onClick={() => gotIt(item)}
                  aria-label="Mark as bought"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 text-green-600 active:bg-green-50"
                >
                  <CheckIcon />
                </button>
                <div onClick={() => setEditing(item)} className="min-w-0 flex-1 cursor-pointer">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="truncate text-sm text-slate-500">
                    {item.quantity <= 0
                      ? "out of stock"
                      : `have ${+item.quantity.toFixed(2)} ${item.unit}`}
                    {item.brand ? ` · ${item.brand}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-slate-400">Got it?</span>
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
      {scanning && <Scanner onDetected={handleDetected} onClose={() => setScanning(false)} />}
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

function TabButton({
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
      className={`flex flex-1 items-center justify-center rounded-md py-2 text-sm font-semibold transition ${
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
      }`}
    >
      {children}
    </button>
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
        active ? "bg-green-600 text-white" : "border border-slate-300 bg-white text-slate-600"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ emoji, title, hint }: { emoji: string; title: string; hint: string }) {
  return (
    <div className="py-16 text-center text-slate-500">
      <p className="text-4xl">{emoji}</p>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm">{hint}</p>
    </div>
  );
}

function BackupMenu({
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
        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
      >
        <DotsIcon />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-30 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onExport();
            }}
            className="block w-full px-4 py-2.5 text-left text-sm active:bg-slate-100"
          >
            ⬇ Export backup
          </button>
          <button
            role="menuitem"
            onClick={() => fileRef.current?.click()}
            className="block w-full px-4 py-2.5 text-left text-sm active:bg-slate-100"
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

function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
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

function CartIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
