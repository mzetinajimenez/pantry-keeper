# Pantry Keeper UI Refresh + Recipes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Warm-kitchen visual refresh with bottom-tab navigation, a new Recipes tab with unit-aware "can I make it?" matching, and a Shopping tab that doubles as a live stock checker.

**Architecture:** Pure logic (unit conversion, recipe status) lives in `lib/` and is vitest-tested. IndexedDB gains a `recipes` store (DB v2) behind the existing `clientStore.ts`/`api.ts` facade. The 680-line `InventoryClient.tsx` splits into a state-owning shell plus `PantryTab`/`RecipesTab`/`ShoppingTab` presentational components and a `BottomNav`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind v4 (`@theme` tokens), IndexedDB, vitest (new dev dep, user-approved), Fraunces via `next/font/google`.

**Spec:** `docs/superpowers/specs/2026-07-05-ui-refresh-and-recipes-design.md`

## Global Constraints

- Only new dependency allowed: `vitest` (dev). Fonts via `next/font/google` (built-in, not a package).
- Commit straight to `main`; end every commit message with `Co-Authored-By: Claude Opus 4.8`.
- Every task must leave the app working: `npm run build` passes and `npm test` (once it exists) passes.
- Data safety: backup export/import must keep working; import must accept old (v1) backup files.
- Mobile-first; keep `env(safe-area-inset-*)` handling; touch targets ≥ 44px where practical.
- Palette tokens (exact): cream `#faf6ef`, pine-50 `#f3f7f1`, pine-100 `#e2eddc`, pine-600 `#3d6b35`, pine-700 `#345c2d`, pine-800 `#2b4c25`, terracotta-100 `#f8e3d7`, terracotta-600 `#c4572e`, terracotta-700 `#a34524`. Neutrals switch from Tailwind `slate` to `stone` (warm gray).

---

### Task 1: Vitest setup + unit conversion module

**Files:**
- Modify: `package.json` (add vitest, `test` script)
- Create: `vitest.config.ts`
- Create: `lib/units.ts`
- Create: `lib/units.test.ts`
- Modify: `lib/types.ts` (extend `UNITS`)

**Interfaces:**
- Produces: `unitFamily(unit: string): "mass" | "volume" | "count"`, `comparable(a: string, b: string): boolean`, `convert(amount: number, from: string, to: string): number | null` — used by Task 2 and Task 6.
- Produces: `UNITS` now includes `tsp, tbsp, cup, fl oz, pint, quart, gallon`.

- [ ] **Step 1: Install vitest and add config + script**

```bash
npm install -D vitest
```

Add to `package.json` scripts: `"test": "vitest run"`.

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Extend UNITS in `lib/types.ts`**

Replace the existing `UNITS` constant with (grouped by family):

```ts
export const UNITS = [
  "each",
  "pack",
  "can",
  "box",
  "bag",
  "bottle",
  "jar",
  "g",
  "kg",
  "oz",
  "lb",
  "ml",
  "L",
  "tsp",
  "tbsp",
  "fl oz",
  "cup",
  "pint",
  "quart",
  "gallon",
] as const;
```

- [ ] **Step 3: Write the failing tests** — create `lib/units.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { comparable, convert, unitFamily } from "./units";

describe("unitFamily", () => {
  it("classifies mass, volume, and count units", () => {
    expect(unitFamily("kg")).toBe("mass");
    expect(unitFamily("cup")).toBe("volume");
    expect(unitFamily("can")).toBe("count");
    expect(unitFamily("mystery-unit")).toBe("count"); // unknown → count
  });
});

describe("comparable", () => {
  it("treats the same unit as comparable", () => {
    expect(comparable("can", "can")).toBe(true);
  });
  it("treats units within a family as comparable", () => {
    expect(comparable("kg", "oz")).toBe(true);
    expect(comparable("cup", "L")).toBe(true);
  });
  it("rejects cross-family and differing count units", () => {
    expect(comparable("cup", "g")).toBe(false);
    expect(comparable("can", "bag")).toBe(false);
  });
});

describe("convert", () => {
  it("converts identity", () => {
    expect(convert(3, "can", "can")).toBe(3);
  });
  it("converts mass", () => {
    expect(convert(1, "kg", "g")).toBeCloseTo(1000);
    expect(convert(1, "lb", "oz")).toBeCloseTo(16, 1);
  });
  it("converts volume", () => {
    expect(convert(1, "cup", "tbsp")).toBeCloseTo(16, 1);
    expect(convert(2, "L", "cup")).toBeCloseTo(8.45, 1);
    expect(convert(1, "gallon", "quart")).toBeCloseTo(4, 2);
  });
  it("returns null for incomparable units", () => {
    expect(convert(1, "cup", "g")).toBeNull();
    expect(convert(1, "can", "bag")).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./units`.

- [ ] **Step 5: Implement `lib/units.ts`**

```ts
// Pure unit-conversion helpers for comparing recipe amounts to pantry stock.
// Conversions only happen within a family (mass, volume); count-style units
// (each, can, bag…) are only comparable to the exact same unit.

const MASS_G: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

const VOLUME_ML: Record<string, number> = {
  ml: 1,
  L: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  "fl oz": 29.5735,
  cup: 236.588,
  pint: 473.176,
  quart: 946.353,
  gallon: 3785.41,
};

export type UnitFamily = "mass" | "volume" | "count";

export function unitFamily(unit: string): UnitFamily {
  if (unit in MASS_G) return "mass";
  if (unit in VOLUME_ML) return "volume";
  return "count";
}

/** Whether amounts in these two units can be numerically compared. */
export function comparable(a: string, b: string): boolean {
  if (a === b) return true;
  const fa = unitFamily(a);
  return fa !== "count" && fa === unitFamily(b);
}

/**
 * Convert an amount between comparable units; null when they aren't
 * comparable (different families, or two different count units).
 */
export function convert(amount: number, from: string, to: string): number | null {
  if (from === to) return amount;
  if (!comparable(from, to)) return null;
  const table = unitFamily(from) === "mass" ? MASS_G : VOLUME_ML;
  return (amount * table[from]) / table[to];
}
```

- [ ] **Step 6: Run tests, verify they pass**

