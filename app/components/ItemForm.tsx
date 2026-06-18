"use client";

import { useState } from "react";
import type { Item, ItemInput } from "@/lib/types";
import { LOCATIONS, UNITS } from "@/lib/types";

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
  const [category, setCategory] = useState(initial.category ?? "");
  const [quantity, setQuantity] = useState(initial.quantity ?? 1);
  const [unit, setUnit] = useState(initial.unit ?? "each");
  const [location, setLocation] = useState(initial.location ?? "Pantry");
  const [expiration, setExpiration] = useState(initial.expiration_date ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [needed, setNeeded] = useState(Boolean(initial.needed));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const field = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";
  const label = "mb-1 block text-sm font-medium text-slate-600";

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onCancel} className="text-sm text-slate-500 active:text-slate-700">
            Close
          </button>
        </div>

        {(initial.image_url || initial.barcode) && (
          <div className="mb-4 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
            {initial.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={initial.image_url} alt="" className="h-14 w-14 rounded object-contain" />
            )}
            {initial.barcode && (
              <span className="font-mono text-sm text-slate-500">{initial.barcode}</span>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <div>
              <label className={label}>Category</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} className={field} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Quantity</label>
              <div className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(0, Number(q) - 1))}
                  className="rounded-l-lg border border-r-0 border-slate-300 px-3 text-xl text-slate-600 active:bg-slate-100"
                >
                  −
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full border-y border-slate-300 px-2 py-2.5 text-center text-base focus:outline-none"
                  min={0}
                  step="any"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Number(q) + 1)}
                  className="rounded-r-lg border border-l-0 border-slate-300 px-3 text-xl text-slate-600 active:bg-slate-100"
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

          <div className="grid grid-cols-2 gap-3">
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
              <input
                type="date"
                value={expiration}
                onChange={(e) => setExpiration(e.target.value)}
                className={field}
              />
            </div>
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
              needed ? "border-green-500 bg-green-50" : "border-slate-300"
            }`}
          >
            <span className="flex items-center gap-2 font-medium text-slate-700">
              🛒 Add to shopping list
              <span className="text-sm font-normal text-slate-500">(need more)</span>
            </span>
            <span
              className={`relative h-6 w-11 rounded-full transition ${
                needed ? "bg-green-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  needed ? "left-[1.375rem]" : "left-0.5"
                }`}
              />
            </span>
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg border border-red-200 px-4 py-3 font-medium text-red-600 active:bg-red-50"
              >
                Delete
              </button>
            )}
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-lg bg-green-600 px-4 py-3 font-semibold text-white active:bg-green-700 disabled:opacity-50"
            >
              {busy ? "Saving…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
