# Pantry Keeper — working notes for Claude

Mobile-first web app / PWA for cataloging and taking inventory of a pantry from a phone.
Scan a barcode → auto-fill from Open Food Facts, or add by hand. Tracks quantity, location,
and expiration in the browser's IndexedDB (client-only, single device for now).

## How the user wants me to work
- **Focus on functionality.** Prefer shipping working features over process.
- **Skip PR ceremony — commit and push straight to `main`.** No feature branches / PRs unless asked.
- **Always ask before installing npm packages / adding dependencies.** Don't auto-run `npm install`.
- End commit messages with the `Co-Authored-By: Claude Opus 4.8` line.
- Keep the storage layer swappable (see Persistence) so deployment stays easy.

## Run & verify
```bash
npm install
npm run dev          # http://localhost:3000  (background it; camera needs localhost or HTTPS)
npm run build        # type-checks the whole app — run this to catch errors
```
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
  layout.tsx               PWA metadata, viewport, global styles
  components/
    InventoryClient.tsx    main UI: list, search, scan/add orchestration, backup menu + toasts
    Scanner.tsx            camera barcode scanner (ZXing) + manual/typed entry fallback
    ItemForm.tsx           add / edit item form
  api/
    lookup/route.ts        GET barcode → Open Food Facts proxy (only remaining server route)
lib/
  clientStore.ts           IndexedDB-backed data-access (the ONLY storage-specific file)
  api.ts                   data-access facade the UI calls (fetch/create/update/delete + export/import)
  useModalA11y.ts          focus-trap + Escape-to-close hook for overlays
  types.ts                 shared types (Item, ItemInput, ProductLookup) + LOCATIONS/UNITS
```
- Stack: Next.js 15 (App Router) + React 19 + TypeScript, IndexedDB (browser), Tailwind v4.
- No native modules / server DB — `lib/clientStore.ts` runs in the browser, so the app deploys
  to any static/serverless host with zero storage config.

## Persistence
- Single source of truth: **IndexedDB** (`pantry-keeper` DB, `items` store) in *this* browser.
- Client-only and single-device: data does NOT sync across devices and is wiped if the browser's
  site data is cleared. There is no server-side copy and Git is NOT a backup.
- **Backup/restore is the safety net:** the header ⋮ menu exports all items to a JSON file and
  imports one back (restore = replace-all, behind a confirm). Keep this working.
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
- Reminders: skipped for now.

## Conventions
- Mobile-first Tailwind; respect iOS safe areas (`env(safe-area-inset-*)`).
- Optimistic UI for quantity changes, then reconcile with the local store.
- Re-scanning a known barcode increments its quantity instead of duplicating the row
  (handled in `InventoryClient.handleDetected` via an in-memory barcode match).
- Overlays (Scanner, ItemForm) use `useModalA11y` for focus-trap + Escape-to-close.