Run: `npm test` → all pass. Run: `npm run build` → passes.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/units.ts lib/units.test.ts lib/types.ts
git commit -m "Add vitest + unit conversion module; extend UNITS with cooking volumes"
```

---

### Task 2: Recipe types + status calculator

**Files:**
- Modify: `lib/types.ts` (add Recipe types)
- Create: `lib/recipeStatus.ts`
- Create: `lib/recipeStatus.test.ts`

**Interfaces:**
- Consumes: `comparable`/`convert` from `lib/units.ts`.
- Produces (used by Tasks 3, 6):

```ts
// lib/types.ts
export type RecipeIngredient = {
  name: string;           // free text, always present
  item_id: number | null; // link to a pantry item when known
  quantity: number;
  unit: string;
};
export type Recipe = {
  id: number;
  name: string;
  notes: string | null;
  ingredients: RecipeIngredient[];
  created_at: string;
  updated_at: string;
};
export type RecipeInput = {
  name: string;
  notes?: string | null;
  ingredients: RecipeIngredient[];
};

// lib/recipeStatus.ts
export type IngredientStatus = {
  ingredient: RecipeIngredient;
  item: Item | null;
  status: "enough" | "unverified" | "missing";
  available: number | null; // stock in the ingredient's unit, when comparable
};
export type RecipeStatus = {
  status: "can-make" | "probably" | "missing";
  missing: IngredientStatus[];
  unverified: IngredientStatus[];
  ingredients: IngredientStatus[];
};
export function matchItem(ingredient: RecipeIngredient, items: Item[]): Item | null;
export function ingredientStatus(ingredient: RecipeIngredient, items: Item[]): IngredientStatus;
export function recipeStatus(recipe: Recipe, items: Item[]): RecipeStatus;
```

- [ ] **Step 1: Add the three Recipe types above to `lib/types.ts`** (verbatim, below `ItemInput`).

- [ ] **Step 2: Write the failing tests** — create `lib/recipeStatus.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Item, Recipe, RecipeIngredient } from "./types";
import { ingredientStatus, matchItem, recipeStatus } from "./recipeStatus";

function item(partial: Partial<Item> & { id: number; name: string }): Item {
  return {
    barcode: null, brand: null, category: null, quantity: 1, unit: "each",
    location: null, expiration_date: null, image_url: null, notes: null,
    needed: 0, created_at: "", updated_at: "", ...partial,
  };
}

function ing(partial: Partial<RecipeIngredient> & { name: string }): RecipeIngredient {
  return { item_id: null, quantity: 1, unit: "each", ...partial };
}

function recipe(ingredients: RecipeIngredient[]): Recipe {
  return { id: 1, name: "Test", notes: null, ingredients, created_at: "", updated_at: "" };
}

describe("matchItem", () => {
  it("prefers the linked item over a name match", () => {
    const items = [item({ id: 1, name: "Flour" }), item({ id: 2, name: "Bread Flour" })];
    expect(matchItem(ing({ name: "Flour", item_id: 2 }), items)?.id).toBe(2);
  });
  it("falls back to case-insensitive name match", () => {
    const items = [item({ id: 1, name: "Black Beans" })];
    expect(matchItem(ing({ name: "black beans" }), items)?.id).toBe(1);
    expect(matchItem(ing({ name: "black beans", item_id: 99 }), items)?.id).toBe(1);
  });
  it("returns null when nothing matches", () => {
    expect(matchItem(ing({ name: "Saffron" }), [])).toBeNull();
  });
});

describe("ingredientStatus", () => {
  const flourKg = item({ id: 1, name: "Flour", quantity: 2, unit: "kg" });

  it("is enough when converted stock covers the need", () => {
    const s = ingredientStatus(ing({ name: "Flour", quantity: 500, unit: "g" }), [flourKg]);
    expect(s.status).toBe("enough");
    expect(s.available).toBeCloseTo(2000);
  });
  it("is missing when comparable but insufficient", () => {
    const s = ingredientStatus(ing({ name: "Flour", quantity: 3, unit: "kg" }), [flourKg]);
    expect(s.status).toBe("missing");
    expect(s.available).toBeCloseTo(2);
  });
  it("is missing when the item is out of stock", () => {
    const out = item({ id: 1, name: "Flour", quantity: 0, unit: "kg" });
    expect(ingredientStatus(ing({ name: "Flour", quantity: 1, unit: "kg" }), [out]).status).toBe("missing");
  });
  it("is missing when there is no matching item", () => {
    expect(ingredientStatus(ing({ name: "Saffron" }), [flourKg]).status).toBe("missing");
  });
  it("is unverified when in stock but units are incomparable", () => {
    const bag = item({ id: 1, name: "Flour", quantity: 1, unit: "bag" });
    const s = ingredientStatus(ing({ name: "Flour", quantity: 2, unit: "cup" }), [bag]);
    expect(s.status).toBe("unverified");
    expect(s.available).toBeNull();
  });
});

