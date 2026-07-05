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
