# Pantry Keeper — working notes for Claude

Mobile-first web app / PWA for cataloging and taking inventory of a pantry from a phone.
Scan a barcode → auto-fill from Open Food Facts, or add by hand. Tracks quantity, location,
and expiration in local SQLite.

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
- Quick API smoke test:
  ```bash
  curl -s http://localhost:3000/api/items
  curl -s -X POST http://localhost:3000/api/items -H 'Content-Type: application/json' \
    -d '{"name":"Test","quantity":2}'
  curl -s "http://localhost:3000/api/lookup?barcode=3017620422003"   # → Nutella
  ```

## Architecture
```
app/
  page.tsx                 renders the inventory UI (force-dynamic)
  layout.tsx               PWA metadata, viewport, global styles
  components/
    InventoryClient.tsx    main UI: list, search, scan/add orchestration + toasts
    Scanner.tsx            camera barcode scanner (ZXing) + manual/typed entry fallback
    ItemForm.tsx           add / edit item form
  api/
    items/route.ts         GET (list) · POST (create)
    items/[id]/route.ts    GET · PATCH · DELETE
    lookup/route.ts        GET barcode → Open Food Facts proxy
lib/
  db.ts                    SQLite connection + schema (the ONLY storage-specific file)
  items.ts                 data-access queries
  api.ts                   client-side fetch helpers
  types.ts                 shared types (Item, ItemInput, ProductLookup) + LOCATIONS/UNITS
```
- Stack: Next.js 15 (App Router) + React 19 + TypeScript, better-sqlite3, Tailwind v4.
- API routes set `runtime = "nodejs"` (required for the native SQLite module).
- `next.config.mjs` marks `better-sqlite3` as a `serverExternalPackages` — keep it there.

## Persistence
- Single source of truth: **`data/pantry.db`** (SQLite, WAL mode → also `-wal`/`-shm` files).
- `data/` is **git-ignored** (personal data, not source). Git is NOT a backup.
- Override location with `DATABASE_PATH`.
- All storage code is isolated in `lib/db.ts` so it can be swapped for Turso/libSQL or Postgres
  when deploying to a serverless host (the rest of the app is unchanged).

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
- Optimistic UI for quantity changes, then reconcile with the server.
- Re-scanning a known barcode increments its quantity instead of duplicating the row.
