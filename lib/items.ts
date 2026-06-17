import { getDb } from "./db";
import type { Item, ItemInput } from "./types";

type ListOptions = {
  search?: string;
  location?: string;
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
        (barcode, name, brand, category, quantity, unit, location, expiration_date, image_url, notes)
       VALUES
        (@barcode, @name, @brand, @category, @quantity, @unit, @location, @expiration_date, @image_url, @notes)`
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
];

export function updateItem(id: number, patch: Partial<ItemInput>): Item | undefined {
  const db = getDb();
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };

  for (const key of UPDATABLE) {
    if (key in patch) {
      sets.push(`${key} = @${key}`);
      params[key] = (patch as Record<string, unknown>)[key] ?? null;
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
