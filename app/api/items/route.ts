import { NextRequest, NextResponse } from "next/server";
import { createItem, listItems } from "@/lib/items";
import type { ItemInput } from "@/lib/types";

export const runtime = "nodejs";

export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const items = listItems({
    search: searchParams.get("q") ?? undefined,
    location: searchParams.get("location") ?? undefined,
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  let body: Partial<ItemInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const item = createItem({
    ...body,
    name: body.name.trim(),
    quantity: body.quantity === undefined ? 1 : Number(body.quantity),
  });
  return NextResponse.json({ item }, { status: 201 });
}