describe("recipeStatus", () => {
  const items = [
    item({ id: 1, name: "Flour", quantity: 2, unit: "kg" }),
    item({ id: 2, name: "Sugar", quantity: 1, unit: "bag" }),
  ];

  it("can-make when every ingredient is enough", () => {
    const r = recipe([ing({ name: "Flour", quantity: 500, unit: "g" })]);
    expect(recipeStatus(r, items).status).toBe("can-make");
  });
  it("probably when some are unverified but none missing", () => {
    const r = recipe([
      ing({ name: "Flour", quantity: 500, unit: "g" }),
      ing({ name: "Sugar", quantity: 1, unit: "cup" }),
    ]);
    const s = recipeStatus(r, items);
    expect(s.status).toBe("probably");
    expect(s.unverified).toHaveLength(1);
  });
  it("missing when any ingredient is missing", () => {
    const r = recipe([
      ing({ name: "Flour", quantity: 500, unit: "g" }),
      ing({ name: "Saffron", quantity: 1, unit: "g" }),
    ]);
    const s = recipeStatus(r, items);
    expect(s.status).toBe("missing");
    expect(s.missing).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run tests, verify they fail** — `npm test` → cannot resolve `./recipeStatus`.

- [ ] **Step 4: Implement `lib/recipeStatus.ts`**

```ts
// Pure "can I make it?" calculator: match recipe ingredients to pantry items
// and compare amounts via unit conversion. UI-independent and unit-tested.

import type { Item, Recipe, RecipeIngredient } from "./types";
import { convert } from "./units";

export type IngredientStatus = {
  ingredient: RecipeIngredient;
  item: Item | null;
  status: "enough" | "unverified" | "missing";
  /** Stock expressed in the ingredient's unit, when units are comparable. */
  available: number | null;
};

export type RecipeStatus = {
  status: "can-make" | "probably" | "missing";
  missing: IngredientStatus[];
  unverified: IngredientStatus[];
  ingredients: IngredientStatus[];
};

export function matchItem(ingredient: RecipeIngredient, items: Item[]): Item | null {
  if (ingredient.item_id !== null) {
    const linked = items.find((it) => it.id === ingredient.item_id);
    if (linked) return linked;
  }
  const name = ingredient.name.trim().toLowerCase();
  return items.find((it) => it.name.trim().toLowerCase() === name) ?? null;
}

export function ingredientStatus(ingredient: RecipeIngredient, items: Item[]): IngredientStatus {
  const item = matchItem(ingredient, items);
  if (!item || item.quantity <= 0) {
    return { ingredient, item, status: "missing", available: null };
  }
  const available = convert(item.quantity, item.unit, ingredient.unit);
  if (available === null) {
    return { ingredient, item, status: "unverified", available: null };
  }
  return {
    ingredient,
    item,
    status: available >= ingredient.quantity ? "enough" : "missing",
    available,
  };
}

export function recipeStatus(recipe: Recipe, items: Item[]): RecipeStatus {
  const ingredients = recipe.ingredients.map((i) => ingredientStatus(i, items));
  const missing = ingredients.filter((s) => s.status === "missing");
  const unverified = ingredients.filter((s) => s.status === "unverified");
  const status = missing.length > 0 ? "missing" : unverified.length > 0 ? "probably" : "can-make";
  return { status, missing, unverified, ingredients };
}
```

- [ ] **Step 5: Run tests, verify they pass** — `npm test`; then `npm run build`.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/recipeStatus.ts lib/recipeStatus.test.ts
git commit -m "Add recipe types + unit-aware recipe status calculator"
```

---

### Task 3: Storage v2 — recipes store + backup v2

**Files:**
- Modify: `lib/clientStore.ts` (DB v2, recipes CRUD, export/replace)
- Modify: `lib/api.ts` (recipe facade, reshape export/import)
- Modify: `app/components/InventoryClient.tsx` (only `handleExport`/`handleImportFile` — full rewrite comes in Task 5)

**Interfaces:**
- Consumes: `Recipe`, `RecipeInput` from `lib/types.ts`.
- Produces (`lib/api.ts`, used by Tasks 5–6):
  - `fetchRecipes(): Promise<Recipe[]>` (sorted by name)
  - `createRecipe(input: RecipeInput): Promise<Recipe>` (throws on empty name)
  - `updateRecipe(id: number, input: RecipeInput): Promise<Recipe>` (throws "Not found")
  - `deleteRecipe(id: number): Promise<void>`
  - `exportData(): Promise<{ items: Item[]; recipes: Recipe[] }>` **(signature change)**
  - `importData(data: { items: Item[]; recipes?: Recipe[] }): Promise<{ items: number; recipes: number }>` **(signature change)** — `recipes` undefined (v1 backup) leaves the recipes store untouched.

- [ ] **Step 1: Upgrade `lib/clientStore.ts`**

Change the constants/openDb/tx at the top:

```ts
const DB_NAME = "pantry-keeper";
const DB_VERSION = 2;
const STORE = "items";
const RECIPES = "recipes";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (event.oldVersion < 1) {
        const store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("barcode", "barcode");
        store.createIndex("location", "location");
      }
      if (event.oldVersion < 2) {
        db.createObjectStore(RECIPES, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode, store: string = STORE) {
  return db.transaction(store, mode).objectStore(store);
}
```

Update the import line to `import type { Item, ItemInput, Recipe, RecipeInput } from "./types";` and append at the end of the file:

```ts
// ---- Recipes (DB v2) ----

export async function listRecipes(): Promise<Recipe[]> {
  const db = await openDb();
  const recipes = await await_(tx(db, "readonly", RECIPES).getAll() as IDBRequest<Recipe[]>);
  return recipes.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export async function createRecipe(input: RecipeInput): Promise<Recipe> {
  const db = await openDb();
  const now = new Date().toISOString();
  const record: Omit<Recipe, "id"> = {
    name: input.name,
    notes: input.notes ?? null,
    ingredients: input.ingredients,
    created_at: now,
    updated_at: now,
  };
  const id = await await_(tx(db, "readwrite", RECIPES).add(record) as IDBRequest<number>);
  return { ...record, id };
}

export async function updateRecipe(id: number, input: RecipeInput): Promise<Recipe | undefined> {
  const db = await openDb();
  const store = tx(db, "readwrite", RECIPES);
  const existing = await await_(store.get(id) as IDBRequest<Recipe | undefined>);
  if (!existing) return undefined;
  const updated: Recipe = {
    ...existing,
    name: input.name,
    notes: input.notes ?? null,
    ingredients: input.ingredients,
    updated_at: new Date().toISOString(),
  };
  await await_(store.put(updated) as IDBRequest<number>);
  return updated;
}

export async function deleteRecipe(id: number): Promise<boolean> {
  const db = await openDb();
  const store = tx(db, "readwrite", RECIPES);
  const existing = await await_(store.get(id) as IDBRequest<Recipe | undefined>);
  if (!existing) return false;
  await await_(store.delete(id) as IDBRequest<undefined>);
  return true;
}

/** Every recipe, for a JSON backup export. */
export function exportRecipes(): Promise<Recipe[]> {
  return openDb().then((db) => await_(tx(db, "readonly", RECIPES).getAll() as IDBRequest<Recipe[]>));
}

/** Wipe the recipes store and bulk-load from a backup. Returns the count written. */
export async function replaceAllRecipes(recipes: Recipe[]): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RECIPES, "readwrite");
    const store = transaction.objectStore(RECIPES);
    store.clear();
    for (const r of recipes) store.put(r);
    transaction.oncomplete = () => resolve(recipes.length);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
```

- [ ] **Step 2: Extend `lib/api.ts`**

Update the type import to include `Recipe, RecipeInput`. Replace `exportData`/`importData` and append recipe functions:

```ts
export async function exportData(): Promise<{ items: Item[]; recipes: Recipe[] }> {
  const [items, recipes] = await Promise.all([store.exportItems(), store.exportRecipes()]);
  return { items, recipes };
}

// Restore = replace-all. A v1 backup has no recipes; leave that store untouched.
export async function importData(data: {
  items: Item[];
  recipes?: Recipe[];
}): Promise<{ items: number; recipes: number }> {
  const items = await store.replaceAll(data.items);
  const recipes = data.recipes ? await store.replaceAllRecipes(data.recipes) : 0;
  return { items, recipes };
}

export async function fetchRecipes(): Promise<Recipe[]> {
  return store.listRecipes();
}

export async function createRecipe(input: RecipeInput): Promise<Recipe> {
  if (!input.name.trim()) throw new Error("Name is required");
  return store.createRecipe({ ...input, name: input.name.trim() });
}

export async function updateRecipe(id: number, input: RecipeInput): Promise<Recipe> {
  if (!input.name.trim()) throw new Error("Name cannot be empty");
  const recipe = await store.updateRecipe(id, { ...input, name: input.name.trim() });
  if (!recipe) throw new Error("Not found");
  return recipe;
}

export async function deleteRecipe(id: number): Promise<void> {
  const ok = await store.deleteRecipe(id);
  if (!ok) throw new Error("Not found");
}
```

- [ ] **Step 3: Update backup handlers in `app/components/InventoryClient.tsx`**

Add `Recipe` to the type import, then replace both functions with (Task 5's shell rewrite carries these forward verbatim):

```tsx
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
        })? This can't be undone.`,
      )
    ) {
      return;
    }
    const n = await api.importData({ items: restoredItems, recipes: restoredRecipes });
    await load();
    toast(
      `Restored ${n.items} item${n.items === 1 ? "" : "s"}${
        restoredRecipes ? ` + ${n.recipes} recipe${n.recipes === 1 ? "" : "s"}` : ""
      }`,
    );
  } catch (e) {
    toast(`Import failed: ${(e as Error).message}`);
  }
}
```

- [ ] **Step 4: Verify** — `npm test` and `npm run build` pass. Manual: `npm run dev`, export a backup, confirm the file has `"version": 2` and a `recipes: []` array; re-import it; also import a pre-existing v1 backup file if one exists.

- [ ] **Step 5: Commit**

```bash
git add lib/clientStore.ts lib/api.ts app/components/InventoryClient.tsx
git commit -m "Add recipes IndexedDB store (DB v2) + v2 backup format with v1 import compat"
```

---

### Task 4: Warm-kitchen theme foundation

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `public/manifest.webmanifest` (theme/background colors — check actual keys in the file)

**Interfaces:**
- Produces Tailwind utilities used by all later tasks: `bg-cream`, `bg-pine-50/100/600/700`, `text-pine-700/800`, `bg-terracotta-100/600`, `text-terracotta-600/700`, `font-display`.

- [ ] **Step 1: Rewrite `app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --color-cream: #faf6ef;
  --color-pine-50: #f3f7f1;
  --color-pine-100: #e2eddc;
  --color-pine-600: #3d6b35;
  --color-pine-700: #345c2d;
  --color-pine-800: #2b4c25;
  --color-terracotta-100: #f8e3d7;
  --color-terracotta-600: #c4572e;
  --color-terracotta-700: #a34524;
  --font-display: var(--font-fraunces), ui-serif, Georgia, serif;
}

