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

// Fields a client may send when creating/updating a recipe.
export type RecipeInput = {
  name: string;
  notes?: string | null;
  ingredients: RecipeIngredient[];
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

export const CATEGORIES = [
  "Produce — Fruit",
  "Produce — Vegetables",
  "Dry Goods",
  "Non-Perishables",
  "Dairy & Eggs",
  "Meat & Seafood",
  "Frozen",
  "Bakery",
  "Beverages",
  "Snacks",
  "Condiments & Spices",
  "Other",
] as const;

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
