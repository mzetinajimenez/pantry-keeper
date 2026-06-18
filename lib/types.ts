export type Item = {
  id: number;
  barcode: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  quantity: number;
  unit: string;
  location: string | null;
  expiration_date: string | null; // YYYY-MM-DD
  image_url: string | null;
  notes: string | null;
  needed: number; // 0 | 1 — on the shopping list ("need more")
  created_at: string;
  updated_at: string;
};

// Fields a client may send when creating/updating an item.
export type ItemInput = {
  barcode?: string | null;
  name: string;
  brand?: string | null;
  category?: string | null;
  quantity?: number;
  unit?: string;
  location?: string | null;
  expiration_date?: string | null;
  image_url?: string | null;
  notes?: string | null;
  needed?: number | boolean;
};

// Normalized result from a barcode product lookup.
export type ProductLookup = {
  barcode: string;
  found: boolean;
  name: string | null;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  quantity_text: string | null;
};

export const LOCATIONS = [
  "Pantry",
  "Fridge",
  "Freezer",
  "Spice Rack",
  "Counter",
  "Other",
] as const;

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
  "ml",
  "L",
  "oz",
  "lb",
] as const;
