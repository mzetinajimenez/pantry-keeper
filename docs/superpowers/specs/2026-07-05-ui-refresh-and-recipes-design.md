# Pantry Keeper — UI refresh + recipes design

**Date:** 2026-07-05 · **Status:** approved by user

## Goals

Make the app answer three day-to-day questions instantly, especially on a phone,
especially for a first-time user:

1. **Do I have this item, and how much?**
2. **Can I make recipe X, or what am I missing?**
3. **While grocery shopping: how much of this do I already have?**

Plus a visual refresh ("warm kitchen" direction) so the app feels like a kitchen
companion rather than an admin tool.

## Out of scope

Auth/sync, reminders, recipe URL/photo import, density-based conversions
(cups ↔ grams), multi-device anything.

---

## 1. Navigation

Replace the top tab-switcher with a **bottom tab bar**: `Pantry · Recipes · Shopping`,
with **Scan** as an elevated circular center button in the bar
(`Pantry · Recipes · [SCAN] · Shopping`). Everything thumb-reachable; the whole app's
shape is visible at first launch.

- Manual add moves to a `+` icon button in the Pantry tab header.
- Recipes tab header gets `+ New recipe`.
- `InventoryClient.tsx` (~680 lines) splits into `PantryTab`, `RecipesTab`,
  `ShoppingTab`, and a shell component that keeps shared state (items, recipes,
  toasts, scanner, forms) lifted so scanning/adding works from any tab.

## 2. Pantry tab — "do I have X and how much?"

- **Quantity is the loudest element** of each row: large numeral + unit on the right.
- **Out** state (qty ≤ 0): muted row + red-tinted quantity.
- Sort control: `Name / Recent / Expiring` (default Name).
- An **"N expiring soon"** chip (expiry within 7 days, including expired) next to the
  location filters; tapping filters the list to those items.
- Search + location chips stay as they are.

## 3. Recipes tab (new)

### Data model

```ts
type RecipeIngredient = {
  name: string;          // free text, always present
  item_id: number | null; // explicit link to a pantry item when chosen
  quantity: number;
  unit: string;
};

type Recipe = {
  id: number;
  name: string;
  notes: string | null;
  ingredients: RecipeIngredient[];
  created_at: string;
  updated_at: string;
};
```

- Stored in a new `recipes` object store in the same `pantry-keeper` IndexedDB
  (DB version 1 → 2, `autoIncrement` id). All access via `lib/clientStore.ts`
  behind the `lib/api.ts` facade, same as items.

### Matching an ingredient to the pantry

1. If `item_id` is set and that item exists → that item.
2. Else case-insensitive exact name match against item names.
3. Else unmatched.

### Unit conversion (`lib/units.ts`, pure module)

Three families; conversion only **within** a family:

- **Mass** (base g): `g 1 · kg 1000 · oz 28.3495 · lb 453.592`
- **Volume** (base ml): `ml 1 · L 1000 · tsp 4.92892 · tbsp 14.7868 ·
  fl oz 29.5735 · cup 236.588 · pint 473.176 · quart 946.353 · gallon 3785.41`
- **Count** (`each, pack, can, box, bag, bottle, jar`): comparable only to the
  *same* unit.

`UNITS` in `lib/types.ts` gains `tsp, tbsp, cup, fl oz, pint, quart, gallon`
(usable for pantry items too).

### Per-ingredient status

| Status | Condition |
|---|---|
| `enough` | units comparable and available ≥ needed |
| `unverified` | matched item in stock (qty > 0) but units not comparable |
| `missing` | no match, item out of stock, or comparable but available < needed (show "have X, need Y") |

### Recipe status (shown live on each card)

- **✓ Can make** — every ingredient `enough`
- **~ Probably** — no `missing`, some `unverified` (show count)
- **✗ Missing n** — any `missing`

### Actions

- **Add missing to shopping list**: missing ingredients with a matched item get
  `needed = 1`; unmatched ones become new items `{ name, quantity: 0, needed: 1 }`.
- **Cooked it** (behind a confirm): decrement each *comparable* matched ingredient's
  item by the converted amount, clamped at 0. Unverified ingredients are left
  unchanged and the confirm dialog says so.

### Recipe form

Modal sheet like `ItemForm` (uses `useModalA11y`): name, notes, ingredient rows
(name input with pantry-item autocomplete that sets `item_id` when a suggestion is
picked, quantity, unit, remove), and an add-ingredient row. Editing an ingredient
name by hand clears `item_id` (falls back to name matching).

## 4. Shopping tab — "how much do I already have?"

The add-to-list input becomes a **live stock checker**: as you type, matching pantry
items (name/brand) appear with current stock — e.g. "Milk — have 1 L". Each match
has a one-tap "Need it" (sets `needed = 1`); already-listed matches say so.
Submitting free text still creates a new needed item. List behavior ("Got it",
out-of-stock inclusion) is unchanged.

## 5. Visual refresh — "warm kitchen"

- **Palette** (Tailwind v4 `@theme` tokens in `globals.css`): warm cream background
  (≈ `#FAF6EF`), warm-white cards, deep green primary (≈ `#3D6B35`), terracotta
  accent for expiry/warnings (≈ `#C4572E`), warm ink text (≈ `#2B2722`).
- **Type**: friendly display serif (Fraunces via `next/font/google` — built into
  Next, not an npm dependency) for the app title and section headings; system sans
  for body.
- Soft rounded cards, subtle borders/shadows, ≥ 44 px touch targets, existing
  safe-area handling kept.
- **First-run empty state** teaches the app in three lines:
  scan or add → track what you have → build recipes & shop smart.

## 6. Backup format

Export becomes version 2: `{ app, version: 2, exported_at, items, recipes }`.
Import accepts v2 **and** v1/legacy shapes (bare array or `{ items }`); a v1 import
replaces items only and leaves recipes untouched. Restore remains replace-all
behind a confirm.

## Verification

- **vitest** (new dev dependency, approved) with unit tests for `lib/units.ts`
  (conversions, comparability) and the recipe-status calculator.
- `npm run build` type-checks the app.
- Manual phone-size pass: scan flow, all three tabs, recipe create → cook,
  shopping live-stock search, backup export/import (v1 and v2 files).