:root {
  color-scheme: light;
}

html,
body {
  height: 100%;
}

body {
  /* Respect iOS safe areas so the bottom nav clears the home indicator. */
  padding-bottom: env(safe-area-inset-bottom);
  -webkit-tap-highlight-color: transparent;
  background-color: #faf6ef;
}

/* Hide number input spinners for the quantity stepper. */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}

:focus-visible {
  outline: 2px solid #3d6b35;
  outline-offset: 2px;
}
```

- [ ] **Step 2: Add Fraunces + warm body colors in `app/layout.tsx`**

```tsx
import { Fraunces } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});
```

Change `viewport.themeColor` to `"#faf6ef"`, and the markup to:

```tsx
<html lang="en" className={fraunces.variable}>
  <body className="min-h-full text-stone-900 antialiased">{children}</body>
</html>
```

- [ ] **Step 3: Update `public/manifest.webmanifest`** — set `"theme_color": "#faf6ef"` and `"background_color": "#faf6ef"` (keep everything else).

- [ ] **Step 4: Verify** — `npm run build` passes; `npm run dev` shows cream background (existing green components still render — full restyle lands with Tasks 5–7).

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/layout.tsx public/manifest.webmanifest
git commit -m "Warm-kitchen theme foundation: palette tokens, Fraunces display font, cream chrome"
```

---

### Task 5: Component split — shell, BottomNav, Pantry + Shopping tabs

**Files:**
- Create: `app/components/ui.tsx`
- Create: `app/components/BackupMenu.tsx`
- Create: `app/components/BottomNav.tsx`
- Create: `app/components/PantryTab.tsx`
- Create: `app/components/ShoppingTab.tsx`
- Modify: `app/components/InventoryClient.tsx` (full rewrite as shell)

**Interfaces:**
- Consumes: `api.fetchRecipes` (Task 3), theme utilities (Task 4).
- Produces (used by Task 6): `HeaderShell`, `Chip`, `EmptyState`, `ExpiryBadge`, `daysUntil`, icons from `./ui`; `Tab` type + `BottomNav` props `{ tab, onTab, onScan, shoppingCount }`; shell owns `items`, `recipes`, `toast`, `load`, and all item handlers.
- Recipes tab renders an inline "coming right up" EmptyState placeholder until Task 6.

- [ ] **Step 1: Create `app/components/ui.tsx`**

