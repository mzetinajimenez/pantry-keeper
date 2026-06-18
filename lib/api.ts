"use client";

import type { Item, ItemInput, ProductLookup } from "./types";

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
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.location) qs.set("location", params.location);
  if (params.shopping) qs.set("shopping", "1");
  const res = await fetch(`/api/items?${qs.toString()}`, { cache: "no-store" });
  return (await json<{ items: Item[] }>(res)).items;
}

export async function createItem(input: ItemInput): Promise<Item> {
  const res = await fetch("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await json<{ item: Item }>(res)).item;
}

export async function updateItem(id: number, patch: Partial<ItemInput>): Promise<Item> {
  const res = await fetch(`/api/items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return (await json<{ item: Item }>(res)).item;
}

export async function deleteItem(id: number): Promise<void> {
  const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
  await json<{ ok: boolean }>(res);
}

export async function lookupBarcode(barcode: string): Promise<ProductLookup> {
  const res = await fetch(`/api/lookup?barcode=${encodeURIComponent(barcode)}`, {
    cache: "no-store",
  });
  return json<ProductLookup>(res);
}
