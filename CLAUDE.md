# Pantry Keeper — working notes for Claude

Mobile-first web app / PWA for cataloging and taking inventory of a pantry from a phone.
Scan a barcode → auto-fill from Open Food Facts, or add by hand. Tracks quantity, location,
and expiration in the browser's IndexedDB (client-only, single device for now).

## How the user wants me to work
- **Focus on functionality.** Prefer shipping working features over process.
- **Skip PR ceremony — commit and push straight to `main`.** No feature branches / PRs unless asked.
- **Always ask before installing npm packages / adding dependencies.** Don't auto-run `npm install`.
- **No backwards-compat shims.** We're the sole owners and only callers — when a format, type, or
  API changes, break cleanly and migrate everything in the same commit instead of supporting old
  shapes. One exception: never destroy existing IndexedDB data — the `onupgradeneeded` version
  migration in `clientStore.ts` stays.
- End commit messages with the `Co-Authored-By: Claude Opus 4.8` line.
- Keep the storage layer swappable (see Persistence) so deployment stays easy.

## Run & verify
```bash
npm install
npm run dev          # http://localhost:3000  (background it; camera needs localhost or HTTPS)
npm run build        # type-checks the whole app — run this to catch errors
npm test             # vitest — lib/units + lib/recipeStatus (pure logic)
```
- ⚠ `npm run build` and `npm run dev` share `.next/` — restart the dev server after a build,
  or the browser gets 404s for stale chunks.
- Phone/camera testing needs HTTPS: `npx localtunnel --port 3000`, open the https URL on a phone.
- Items live in IndexedDB (per-browser), so there's no items API to curl — exercise them in the UI.
  The one server route left is the barcode lookup proxy:
  ```bash
  curl -s "http://localhost:3000/api/lookup?barcode=3017620422003"   # → Nutella
  ```

## Architecture
```
app/
  page.tsx                 renders the inventory UI (force-dynamic)
  layout.tsx               PWA metadata, viewport, Fraunces font, global styles
  components/
    InventoryClient.tsx    state-owning shell: items/recipes state, all handlers, overlays, toasts
    PantryTab.tsx          pantry list: search, location chips, sort, expiring filter, first-run
    RecipesTab.tsx         recipe cards w/ live can-I-make-it status, cook + add-missing actions
    ShoppingTab.tsx        shopping list + live stock checker (type → see what you have)
    ItemForm.tsx           add / edit item form
    RecipeForm.tsx         add / edit recipe form (ingredient rows w/ pantry autocomplete)
    Scanner.tsx            camera barcode scanner (ZXing) + manual/typed entry fallback
    BottomNav.tsx          bottom tab bar: Pantry · Recipes · [Scan] · Shopping
    BackupMenu.tsx         header ⋮ menu (export / import backup)
    ui.tsx                 shared bits: HeaderShell, Chip, EmptyState, ExpiryBadge, icons
  api/
    lookup/route.ts        GET barcode → Open Food Facts proxy (only remaining server route)
lib/
  clientStore.ts           IndexedDB-backed data-access (the ONLY storage-specific file)
  api.ts                   data-access facade the UI calls (items + recipes CRUD, export/import)
  units.ts                 unit families (mass/volume/count) + conversions — pure, tested
  recipeStatus.ts          can-I-make-it calculator (match + compare via units) — pure, tested
  useModalA11y.ts          focus-trap + Escape-to-close hook for overlays
  types.ts                 shared types (Item, Recipe, RecipeIngredient…) + LOCATIONS/UNITS
```
- Stack: Next.js 15 (App Router) + React 19 + TypeScript, IndexedDB (browser), Tailwind v4.
- No native modules / server DB — `lib/clientStore.ts` runs in the browser, so the app deploys
  to any static/serverless host with zero storage config.

## Persistence
- Single source of truth: **IndexedDB** (`pantry-keeper` DB **v2**, `items` + `recipes` stores)
  in *this* browser.
- Client-only and single-device: data does NOT sync across devices and is wiped if the browser's
  site data is cleared. There is no server-side copy and Git is NOT a backup.
- **Backup/restore is the safety net:** the header ⋮ menu exports items **and recipes** to a JSON
  file (`{ items, recipes }`) and imports one back (restore = replace-all of both stores, behind
  a confirm). Import expects that same shape — no legacy formats. Keep this working.
- All storage code is isolated in `lib/clientStore.ts` behind the `lib/api.ts` facade
  (`fetchItems`/`createItem`/`updateItem`/`deleteItem`/`exportData`/`importData`), so it can be
  swapped for a hosted backend (a few API routes over Turso/libSQL or Postgres) when multi-device
  sync / sharing is needed — the rest of the app is unchanged.

## Roadmap / product decisions (from the user)
- **Solo now, sharing later.** No auth yet; keep the data model ready for multi-user.
- **Sign-in will be phone number + SMS code** when we add sharing. Build it with a
  pluggable sender: dev = log/show the code locally, prod = a real SMS provider (e.g. Twilio).
  Real cross-person sharing requires deploying (one shared server) — local is single-user.
- **Shopping list** = the `needed` flag on items *plus* anything out of stock (`quantity <= 0`).
  Flag items "need more", quick-add to the list, and "got it" clears the flag and +1 stock.
- **Recipes — shipped 2026-07:** checklist + quantities. Ingredients match pantry items by
  `item_id` link, falling back to case-insensitive name match. Amounts compare via unit
  conversion within a family (mass g/kg/oz/lb; volume ml/L/tsp/tbsp/cup/…); cross-family
  (e.g. cups vs bag) shows an honest "unverified" state, never a fake answer. "Cooked it"
  decrements comparable stock; "Add missing" flags shortfalls onto the shopping list.
- Reminders: skipped for now.

## Conventions
- Mobile-first Tailwind; respect iOS safe areas (`env(safe-area-inset-*)`).
- **Warm-kitchen palette** via Tailwind v4 `@theme` tokens in `globals.css`: `cream` background,
  `pine-*` greens (primary), `terracotta-*` (warnings/expiry/out), `stone` neutrals (not slate),
  `font-display` = Fraunces for headings. Use these tokens, not raw green/red/slate.
- Navigation is the fixed bottom tab bar (`BottomNav`): Pantry · Recipes · [Scan] · Shopping.
- Optimistic UI for quantity changes, then reconcile with the local store.
- Re-scanning a known barcode increments its quantity instead of duplicating the row
  (handled in `InventoryClient.handleDetected` via an in-memory barcode match).
- Overlays (Scanner, ItemForm, RecipeForm) use `useModalA11y` for focus-trap + Escape-to-close.