```tsx
"use client";

// Shared presentational bits for the tab components.

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function ExpiryBadge({ date }: { date: string | null }) {
  const d = daysUntil(date);
  if (d === null) return null;
  let cls = "bg-stone-100 text-stone-600";
  let text = `exp ${date}`;
  if (d < 0) {
    cls = "bg-terracotta-100 text-terracotta-700";
    text = "⚠ expired";
  } else if (d === 0) {
    cls = "bg-terracotta-100 text-terracotta-700";
    text = "⚠ today";
  } else if (d <= 7) {
    cls = "bg-amber-100 text-amber-800";
    text = `${d}d left`;
  }
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {text}
    </span>
  );
}

export function Chip({
  active,
  onClick,
  tone = "default",
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone?: "default" | "warn";
  children: React.ReactNode;
}) {
  const activeCls = tone === "warn" ? "bg-terracotta-600 text-white" : "bg-pine-600 text-white";
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
        active ? activeCls : "border border-stone-300 bg-white text-stone-600"
      }`}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  emoji,
  title,
  hint,
  children,
}: {
  emoji: string;
  title: string;
  hint: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-16 text-center text-stone-500">
      <p className="text-4xl">{emoji}</p>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm">{hint}</p>
      {children}
    </div>
  );
}

/** Sticky app header: title row (name + per-tab subtitle + actions) with
 *  optional per-tab controls below. */
export function HeaderShell({
  subtitle,
  actions,
  children,
}: {
  subtitle: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-cream/95 backdrop-blur">
      <div className="px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-xl font-bold tracking-tight text-pine-800">🥫 Pantry Keeper</h1>
          <div className="flex items-center gap-1">
            <span className="text-sm text-stone-500">{subtitle}</span>
            {actions}
          </div>
        </div>
        {children}
      </div>
    </header>
  );
}

export function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

export function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export function CartIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function BasketIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 11 4-7" />
      <path d="m19 11-4-7" />
      <path d="M2 11h20" />
      <path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.6-7.4" />
    </svg>
  );
}

export function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
```

- [ ] **Step 2: Create `app/components/BackupMenu.tsx`** — move the existing `BackupMenu` component out of `InventoryClient.tsx` verbatim, with: `import { useEffect, useRef, useState } from "react";`, `import { DotsIcon } from "./ui";`, `export default function BackupMenu`, and `slate` → `stone` in its classes.

- [ ] **Step 3: Create `app/components/BottomNav.tsx`**

```tsx
"use client";

import { BasketIcon, BookIcon, CameraIcon, CartIcon } from "./ui";

export type Tab = "pantry" | "recipes" | "shopping";

type Props = {
  tab: Tab;
  onTab: (tab: Tab) => void;
  onScan: () => void;
  shoppingCount: number;
};

export default function BottomNav({ tab, onTab, onScan, shoppingCount }: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200/70 bg-cream/95 backdrop-blur">
      <div className="mx-auto grid max-w-2xl grid-cols-4 items-center px-2 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1.5">
        <NavButton active={tab === "pantry"} onClick={() => onTab("pantry")} label="Pantry">
          <BasketIcon />
        </NavButton>
        <NavButton active={tab === "recipes"} onClick={() => onTab("recipes")} label="Recipes">
          <BookIcon />
        </NavButton>
        <div className="flex flex-col items-center">
          <button
            onClick={onScan}
            aria-label="Scan a barcode"
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-pine-600 text-white shadow-lg active:bg-pine-700"
          >
            <CameraIcon />
          </button>
          <span className="mt-0.5 text-[11px] font-medium text-pine-700">Scan</span>
        </div>
        <NavButton active={tab === "shopping"} onClick={() => onTab("shopping")} label="Shopping" badge={shoppingCount}>
          <CartIcon size={20} />
        </NavButton>
      </div>
    </nav>
  );
}

function NavButton({
  active,
  onClick,
  label,
  badge,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`relative flex flex-col items-center gap-0.5 rounded-lg py-1.5 ${
        active ? "text-pine-700" : "text-stone-400"
      }`}
    >
      {children}
      <span className="text-[11px] font-medium">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute right-1/2 top-0 translate-x-4 rounded-full bg-terracotta-600 px-1.5 text-[10px] font-bold leading-4 text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Create `app/components/PantryTab.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import type { Item } from "@/lib/types";
import { CartIcon, Chip, EmptyState, ExpiryBadge, HeaderShell, daysUntil } from "./ui";

type SortKey = "name" | "recent" | "expiring";

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

  const isExpiring = (it: Item) => {
    const d = daysUntil(it.expiration_date);
    return d !== null && d <= 7;
  };
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

  const totalQty = useMemo(() => visible.reduce((sum, it) => sum + it.quantity, 0), [visible]);

  return (
    <>
      <HeaderShell
        subtitle={`${visible.length} item${visible.length === 1 ? "" : "s"} · ${+totalQty.toFixed(2)} total`}
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
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
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
          className="h-10 w-10 rounded-full border border-stone-300 text-xl text-stone-600 active:bg-stone-100"
        >
          −
        </button>
        <span className="w-12 text-center tabular-nums">
          <span className={`text-xl font-bold ${out ? "text-terracotta-600" : "text-stone-900"}`}>
            {+item.quantity.toFixed(2)}
          </span>
          <span className="block text-[11px] leading-none text-stone-400">{item.unit}</span>
        </span>
        <button
          onClick={() => onAdjustQty(item, 1)}
          aria-label="Increase"
          className="h-10 w-10 rounded-full border border-stone-300 text-xl text-stone-600 active:bg-stone-100"
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
```

- [ ] **Step 5: Create `app/components/ShoppingTab.tsx`** (live stock checker built in)

```tsx
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
```

- [ ] **Step 6: Rewrite `app/components/InventoryClient.tsx` as the shell**

Keep: `toast`, `load` (now also fetching recipes), `patchLocal`, `adjustQty`, `toggleNeeded`, `gotIt`, `handleDetected`, `handleCreate`, `handleUpdate`, `handleDelete`, and the Task 3 versions of `handleExport`/`handleImportFile` — all verbatim from the current file except where shown. Delete: `ExpiryBadge`, `daysUntil`, `TabButton`, `Chip`, `EmptyState`, `BackupMenu`, all icons (now in `ui.tsx`/`BackupMenu.tsx`), `addToList`, `listInput`, `search`, `locationFilter`, and all JSX below the state declarations. New shape:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Item, ItemInput, Recipe } from "@/lib/types";
import * as api from "@/lib/api";
import Scanner from "./Scanner";
import ItemForm from "./ItemForm";
import PantryTab from "./PantryTab";
import ShoppingTab from "./ShoppingTab";
import BottomNav, { type Tab } from "./BottomNav";
import BackupMenu from "./BackupMenu";
import { EmptyState, HeaderShell } from "./ui";

