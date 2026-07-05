"use client";

import type { Item, ItemInput, ProductLookup, Recipe, RecipeInput } from "./types";
import * as store from "./clientStore";

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export async function fetchItems(
  params: { q?: string; location?: string; shopping?: boolean } = {}
): Promise<Item[]> {
  return store.listItems({ search: params.q, location: params.location, shopping: params.shopping });
}

export async function createItem(input: ItemInput): Promise<Item> {
  if (!input.name || !input.name.trim()) {
    throw new Error("Name is required");
  }
  return store.createItem({ ...input, name: input.name.trim() });
}

export async function updateItem(id: number, patch: Partial<ItemInput>): Promise<Item> {
  if ("name" in patch && (!patch.name || !patch.name.trim())) {
    throw new Error("Name cannot be empty");
  }
  const item = await store.updateItem(id, patch);
  if (!item) throw new Error("Not found");
  return item;
}

export async function deleteItem(id: number): Promise<void> {
  const ok = await store.deleteItem(id);
  if (!ok) throw new Error("Not found");
}

// Best-effort: keep the browser from evicting the local store. Fire-and-forget
// on startup; becomes a no-op if storage ever moves to a hosted backend.
export async function requestPersistentStorage(): Promise<boolean> {
  return store.requestPersistentStorage();
}

// Backup / restore — the IndexedDB stores live only in this browser, so let
// users save a JSON copy and load it back (e.g. after clearing site data).
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

export async function lookupBarcode(barcode: string): Promise<ProductLookup> {
  const res = await fetch(`/api/lookup?barcode=${encodeURIComponent(barcode)}`, {
    cache: "no-store",
  });
  return json<ProductLookup>(res);
}
