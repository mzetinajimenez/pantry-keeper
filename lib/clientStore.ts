"use client";

import type { Item, ItemInput, Recipe, RecipeInput } from "./types";

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

function await_<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAll(): Promise<Item[]> {
  return openDb().then((db) => await_(tx(db, "readonly").getAll() as IDBRequest<Item[]>));
}

type ListOptions = {
  search?: string;
  location?: string;
  shopping?: boolean;
};

export async function listItems(opts: ListOptions = {}): Promise<Item[]> {
  let items = await getAll();

  if (opts.search && opts.search.trim()) {
    const q = opts.search.trim().toLowerCase();
    items = items.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        (it.brand ?? "").toLowerCase().includes(q) ||
        (it.category ?? "").toLowerCase().includes(q) ||
        (it.barcode ?? "").toLowerCase().includes(q)
    );
  }
  if (opts.location && opts.location.trim()) {
    items = items.filter((it) => it.location === opts.location);
  }
  if (opts.shopping) {
    items = items.filter((it) => it.needed === 1 || it.quantity <= 0);
  }

  items.sort((a, b) => {
    const aNoExp = a.expiration_date === null;
    const bNoExp = b.expiration_date === null;
    if (aNoExp !== bNoExp) return aNoExp ? 1 : -1;
    if (a.expiration_date !== b.expiration_date) {
      return (a.expiration_date ?? "").localeCompare(b.expiration_date ?? "");
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return items;
}

export async function getItem(id: number): Promise<Item | undefined> {
  const db = await openDb();
  return await_(tx(db, "readonly").get(id) as IDBRequest<Item | undefined>);
}

export async function createItem(input: ItemInput): Promise<Item> {
  const db = await openDb();
  const now = new Date().toISOString();
  const record: Omit<Item, "id"> = {
    barcode: input.barcode ?? null,
    name: input.name,
    brand: input.brand ?? null,
    category: input.category ?? null,
    quantity: input.quantity ?? 1,
    unit: input.unit ?? "each",
    location: input.location ?? null,
    expiration_date: input.expiration_date ?? null,
    image_url: input.image_url ?? null,
    notes: input.notes ?? null,
    needed: input.needed ? 1 : 0,
    created_at: now,
    updated_at: now,
  };
  const id = await await_(tx(db, "readwrite").add(record) as IDBRequest<number>);
  return { ...record, id };
}

export async function updateItem(
  id: number,
  patch: Partial<ItemInput>
): Promise<Item | undefined> {
  const db = await openDb();
  const store = tx(db, "readwrite");
  const existing = await await_(store.get(id) as IDBRequest<Item | undefined>);
  if (!existing) return undefined;

  const updated: Item = {
    ...existing,
    ...patch,
    needed:
      "needed" in patch ? (patch.needed ? 1 : 0) : existing.needed,
    updated_at: new Date().toISOString(),
  };
  await await_(store.put(updated) as IDBRequest<number>);
  return updated;
}

export async function deleteItem(id: number): Promise<boolean> {
  const db = await openDb();
  const store = tx(db, "readwrite");
  const existing = await await_(store.get(id) as IDBRequest<Item | undefined>);
  if (!existing) return false;
  await await_(store.delete(id) as IDBRequest<undefined>);
  return true;
}

/**
 * Ask the browser to mark this origin's storage as persistent, so the
 * IndexedDB pantry (the only copy of the data) isn't evicted under storage
 * pressure or by Safari's inactivity cleanup. Safe to call repeatedly;
 * resolves false when unsupported or denied — the app works either way.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Every item, for a JSON backup export. */
export async function exportItems(): Promise<Item[]> {
  return getAll();
}

/** Wipe the store and bulk-load items from a backup (restore). Returns the count written. */
export async function replaceAll(items: Item[]): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    store.clear();
    for (const it of items) store.put(it);
    transaction.oncomplete = () => resolve(items.length);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

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
