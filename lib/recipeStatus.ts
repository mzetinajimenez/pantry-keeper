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