type Toast = { id: number; text: string };

export default function InventoryClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pantry");
  const [scanning, setScanning] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [adding, setAdding] = useState<Partial<Item> | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  // …toast unchanged…

  const load = useCallback(async () => {
    try {
      const [loadedItems, loadedRecipes] = await Promise.all([api.fetchItems(), api.fetchRecipes()]);
      setItems(loadedItems);
      setRecipes(loadedRecipes);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // …useEffect, patchLocal, adjustQty, toggleNeeded, gotIt unchanged…

  function needIt(item: Item) {
    patchLocal(item.id, { needed: 1 }, { needed: 1 });
    toast(`Added ${item.name} to shopping list`);
  }

  async function createNeeded(name: string) {
    try {
      await api.createItem({ name, quantity: 0, needed: true });
      await load();
      toast(`Added ${name} to shopping list`);
    } catch (err) {
      toast((err as Error).message);
    }
  }

  // …handleDetected, handleCreate, handleUpdate, handleDelete,
  //  handleExport (v2), handleImportFile (v2) unchanged…

  const menu = <BackupMenu onExport={handleExport} onImport={handleImportFile} />;
  const shoppingCount = items.filter((it) => it.needed === 1 || it.quantity <= 0).length;

  return (
    <div className="mx-auto min-h-full max-w-2xl">
      {loading ? (
        <p className="py-24 text-center text-stone-400">Loading…</p>
      ) : tab === "pantry" ? (
        <PantryTab
          items={items}
          menu={menu}
          onEdit={setEditing}
          onAdjustQty={adjustQty}
          onToggleNeeded={toggleNeeded}
          onAddManual={() => setAdding({ quantity: 1 })}
          onScan={() => setScanning(true)}
        />
      ) : tab === "recipes" ? (
        <>
          <HeaderShell subtitle={`${recipes.length} recipe${recipes.length === 1 ? "" : "s"}`} actions={menu} />
          <main className="px-4 pb-32 pt-3">
            <EmptyState emoji="🍳" title="Recipes are coming right up" hint="This tab fills in with the next update." />
          </main>
        </>
      ) : (
        <ShoppingTab
          items={items}
          menu={menu}
          onGotIt={gotIt}
          onEdit={setEditing}
          onNeedIt={needIt}
          onCreateNeeded={createNeeded}
        />
      )}

      <BottomNav tab={tab} onTab={setTab} onScan={() => setScanning(true)} shoppingCount={shoppingCount} />

      {/* Toasts */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto max-w-sm rounded-full bg-stone-900 px-4 py-2 text-sm text-white shadow-lg">
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
```

- [ ] **Step 7: Verify** — `npm test` + `npm run build` pass. Run `npm run dev` (background), then visualize with the Playwright MCP: resize browser to 390×844, navigate to `http://localhost:3000`, screenshot all three tabs, the first-run empty state, and the shopping stock-checker with a query typed. Check: bottom nav thumb-reachable, quantity prominent, no layout overflow.

- [ ] **Step 8: Commit**

```bash
git add app/components/
git commit -m "Split UI into tab components with bottom nav; pantry sort/expiring filter; shopping stock checker"
```

---

### Task 6: Recipes tab + recipe form + cook/add-missing wiring

**Files:**
- Create: `app/components/RecipeForm.tsx`
- Create: `app/components/RecipesTab.tsx`
- Modify: `app/components/InventoryClient.tsx` (recipe state/handlers, replace placeholder)

**Interfaces:**
- Consumes: `recipeStatus`/`RecipeStatus`/`IngredientStatus` (Task 2), `comparable`/`convert` (Task 1), `api.createRecipe/updateRecipe/deleteRecipe` (Task 3), `HeaderShell`/`EmptyState` (Task 5).
- Produces: `RecipeForm` props `{ initial?, items, title, submitLabel, onSubmit(RecipeInput), onCancel, onDelete? }`; `RecipesTab` props `{ recipes, items, menu, onAdd, onEdit, onCook(recipe, status), onAddMissing(recipe, status) }`.

- [ ] **Step 1: Create `app/components/RecipeForm.tsx`**

```tsx
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

  const field =
    "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-pine-600 focus:outline-none focus:ring-1 focus:ring-pine-600";
  const label = "mb-1 block text-sm font-medium text-stone-600";

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-form-title"
        tabIndex={-1}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="recipe-form-title" className="font-display text-lg font-semibold">
            {title}
          </h2>
          <button onClick={onCancel} className="text-sm text-stone-500 active:text-stone-700">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                    className={`${field} min-w-0 flex-1`}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={r.quantity}
                    onChange={(e) => setRow(i, { quantity: e.target.value })}
                    aria-label={`Ingredient ${i + 1} quantity`}
                    className={`${field} w-16 px-2 text-center`}
                  />
                  <select
                    value={r.unit}
                    onChange={(e) => setRow(i, { unit: e.target.value })}
                    aria-label={`Ingredient ${i + 1} unit`}
                    className={`${field} w-24 px-2`}
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

          {error && <p className="text-sm text-terracotta-600">{error}</p>}

          <div className="flex gap-3 pt-1">
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
              disabled={busy}
              className="flex-1 rounded-lg bg-pine-600 px-4 py-3 font-semibold text-white active:bg-pine-700 disabled:opacity-50"
            >
              {busy ? "Saving…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/components/RecipesTab.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import type { Item, Recipe } from "@/lib/types";
import { recipeStatus, type IngredientStatus, type RecipeStatus } from "@/lib/recipeStatus";
import { EmptyState, HeaderShell } from "./ui";

type Props = {
  recipes: Recipe[];
  items: Item[];
  menu: React.ReactNode;
  onAdd: () => void;
  onEdit: (recipe: Recipe) => void;
  onCook: (recipe: Recipe, status: RecipeStatus) => void;
  onAddMissing: (recipe: Recipe, status: RecipeStatus) => void;
};

export default function RecipesTab({ recipes, items, menu, onAdd, onEdit, onCook, onAddMissing }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const statuses = useMemo(
    () => new Map(recipes.map((r) => [r.id, recipeStatus(r, items)])),
    [recipes, items],
  );
  const readyCount = [...statuses.values()].filter((s) => s.status === "can-make").length;

  return (
    <>
      <HeaderShell
        subtitle={recipes.length === 0 ? "0 recipes" : `${readyCount} of ${recipes.length} ready to cook`}
        actions={
          <>
            <button
              onClick={onAdd}
              aria-label="New recipe"
              className="flex h-8 w-8 items-center justify-center rounded-full text-2xl leading-none text-pine-700 active:bg-pine-50"
            >
              ＋
            </button>
            {menu}
          </>
        }
      />

      <main className="px-4 pb-32 pt-3">
        {recipes.length === 0 ? (
          <EmptyState
            emoji="🍳"
            title="No recipes yet"
            hint="Add one and see instantly whether your pantry can make it."
          >
            <button
              onClick={onAdd}
              className="mt-5 rounded-xl bg-pine-600 px-6 py-3 font-semibold text-white active:bg-pine-700"
            >
              + New recipe
            </button>
          </EmptyState>
        ) : (
          <ul aria-label="Recipes" className="space-y-2">
            {recipes.map((r) => {
              const s = statuses.get(r.id)!;
              const open = expandedId === r.id;
              return (
                <li key={r.id} className="rounded-2xl border border-stone-200 bg-white shadow-sm">
                  <button
                    onClick={() => setExpandedId(open ? null : r.id)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-display truncate text-base font-semibold text-stone-800">{r.name}</p>
                      <p className="text-sm text-stone-500">
                        {r.ingredients.length} ingredient{r.ingredients.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <StatusBadge status={s} />
                  </button>

                  {open && (
                    <div className="border-t border-stone-100 p-3">
                      <ul className="space-y-1.5">
                        {s.ingredients.map((ing, i) => (
                          <IngredientLine key={i} s={ing} />
                        ))}
                      </ul>
                      {r.notes && <p className="mt-3 text-sm text-stone-500">{r.notes}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {s.missing.length > 0 && (
                          <button
                            onClick={() => onAddMissing(r, s)}
                            className="rounded-lg bg-pine-600 px-3.5 py-2 text-sm font-semibold text-white active:bg-pine-700"
                          >
                            🛒 Add {s.missing.length} missing to list
                          </button>
                        )}
                        {s.status !== "missing" && (
                          <button
                            onClick={() => onCook(r, s)}
                            className="rounded-lg bg-pine-600 px-3.5 py-2 text-sm font-semibold text-white active:bg-pine-700"
                          >
                            🍳 Cooked it
                          </button>
                        )}
                        <button
                          onClick={() => onEdit(r)}
                          className="rounded-lg border border-stone-300 px-3.5 py-2 text-sm font-medium text-stone-600 active:bg-stone-100"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}

function StatusBadge({ status }: { status: RecipeStatus }) {
  if (status.status === "can-make") {
    return (
      <span className="shrink-0 rounded-full bg-pine-100 px-2.5 py-1 text-xs font-semibold text-pine-800">
        ✓ Can make
      </span>
    );
  }
  if (status.status === "probably") {
    return (
      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
        ~ Probably
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-terracotta-100 px-2.5 py-1 text-xs font-semibold text-terracotta-700">
      Missing {status.missing.length}
    </span>
  );
}

function IngredientLine({ s }: { s: IngredientStatus }) {
  const { ingredient: ing, item, status, available } = s;
  const round = (n: number) => +n.toFixed(2);
  const icon = status === "enough" ? "✓" : status === "unverified" ? "~" : "✗";
  const iconCls =
    status === "enough" ? "text-pine-700" : status === "unverified" ? "text-amber-600" : "text-terracotta-600";
  let detail: string;
  if (status === "enough") detail = `have ≈${round(available!)} ${ing.unit}`;
  else if (status === "unverified") detail = `have ${round(item!.quantity)} ${item!.unit} — can't compare`;
  else if (item && available !== null) detail = `have ${round(available)}, need ${ing.quantity}`;
  else if (item) detail = "out of stock";
  else detail = "not in pantry";
  return (
    <li className="flex items-start gap-2 text-sm">
      <span className={`mt-0.5 w-4 shrink-0 text-center font-bold ${iconCls}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium text-stone-800">{ing.name}</span>
          <span className="shrink-0 text-stone-500">
            {ing.quantity} {ing.unit}
          </span>
        </div>
        <p className="text-xs text-stone-400">{detail}</p>
      </div>
    </li>
  );
}
```

- [ ] **Step 3: Wire recipes into the shell (`InventoryClient.tsx`)**

Add imports:

```tsx
import type { Item, ItemInput, Recipe, RecipeInput } from "@/lib/types";
import type { RecipeStatus } from "@/lib/recipeStatus";
import { comparable, convert } from "@/lib/units";
import RecipeForm from "./RecipeForm";
import RecipesTab from "./RecipesTab";
```

(`EmptyState`/`HeaderShell` imports from `./ui` can go if now unused.) Add state:

```tsx
const [addingRecipe, setAddingRecipe] = useState(false);
const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
```

Add handlers (below `handleDelete`):

```tsx
async function handleCreateRecipe(input: RecipeInput) {
  await api.createRecipe(input);
  setAddingRecipe(false);
  await load();
  toast(`Added ${input.name}`);
}

async function handleUpdateRecipe(input: RecipeInput) {
  if (!editingRecipe) return;
  await api.updateRecipe(editingRecipe.id, input);
  setEditingRecipe(null);
  await load();
  toast("Saved");
}

async function handleDeleteRecipe() {
  if (!editingRecipe) return;
  const name = editingRecipe.name;
  await api.deleteRecipe(editingRecipe.id);
  setEditingRecipe(null);
  await load();
  toast(`Deleted ${name}`);
}

// Flag every missing ingredient: known items get needed=1, unknown ones
// become new zero-stock items so they land on the shopping list.
async function handleAddMissing(recipe: Recipe, status: RecipeStatus) {
  try {
    for (const s of status.missing) {
      if (s.item) await api.updateItem(s.item.id, { needed: 1 });
      else await api.createItem({ name: s.ingredient.name, quantity: 0, needed: true });
    }
    await load();
    toast(`Added ${status.missing.length} to shopping list`);
  } catch (e) {
    toast((e as Error).message);
  }
}

// Subtract what the recipe used. Only unit-comparable matches are touched;
// unverified ingredients are listed as skipped in the confirm.
async function handleCook(recipe: Recipe, status: RecipeStatus) {
  const usable = status.ingredients.filter((s) => s.item && comparable(s.item.unit, s.ingredient.unit));
  const skipped = status.unverified.length;
  const lines = usable.map((s) => `• ${s.item!.name}: −${s.ingredient.quantity} ${s.ingredient.unit}`).join("\n");
  const note = skipped ? `\n(${skipped} unverified ingredient${skipped === 1 ? "" : "s"} left unchanged)` : "";
  if (!window.confirm(`Cooked “${recipe.name}”? This subtracts from your pantry:\n${lines}${note}`)) return;
  try {
    for (const s of usable) {
      const used = convert(s.ingredient.quantity, s.ingredient.unit, s.item!.unit)!;
      const next = Math.max(0, +(s.item!.quantity - used).toFixed(2));
      await api.updateItem(s.item!.id, { quantity: next });
    }
    await load();
    toast(`Cooked ${recipe.name} — pantry updated`);
  } catch (e) {
    toast((e as Error).message);
  }
}
```

Replace the recipes placeholder block with:

```tsx
) : tab === "recipes" ? (
  <RecipesTab
    recipes={recipes}
    items={items}
    menu={menu}
    onAdd={() => setAddingRecipe(true)}
    onEdit={setEditingRecipe}
    onCook={handleCook}
    onAddMissing={handleAddMissing}
  />
```

Add overlays before the closing `</div>`:

```tsx
{addingRecipe && (
  <RecipeForm
    title="New recipe"
    submitLabel="Save recipe"
    items={items}
    onSubmit={handleCreateRecipe}
    onCancel={() => setAddingRecipe(false)}
  />
)}
{editingRecipe && (
  <RecipeForm
    title="Edit recipe"
    submitLabel="Save changes"
    initial={editingRecipe}
    items={items}
    onSubmit={handleUpdateRecipe}
    onCancel={() => setEditingRecipe(null)}
    onDelete={handleDeleteRecipe}
  />
)}
```

- [ ] **Step 4: Verify** — `npm test` + `npm run build`. With Playwright MCP at 390×844: create a recipe against seeded pantry items covering all three badge states (enough via kg→g, unverified via bag→cup, missing), screenshot the expanded card, tap "Add missing to list" and confirm the Shopping badge increments, tap "Cooked it" and confirm quantities drop.

- [ ] **Step 5: Commit**

```bash
git add app/components/
git commit -m "Add recipes tab: unit-aware can-I-make-it status, cook + add-missing actions"
```

---

### Task 7: Restyle ItemForm + Scanner to the warm theme

**Files:**
- Modify: `app/components/ItemForm.tsx`
- Modify: `app/components/Scanner.tsx`

**Interfaces:** none new — class-level restyle only, no behavior change.

- [ ] **Step 1: Apply the class mapping to both files**

| Old | New |
|---|---|
| `slate-###` (any) | `stone-###` (same shade) |
| `green-500` / `green-600` (focus, primary) | `pine-600` |
| `green-700` (active) | `pine-700` |
| `green-50` / `green-100` | `pine-50` / `pine-100` |
| `red-200` / `red-600` / `red-50` (delete button, errors) | `terracotta-100` / `terracotta-600` / `terracotta-100` |

Find them: `grep -n "slate-\|green-\|red-" app/components/ItemForm.tsx app/components/Scanner.tsx`. Also add `font-display` to the `<h2>` form/scanner titles.

- [ ] **Step 2: Verify** — `npm run build`; Playwright MCP: open Add-item form and Scanner overlay (camera will fail without a device — checking chrome/colors only), screenshot both.

- [ ] **Step 3: Commit**

```bash
git add app/components/ItemForm.tsx app/components/Scanner.tsx
git commit -m "Restyle item form + scanner to warm-kitchen palette"
```

---

### Task 8: Final verification, docs, push

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Full check** — `npm test` and `npm run build` both pass.

- [ ] **Step 2: Manual pass with Playwright MCP (390×844)** covering the spec's checklist: first-run empty state → add items (manual form) → pantry search/sort/expiring filter → quantity steppers → recipe create/edit/delete → cook flow → add-missing flow → shopping stock checker → got-it flow → backup export, then import of that file, then import of a hand-made v1 file (`{"items":[…]}` without recipes) confirming recipes survive.

- [ ] **Step 3: Update `CLAUDE.md`**
  - Architecture tree: add `PantryTab.tsx`, `RecipesTab.tsx`, `ShoppingTab.tsx`, `RecipeForm.tsx`, `BottomNav.tsx`, `BackupMenu.tsx`, `ui.tsx` under components with one-line notes; add `lib/units.ts` ("unit families + conversions"), `lib/recipeStatus.ts` ("can-I-make-it calculator") to the lib list; note `InventoryClient.tsx` is now the state-owning shell.
  - Persistence: mention DB v2 (`items` + `recipes` stores), backup v2 format `{ items, recipes }`, v1 imports still accepted.
  - Run & verify: add `npm test  # vitest — lib/units, lib/recipeStatus`.
  - Roadmap: mark recipes as shipped ("Recipes: checklist + quantities with unit conversion — shipped 2026-07").
  - Conventions: add "bottom tab bar navigation (Pantry · Recipes · [Scan] · Shopping); warm-kitchen palette tokens (pine/terracotta/cream/stone) defined in `globals.css` `@theme`".

- [ ] **Step 4: Commit + push**

```bash
git add CLAUDE.md
git commit -m "Update working notes: recipes shipped, storage v2, new component layout"
git push
```
