"use client";

import { useRef, useState } from "react";
import type { Item, ItemInput } from "@/lib/types";
import { CATEGORIES, LOCATIONS, UNITS } from "@/lib/types";
import { useModalA11y } from "@/lib/useModalA11y";

// Local-time "today + n days" as YYYY-MM-DD (matches <input type="date">).
function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const EXP_PRESETS = [
  { label: "1 day", days: 1 },
  { label: "2 days", days: 2 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
];

type Props = {
  initial?: Partial<Item>;
  title: string;
  submitLabel: string;
  onSubmit: (input: ItemInput) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
};

export default function ItemForm({
  initial = {},
  title,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: Props) {
  const [name, setName] = useState(initial.name ?? "");
  const [brand, setBrand] = useState(initial.brand ?? "");
  const initialCategory = initial.category ?? "";
  const [category, setCategory] = useState(initialCategory);
  // Show the free-text box when an existing category isn't one of the presets
  // (e.g. a category auto-filled from a barcode lookup).
  const [categoryCustom, setCategoryCustom] = useState(
    initialCategory !== "" && !(CATEGORIES as readonly string[]).includes(initialCategory),
  );
  const [quantity, setQuantity] = useState(initial.quantity ?? 1);
  const [unit, setUnit] = useState(initial.unit ?? "each");
  const [location, setLocation] = useState(initial.location ?? "Pantry");
  const initialExpiration = initial.expiration_date ?? "";
  const [expiration, setExpiration] = useState(initialExpiration);
  // Editing an item with a fixed date drops straight into the date picker;
  // a freshly matched preset (today + n) keeps its chip highlighted instead.
  const [expirationCustom, setExpirationCustom] = useState(
    initialExpiration !== "" &&
      !EXP_PRESETS.some((p) => addDays(p.days) === initialExpiration),
  );
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [needed, setNeeded] = useState(Boolean(initial.needed));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useModalA11y(panelRef, onCancel);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        barcode: initial.barcode ?? null,
        name: name.trim(),
        brand: brand.trim() || null,
        category: category.trim() || null,
        quantity: Number(quantity) || 0,
        unit,
        location: location || null,
        expiration_date: expiration || null,
        image_url: initial.image_url ?? null,
        notes: notes.trim() || null,
        needed,
      });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-pine-600 focus:outline-none focus:ring-1 focus:ring-pine-600";
  const label = "mb-1 block text-sm font-medium text-stone-600";
  const chip = (active: boolean) =>
    `rounded-full border px-3.5 py-2 text-sm font-medium transition active:scale-95 ${
      active
        ? "border-pine-600 bg-pine-600 text-white"
        : "border-stone-300 text-stone-600 active:bg-stone-100"
    }`;

  return (
    <div className="fixed inset-x-0 top-0 z-40 flex h-dvh items-end justify-center bg-black/40 sm:items-center">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-form-title"
        tabIndex={-1}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl"
      >
        <div className="flex items-center justify-between p-5 pb-4">
          <h2 id="item-form-title" className="font-display text-lg font-semibold">{title}</h2>
          <button onClick={onCancel} className="text-sm text-stone-500 active:text-stone-700">
            Close
          </button>
        </div>

        {(initial.image_url || initial.barcode) && (
          <div className="mx-5 mb-3 flex items-center gap-3 rounded-lg bg-stone-50 p-3">
            {initial.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={initial.image_url} alt="" className="h-14 w-14 rounded object-contain" />
            )}
            {initial.barcode && (
              <span className="font-mono text-sm text-stone-500">{initial.barcode}</span>
            )}
          </div>
        )}

        {/* Scrollable body; the submit footer below stays pinned in view. */}
        <form id="item-form" onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
          <div>
            <label className={label}>Name *</label>
            <input
              autoFocus={!name}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={field}
              placeholder="e.g. Canned Black Beans"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Brand</label>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} className={field} />
            </div>
            <div className="space-y-2">
              <label className={label}>Category</label>
              <select
                value={categoryCustom ? "__custom__" : category}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__custom__") {
                    setCategoryCustom(true);
                    setCategory("");
                  } else {
                    setCategoryCustom(false);
                    setCategory(v);
                  }
                }}
                className={field}
              >
                <option value="">Uncategorized</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__custom__">Custom…</option>
              </select>
              {categoryCustom && (
                <input
                  autoFocus
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={field}
                  placeholder="Custom category"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Quantity</label>
              <div className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(0, Number(q) - 1))}
                  aria-label="Decrease"
                  className="rounded-l-lg border border-r-0 border-stone-300 px-3 text-xl text-stone-600 active:bg-stone-100"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full border-y border-stone-300 px-2 py-2.5 text-center text-base focus:outline-none"
                  min={0}
                  step="any"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Number(q) + 1)}
                  aria-label="Increase"
                  className="rounded-r-lg border border-l-0 border-stone-300 px-3 text-xl text-stone-600 active:bg-stone-100"
                >
                  +
                </button>
              </div>
            </div>
            <div>
              <label className={label}>Unit</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className={field}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={label}>Location</label>
            <select value={location} onChange={(e) => setLocation(e.target.value)} className={field}>
              {LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Expires</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setExpiration("");
                  setExpirationCustom(false);
                }}
                className={chip(!expirationCustom && expiration === "")}
              >
                None
              </button>
              {EXP_PRESETS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => {
                    setExpiration(addDays(p.days));
                    setExpirationCustom(false);
                  }}
                  className={chip(!expirationCustom && expiration === addDays(p.days))}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setExpirationCustom(true)}
                className={chip(expirationCustom)}
              >
                Custom…
              </button>
            </div>
            {expirationCustom && (
              <input
                type="date"
                value={expiration}
                onChange={(e) => setExpiration(e.target.value)}
                className={`${field} mt-2`}
              />
            )}
            {!expirationCustom && expiration !== "" && (
              <p className="mt-1.5 text-xs text-stone-500">Expires {expiration}</p>
            )}
          </div>

          <div>
            <label className={label}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={field}
              rows={2}
            />
          </div>

          <button
            type="button"
            onClick={() => setNeeded((n) => !n)}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left ${
              needed ? "border-pine-600 bg-pine-50" : "border-stone-300"
            }`}
          >
            <span className="flex items-center gap-2 font-medium text-stone-700">
              🛒 Add to shopping list
              <span className="text-sm font-normal text-stone-500">(need more)</span>
            </span>
            <span
              className={`relative h-6 w-11 rounded-full transition ${
                needed ? "bg-pine-600" : "bg-stone-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  needed ? "left-[1.375rem]" : "left-0.5"
                }`}
              />
            </span>
          </button>

        </form>

        <div className="border-t border-stone-100 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3">
          {error && <p className="mb-2 text-sm text-terracotta-600">{error}</p>}
          <div className="flex gap-3">
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete ${name.trim() || "this item"}?`)) onDelete();
                }}
                className="rounded-lg border border-terracotta-100 px-4 py-3 font-medium text-terracotta-600 active:bg-terracotta-100"
              >
                Delete
              </button>
            )}
            <button
              type="submit"
              form="item-form"
              disabled={busy}
              className="flex-1 rounded-lg bg-pine-600 px-4 py-3 font-semibold text-white active:bg-pine-700 disabled:opacity-50"
            >
              {busy ? "Saving…" : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
