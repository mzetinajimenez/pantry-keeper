# Deploying Pantry Keeper to Vercel

This app is a **stock Next.js 15 app**, so Vercel needs **no special config** — no
`vercel.json`, no build settings, no env vars. The only thing that ever made it
*not* serverless-friendly was `better-sqlite3` (a native module writing to a local
file). The IndexedDB migration removed that: storage now lives in the browser, and
the only server code left is the stateless `/api/lookup` proxy to Open Food Facts.

> ⚠️ **Prerequisite:** deploy must include the IndexedDB changes. The old `main`
> (SQLite) will *build* on Vercel but break at runtime — serverless filesystems are
> ephemeral and read-only. Land PR #2 (or deploy this branch) first.

## Quickest path — get it on your phone now

From this worktree (the working files already contain the IndexedDB version):

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

1. Merge PR #2 (IndexedDB) into `main`.
2. On vercel.com → **Add New Project** → import the `pantry-keeper` repo.
3. Accept the detected Next.js defaults. Every push to `main` → production; every
   branch/PR → its own preview URL.

## Notes

- **Data is per-device.** IndexedDB lives in the browser, so the phone and laptop
  each keep their own pantry, and clearing site data wipes it. That's the intended
  temporary setup; real sync means swapping `lib/clientStore.ts` for a hosted backend.
- **No env vars needed.** `/api/lookup` calls a public API with no key.
- Optional perf tweak: `app/page.tsx` still sets `export const dynamic = "force-dynamic"`,
  a leftover from the SQLite era. With all data client-side it can be removed so the
  shell prerenders as static (served from CDN). Not required for deploy.
