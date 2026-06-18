import { getDb } from "./db";
import type { Item, ItemInput } from "./types";

type ListOptions = {
  search?: string;
  location?: string;
  // Shopping list: items flagged "need more" or that are out of stock.
  shopping?: boolean;
};

export function listItems(opts: ListOptions = {}): Item[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (opts.search && opts.search.trim()) {
    clauses.push("(name LIKE @q OR brand LIKE @q OR category LIKE @q OR barcode LIKE @q)");
    params.q = `%${opts.search.trim()}%`;
  }
  if (opts.location && opts.location.trim()) {
    clauses.push("location = @location");
    params.location = opts.location.trim();
  }
  if (opts.shopping) {
    clauses.push("(needed = 1 OR quantity <= 0)");
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const sql = `
    SELECT * FROM items
    ${where}
    ORDER BY
      CASE WHEN expiration_date IS NULL THEN 1 ELSE 0 END,
      expiration_date ASC,
      name COLLATE NOCASE ASC
  `;
  return db.prepare(sql).all(params) as Item[];
}

export function getItem(id: number): Item | undefined {
  return getDb().prepare("SELECT * FROM items WHERE id = ?").get(id) as
    | Item
    | undefined;
}

export function findByBarcode(barcode: string): Item | undefined {
  return getDb()
    .prepare("SELECT * FROM items WHERE barcode = ? LIMIT 1")
    .get(barcode) as Item | undefined;
}

export function createItem(input: ItemInput): Item {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO items
        (barcode, name, brand, category, quantity, unit, location, expiration_date, image_url, notes, needed)
       VALUES
        (@barcode, @name, @brand, @category, @quantity, @unit, @location, @expiration_date, @image_url, @notes, @needed)`
    )
    .run({
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
    });
  return getItem(Number(info.lastInsertRowid))!;
}

const UPDATABLE: (keyof ItemInput)[] = [
  "barcode",
  "name",
  "brand",
  "category",
  "quantity",
  "unit",
  "location",
  "expiration_date",
  "image_url",
  "notes",
  "needed",
];

export function updateItem(id: number, patch: Partial<ItemInput>): Item | undefined {
  const db = getDb();
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };

  for (const key of UPDATABLE) {
    if (key in patch) {
      const raw = (patch as Record<string, unknown>)[key];
      sets.push(`${key} = @${key}`);
      // SQLite can't bind booleans; `needed` is stored as 0/1.
      params[key] = key === "needed" ? (raw ? 1 : 0) : (raw ?? null);
    }
  }
  if (!sets.length) return getItem(id);

  sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE items SET ${sets.join(", ")} WHERE id = @id`).run(params);
  return getItem(id);
}

export function deleteItem(id: number): boolean {
  const info = getDb().prepare("DELETE FROM items WHERE id = ?").run(id);
  return info.changes > 0;
}
