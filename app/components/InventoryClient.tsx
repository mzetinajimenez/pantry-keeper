"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Item, ItemInput, Recipe, RecipeInput } from "@/lib/types";
import type { RecipeStatus } from "@/lib/recipeStatus";
import { comparable, convert } from "@/lib/units";
import * as api from "@/lib/api";
import Scanner from "./Scanner";
import ItemForm from "./ItemForm";
import RecipeForm from "./RecipeForm";
import PantryTab from "./PantryTab";
import RecipesTab from "./RecipesTab";
import ShoppingTab from "./ShoppingTab";
import BottomNav, { type Tab } from "./BottomNav";
import BackupMenu from "./BackupMenu";

type Toast = { id: number; text: string };

export default function InventoryClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pantry");
  const [scanning, setScanning] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [adding, setAdding] = useState<Partial<Item> | null>(null);
  const [addingRecipe, setAddingRecipe] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

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

  useEffect(() => {
    load();
    // Best-effort, fire-and-forget: lower the odds of the browser evicting
    // IndexedDB (the only copy of the pantry). Failure is fine.
    void api.requestPersistentStorage();
  }, [load]);

  // Patch one item locally for optimistic UI, then persist.
  async function patchLocal(id: number, patch: Partial<ItemInput>, optimistic: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...optimistic } : it)));
    try {
      await api.updateItem(id, patch);
    } catch (e) {
      toast((e as Error).message);
      load();
    }
  }

  function adjustQty(item: Item, delta: number) {
    const next = Math.max(0, item.quantity + delta);
    patchLocal(item.id, { quantity: next }, { quantity: next });
  }

  function toggleNeeded(item: Item) {
    const next = item.needed === 1 ? 0 : 1;
    patchLocal(item.id, { needed: next }, { needed: next });
    toast(next ? `Added ${item.name} to shopping list` : `Removed ${item.name} from list`);
  }

  function needIt(item: Item) {
    patchLocal(item.id, { needed: 1 }, { needed: 1 });
    toast(`Added ${item.name} to shopping list`);
  }

  // "Got it" at the store: clear the flag and add one to stock.
  function gotIt(item: Item) {
    const nextQty = item.quantity + 1;
    patchLocal(item.id, { needed: 0, quantity: nextQty }, { needed: 0, quantity: nextQty });
    toast(`Got ${item.name} — now ${+nextQty.toFixed(2)} in stock`);
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

  async function handleDetected(barcode: string) {
    setScanning(false);
    const existing = items.find((it) => it.barcode === barcode);
    if (existing) {
      adjustQty(existing, 1);
      toast(`+1 ${existing.name} (now ${existing.quantity + 1})`);
      return;
    }
    let prefill: Partial<Item> = { barcode, quantity: 1 };
    try {
      const product = await api.lookupBarcode(barcode);
      if (product.found) {
        prefill = {
          barcode,
          name: product.name ?? "",
          brand: product.brand,
          category: product.category,
          image_url: product.image_url,
          quantity: 1,
        };
        toast(`Found: ${product.name}`);
      } else {
        toast("Product not in database — add it manually");
      }
    } catch {
      toast("Lookup failed — add it manually");
    }
    setAdding(prefill);
  }

  async function handleCreate(input: ItemInput) {
    await api.createItem(input);
    setAdding(null);
    await load();
    toast(`Added ${input.name}`);
  }

  async function handleUpdate(input: ItemInput) {
    if (!editing) return;
    await api.updateItem(editing.id, input);
    setEditing(null);
    await load();
    toast("Saved");
  }

  async function handleDelete() {
    if (!editing) return;
    const name = editing.name;
    await api.deleteItem(editing.id);
    setEditing(null);
    await load();
    toast(`Deleted ${name}`);
  }

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
          })? This can't be undone.`
        )
      ) {
        return;
      }
      const n = await api.importData({ items: restoredItems, recipes: restoredRecipes });
      await load();
      toast(
        `Restored ${n.items} item${n.items === 1 ? "" : "s"}${
          restoredRecipes ? ` + ${n.recipes} recipe${n.recipes === 1 ? "" : "s"}` : ""
        }`
      );
    } catch (e) {
      toast(`Import failed: ${(e as Error).message}`);
    }
  }

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
        <RecipesTab
          recipes={recipes}
          items={items}
          menu={menu}
          onAdd={() => setAddingRecipe(true)}
          onEdit={setEditingRecipe}
          onCook={handleCook}
          onAddMissing={handleAddMissing}
        />
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
          <div
            key={t.id}
            className="pointer-events-auto max-w-sm rounded-full bg-stone-900 px-4 py-2 text-sm text-white shadow-lg"
          >
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
    </div>
  );
}
