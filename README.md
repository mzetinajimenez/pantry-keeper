# 🥫 Pantry Keeper

A mobile-first web app for cataloging and taking inventory of your pantry from your phone.
Scan a product's barcode with the phone camera, and Pantry Keeper auto-fills the name, brand,
and photo from the [Open Food Facts](https://world.openfoodfacts.org) database — or add items
by hand. Track quantities, locations, and expiration dates.

It's a Progressive Web App: open it in your phone's browser and "Add to Home Screen" to use it
like a native app. No app store required.

## Features

- 📷 **Camera barcode scanning** (EAN / UPC / QR) right in the browser
- 🔎 **Automatic product lookup** — name, brand, category, and image from a barcode
- ⌨️ **Manual / typed input mode** when the camera isn't available
- ➕ **One-tap quantity stepper** and re-scan-to-increment for fast stock-taking
- 📍 Locations (Pantry / Fridge / Freezer / …), categories, and **expiration tracking**
- 🔍 Live search and location filters
- 💾 Local **SQLite** storage — your data stays on your machine

## Tech stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **better-sqlite3** for storage (file at `data/pantry.db`)
- **@zxing/browser** for barcode decoding
- **Tailwind CSS v4**

## Run it locally

```bash
npm install
npm run dev
```

Then open **http://localhost:3000** on your computer.

### Use it from your phone (camera needs HTTPS or localhost)

Browsers only grant camera access on `localhost` or over HTTPS. To test on your actual phone
while developing, expose the dev server over a trusted HTTPS tunnel, e.g.:

```bash
npx localtunnel --port 3000
# or: npx ngrok http 3000   /   npx cloudflared tunnel --url http://localhost:3000
```

Open the resulting `https://…` URL on your phone and allow camera access.

## Project layout

```
app/
  page.tsx                 # renders the inventory UI
  layout.tsx               # PWA metadata, viewport, global styles
  components/
    InventoryClient.tsx    # main UI: list, search, scan/add orchestration
    Scanner.tsx            # camera barcode scanner (ZXing) + manual entry
    ItemForm.tsx           # add / edit item form
  api/
    items/route.ts         # GET (list) · POST (create)
    items/[id]/route.ts    # GET · PATCH · DELETE
    lookup/route.ts        # GET barcode → Open Food Facts proxy
lib/
  db.ts                    # SQLite connection + schema
  items.ts                 # data-access queries
  api.ts                   # client-side fetch helpers
  types.ts                 # shared types & constants
```

## Configuration

- `DATABASE_PATH` — override where the SQLite file lives (default `./data/pantry.db`).

## Deploying later

The app is a standard Next.js project, so it runs anywhere Node does. The one thing to plan for
is storage: `better-sqlite3` writes to a local file, which is great for a single server / Docker
volume but not for ephemeral serverless filesystems. For a serverless host (e.g. Vercel), swap
the storage layer in `lib/db.ts` for a hosted SQLite (Turso/libSQL) or Postgres — the rest of the
app is unchanged.
