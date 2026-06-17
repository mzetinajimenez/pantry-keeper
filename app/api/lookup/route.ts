import { NextRequest, NextResponse } from "next/server";
import type { ProductLookup } from "@/lib/types";

export const runtime = "nodejs";

// Enrich a scanned barcode using the free Open Food Facts database.
// https://world.openfoodfacts.org/data
export async function GET(req: NextRequest) {
  const barcode = (new URL(req.url).searchParams.get("barcode") ?? "").trim();
  if (!barcode) {
    return NextResponse.json({ error: "barcode is required" }, { status: 400 });
  }

  const empty: ProductLookup = {
    barcode,
    found: false,
    name: null,
    brand: null,
    category: null,
    image_url: null,
    quantity_text: null,
  };

  try {
    const fields = "product_name,brands,categories,image_front_small_url,quantity";
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      barcode
    )}.json?fields=${fields}`;

    const res = await fetch(url, {
      headers: { "User-Agent": "PantryKeeper/0.1 (local)" },
      // Product data is stable enough to cache briefly.
      next: { revalidate: 3600 },
    });

    if (!res.ok) return NextResponse.json(empty);

    const data = (await res.json()) as {
      status?: number;
      product?: {
        product_name?: string;
        brands?: string;
        categories?: string;
        image_front_small_url?: string;
        quantity?: string;
      };
    };

    if (data.status !== 1 || !data.product) {
      return NextResponse.json(empty);
    }

    const p = data.product;
    const firstCategory = p.categories?.split(",")[0]?.trim() || null;

    const result: ProductLookup = {
      barcode,
      found: Boolean(p.product_name),
      name: p.product_name?.trim() || null,
      brand: p.brands?.split(",")[0]?.trim() || null,
      category: firstCategory,
      image_url: p.image_front_small_url || null,
      quantity_text: p.quantity?.trim() || null,
    };
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(empty);
  }
}
