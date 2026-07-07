"use client";

import { useMemo, useState } from "react";
import type { Item, Recipe } from "@/lib/types";
import { recipeStatus, type IngredientStatus, type RecipeStatus } from "@/lib/recipeStatus";
import { EmptyState, HeaderShell } from "./ui";

type Props = {
  recipes: Recipe[];
  items: Item[];
  menu: React.ReactNode;
  onAdd: () => void;
  onEdit: (recipe: Recipe) => void;
  onCook: (recipe: Recipe, status: RecipeStatus) => void;
  onAddMissing: (recipe: Recipe, status: RecipeStatus) => void;
};

export default function RecipesTab({ recipes, items, menu, onAdd, onEdit, onCook, onAddMissing }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const statuses = useMemo(
    () => new Map(recipes.map((r) => [r.id, recipeStatus(r, items)])),
    [recipes, items],
  );
  const readyCount = [...statuses.values()].filter((s) => s.status === "can-make").length;

  return (
    <>
      <HeaderShell
        subtitle={recipes.length === 0 ? "0 recipes" : `${readyCount} of ${recipes.length} ready`}
        actions={
          <>
            <button
              onClick={onAdd}
              aria-label="New recipe"
              className="flex h-8 w-8 items-center justify-center rounded-full text-2xl leading-none text-pine-700 active:bg-pine-50"
            >
              ＋
            </button>
            {menu}
          </>
        }
      />

      <main className="px-4 pb-32 pt-3">
        {recipes.length === 0 ? (
          <EmptyState
            emoji="🍳"
            title="No recipes yet"
            hint="Add one and see instantly whether your pantry can make it."
          >
            <button
              onClick={onAdd}
              className="mt-5 rounded-xl bg-pine-600 px-6 py-3 font-semibold text-white active:bg-pine-700"
            >
              + New recipe
            </button>
          </EmptyState>
        ) : (
          <ul aria-label="Recipes" className="space-y-2">
            {recipes.map((r) => {
              const s = statuses.get(r.id)!;
              const open = expandedId === r.id;
              return (
                <li key={r.id} className="rounded-2xl border border-stone-200 bg-white shadow-sm">
                  <button
                    onClick={() => setExpandedId(open ? null : r.id)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-display truncate text-base font-semibold text-stone-800">{r.name}</p>
                      <p className="text-sm text-stone-500">
                        {r.ingredients.length} ingredient{r.ingredients.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <StatusBadge status={s} />
                  </button>

                  {open && (
                    <div className="border-t border-stone-100 p-3">
                      <ul className="space-y-1.5">
                        {s.ingredients.map((ing, i) => (
                          <IngredientLine key={i} s={ing} />
                        ))}
                      </ul>
                      {r.notes && <p className="mt-3 text-sm text-stone-500">{r.notes}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {s.missing.length > 0 && (
                          <button
                            onClick={() => onAddMissing(r, s)}
                            className="rounded-lg bg-pine-600 px-3.5 py-2 text-sm font-semibold text-white active:bg-pine-700"
                          >
                            🛒 Add {s.missing.length} missing to list
                          </button>
                        )}
                        {s.status !== "missing" && (
                          <button
                            onClick={() => onCook(r, s)}
                            className="rounded-lg bg-pine-600 px-3.5 py-2 text-sm font-semibold text-white active:bg-pine-700"
                          >
                            🍳 Cooked it
                          </button>
                        )}
                        <button
                          onClick={() => onEdit(r)}
                          className="rounded-lg border border-stone-300 px-3.5 py-2 text-sm font-medium text-stone-600 active:bg-stone-100"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}

function StatusBadge({ status }: { status: RecipeStatus }) {
  if (status.status === "can-make") {
    return (
      <span className="shrink-0 rounded-full bg-pine-100 px-2.5 py-1 text-xs font-semibold text-pine-800">
        ✓ Can make
      </span>
    );
  }
  if (status.status === "probably") {
    return (
      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
        ~ Probably
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-terracotta-100 px-2.5 py-1 text-xs font-semibold text-terracotta-700">
      Missing {status.missing.length}
    </span>
  );
}

function IngredientLine({ s }: { s: IngredientStatus }) {
  const { ingredient: ing, item, status, available } = s;
  const round = (n: number) => +n.toFixed(2);
  const icon = status === "enough" ? "✓" : status === "unverified" ? "~" : "✗";
  const iconCls =
    status === "enough" ? "text-pine-700" : status === "unverified" ? "text-amber-600" : "text-terracotta-600";
  let detail: string;
  if (status === "enough") detail = `have ≈${round(available!)} ${ing.unit}`;
  else if (status === "unverified") detail = `have ${round(item!.quantity)} ${item!.unit} — can't compare`;
  else if (item && available !== null) detail = `have ${round(available)}, need ${ing.quantity}`;
  else if (item) detail = "out of stock";
  else detail = "not in pantry";
  return (
    <li className="flex items-start gap-2 text-sm">
      <span className={`mt-0.5 w-4 shrink-0 text-center font-bold ${iconCls}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium text-stone-800">{ing.name}</span>
          <span className="shrink-0 text-stone-500">
            {ing.quantity} {ing.unit}
          </span>
        </div>
        <p className="text-xs text-stone-400">{detail}</p>
      </div>
    </li>
  );
}
