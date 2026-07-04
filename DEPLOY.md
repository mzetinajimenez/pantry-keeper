# Deploying Pantry Keeper to Vercel

This app is a **stock Next.js 15 app**, so Vercel needs **no special config** — no
`vercel.json`, no build settings, no env vars. The only thing that ever made it
*not* serverless-friendly was `better-sqlite3` (a native module writing to a local
file). The IndexedDB migration removed that: storage now lives in the browser, and
the only server code left is the stateless `/api/lookup` proxy to Open Food Facts.

## Quickest path — get it on your phone now

```bash
npx vercel          # first run: log in + link project, then a preview deploy
npx vercel --prod   # promote to a stable production URL
```

- The first `npx vercel` is **interactive** (browser login). Run it yourself in the
  terminal: type `!npx vercel` at the Claude Code prompt, or run it in a normal shell.
- Vercel serves over **HTTPS automatically** — so the camera/barcode scanner works on
  your phone with no `localtunnel`. Just open the URL on the phone.
- Add the production URL to your phone's home screen to use it as a PWA.

## Long-term path — auto-deploy from GitHub

1. On vercel.com → **Add New Project** → import the `pantry-keeper` repo.
2. Accept the detected Next.js defaults. Every push to `main` → production; every
   branch/PR → its own preview URL.

## Notes

- **Data is per-device.** IndexedDB lives in the browser, so the phone and laptop
  each keep their own pantry, and clearing site data wipes it. That's the intended
  temporary setup; real sync means swapping `lib/clientStore.ts` for a hosted backend.
- **No env vars needed.** `/api/lookup` calls a public API with no key.
- The app shell prerenders as static (no `force-dynamic`), so `/` is served from
  Vercel's CDN; the only serverless invocations are `/api/lookup` calls.
- The app asks for **persistent storage** on first load (`navigator.storage.persist()`)
  to reduce the risk of the browser evicting IndexedDB. Installing to the home screen
  further protects data on iOS. JSON export (⋮ menu) is still the real backup.
