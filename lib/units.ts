// Pure unit-conversion helpers for comparing recipe amounts to pantry stock.
// Conversions only happen within a family (mass, volume); count-style units
// (each, can, bag…) are only comparable to the exact same unit.

const MASS_G: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

const VOLUME_ML: Record<string, number> = {
  ml: 1,
  L: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  "fl oz": 29.5735,
  cup: 236.588,
  pint: 473.176,
  quart: 946.353,
  gallon: 3785.41,
};

export type UnitFamily = "mass" | "volume" | "count";

export function unitFamily(unit: string): UnitFamily {
  if (unit in MASS_G) return "mass";
  if (unit in VOLUME_ML) return "volume";
  return "count";
}

/** Whether amounts in these two units can be numerically compared. */
export function comparable(a: string, b: string): boolean {
  if (a === b) return true;
  const fa = unitFamily(a);
  return fa !== "count" && fa === unitFamily(b);
}

/**
 * Convert an amount between comparable units; null when they aren't
 * comparable (different families, or two different count units).
 */
export function convert(amount: number, from: string, to: string): number | null {
  if (from === to) return amount;
  if (!comparable(from, to)) return null;
  const table = unitFamily(from) === "mass" ? MASS_G : VOLUME_ML;
  return (amount * table[from]) / table[to];
}
