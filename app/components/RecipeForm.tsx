"use client";

import { useRef, useState } from "react";
import type { Item, Recipe, RecipeIngredient, RecipeInput } from "@/lib/types";
import { UNITS } from "@/lib/types";
import { useModalA11y } from "@/lib/useModalA11y";

// Quantities stay strings while editing so "0.5" can be typed naturally.
type Row = { name: string; quantity: string; unit: string };

type Props = {
  initial?: Recipe;
  items: Item[];
  title: string;
  submitLabel: string;
  onSubmit: (input: RecipeInput) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
};

export default function RecipeForm({ initial, items, title, submitLabel, onSubmit, onCancel, onDelete }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [rows, setRows] = useState<Row[]>(
    initial?.ingredients.map((ing) => ({ name: ing.name, quantity: String(ing.quantity), unit: ing.unit })) ?? [
      { name: "", quantity: "1", unit: "each" },
    ],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useModalA11y(panelRef, onCancel);

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a recipe name.");
      return;
    }
    // Link each ingredient to a pantry item when the names match exactly;
    // renamed/unmatched ingredients fall back to name matching at read time.
    const ingredients: RecipeIngredient[] = rows
      .filter((r) => r.name.trim())
      .map((r) => {
        const trimmed = r.name.trim();
        const match = items.find((it) => it.name.trim().toLowerCase() === trimmed.toLowerCase());
        return {
          name: trimmed,
          item_id: match?.id ?? null,
          quantity: Number(r.quantity) > 0 ? Number(r.quantity) : 1,
          unit: r.unit,
        };
      });
    if (ingredients.length === 0) {
      setError("Add at least one ingredient.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), notes: notes.trim() || null, ingredients });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const fieldBase =
    "rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-pine-600 focus:outline-none focus:ring-1 focus:ring-pine-600";
  const field = `w-full ${fieldBase}`;
  const label = "mb-1 block text-sm font-medium text-stone-600";

  return (
    <div className="fixed inset-x-0 top-0 z-40 flex h-dvh items-end justify-center bg-black/40 sm:items-center">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-form-title"
        tabIndex={-1}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl"
      >
        <div className="flex items-center justify-between p-5 pb-4">
          <h2 id="recipe-form-title" className="font-display text-lg font-semibold">
            {title}
          </h2>
          <button onClick={onCancel} className="text-sm text-stone-500 active:text-stone-700">
            Close
          </button>
        </div>

        {/* Scrollable body; the submit footer below stays pinned in view. */}
        <form id="recipe-form" onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
          <div>
            <label className={label}>Name *</label>
            <input
              autoFocus={!name}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={field}
              placeholder="e.g. Weeknight Chili"
            />
          </div>

          <div>
            <label className={label}>Ingredients</label>
            <datalist id="pantry-items">
              {items.map((it) => (
                <option key={it.id} value={it.name} />
              ))}
            </datalist>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    list="pantry-items"
                    value={r.name}
                    onChange={(e) => setRow(i, { name: e.target.value })}
                    placeholder="Ingredient"
                    aria-label={`Ingredient ${i + 1} name`}
                    className={`${fieldBase} min-w-0 flex-1`}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={r.quantity}
                    onChange={(e) => setRow(i, { quantity: e.target.value })}
                    aria-label={`Ingredient ${i + 1} quantity`}
                    className={`${fieldBase} w-14 shrink-0 px-1 text-center`}
                  />
                  <select
                    value={r.unit}
                    onChange={(e) => setRow(i, { unit: e.target.value })}
                    aria-label={`Ingredient ${i + 1} unit`}
                    className={`${fieldBase} w-22 shrink-0 px-2`}
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                    aria-label={`Remove ingredient ${i + 1}`}
                    className="h-9 w-9 shrink-0 rounded-full text-lg text-stone-400 active:bg-stone-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setRows((rs) => [...rs, { name: "", quantity: "1", unit: "each" }])}
              className="mt-2 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 active:bg-stone-100"
            >
              + Add ingredient
            </button>
          </div>

          <div>
            <label className={label}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={field} rows={2} />
          </div>

        </form>

        <div className="border-t border-stone-100 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3">
          {error && <p className="mb-2 text-sm text-terracotta-600">{error}</p>}
          <div className="flex gap-3">
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete ${name.trim() || "this recipe"}?`)) onDelete();
                }}
                className="rounded-lg border border-terracotta-100 px-4 py-3 font-medium text-terracotta-600 active:bg-terracotta-100"
              >
                Delete
              </button>
            )}
            <button
              type="submit"
              form="recipe-form"
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
