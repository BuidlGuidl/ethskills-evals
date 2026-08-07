# Why `/debug` 404s on IPFS (and `/` doesn't)

## The gateway mechanics

An IPFS gateway is **not** a Next.js server. Nobody is running `next start`
behind it. The gateway just resolves paths against the directory tree (the
UnixFS DAG) you uploaded and streams back whatever file sits at that path.
It has exactly **one** piece of routing magic: when a path resolves to a
**directory**, the gateway looks inside it for an `index.html` and serves
that. That's the whole rule.

Now look at what you uploaded:

```
out/index.html
out/debug.html
out/404.html
out/_next/...
```

- **`/` works** because the request resolves to the `out/` directory itself.
  The gateway applies its one rule — "directory → serve `index.html`" — finds
  `out/index.html`, and returns it. 200.

- **`/debug` 404s** because the browser requests the path `/debug`. In your
  tree there is no node named `debug` — there's a *file* named `debug.html`.
  `debug` and `debug.html` are different names. The gateway does **not** guess
  extensions: it will not silently try `debug.html`, `debug/index.html`, or
  anything else. `/debug` doesn't exist, so the gateway falls through to the
  404 handler and serves `out/404.html`.

- Every non-`/` route breaks for the same reason. The generated files are all
  bare `<route>.html` names, but the browser navigates to extensionless
  `<route>` paths. The only path that lines up with a directory (and therefore
  triggers the index-html rule) is `/`.

The key insight: a real server maps `/debug` → `debug.html` for you. The IPFS
gateway does **no** such mapping. The only path shape it will resolve for a
clean URL like `/debug` is a **directory** named `debug` that contains an
`index.html`.

## The fix: `trailingSlash: true`

You need the export to emit `debug/index.html` instead of `debug.html`, so the
gateway's directory rule kicks in. That's controlled by `trailingSlash` in
`next.config.ts`:

- `trailingSlash: false` (Next.js default) → `out/debug.html`
- `trailingSlash: true` → `out/debug/index.html`

With the trailing slash on, `/debug` resolves like this:
`/debug` → directory `debug/` → gateway serves `debug/index.html` → 200.

You also need `output: "export"` to be producing the static HTML in the first
place (you already have that, since `out/` is being generated).

```typescript
// packages/nextjs/next.config.ts
const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;          // <-- the line that fixes the 404s
  nextConfig.images = { unoptimized: true }; // static export can't use the image optimizer
}
```

Then rebuild from a clean slate (never re-upload a stale `out/`):

```bash
cd packages/nextjs
rm -rf .next out
NEXT_PUBLIC_IPFS_BUILD=true yarn build
```

## What `out/` looks like after the change

Every route becomes its own directory with an `index.html` inside it:

```
out/index.html               # /            (unchanged)
out/debug/index.html         # /debug       (was out/debug.html)
out/404.html                 # 404 fallback
out/_next/...
```

If you had more routes they'd follow the same pattern — e.g.
`out/blockexplorer/index.html`, `out/example/index.html`, etc. Now that each
route name is a directory, the gateway's "directory → index.html" rule fires
for all of them, not just the root.

## Verify from the command line before re-uploading

**1. Confirm the layout is directory-per-route (local check):**

```bash
ls out/*/index.html
# Expect: out/debug/index.html   (and any other routes)
# If you still see out/debug.html, trailingSlash didn't take effect — rebuild.
```

**2. After uploading, check actual gateway HTTP status codes:**

```bash
# Home page — should be 200
curl -s -o /dev/null -w "%{http_code}\n" -L "https://<GATEWAY>/ipfs/<CID>/"

# The route that used to 404 — should now be 200
curl -s -o /dev/null -w "%{http_code}\n" -L "https://<GATEWAY>/ipfs/<CID>/debug/"
```

The `-L` follows redirects (the gateway may 308-redirect `/debug` → `/debug/`),
and `-w "%{http_code}"` prints just the final status. Both should print `200`.
If `/debug/` still prints `404`, you uploaded a stale build — `rm -rf .next
out`, rebuild, and confirm you got a **new CID** (an unchanged CID means the
content didn't change, so you re-uploaded the old files).

## One thing to watch for beyond routing

`trailingSlash` only fixes routes that were actually generated. If a page
**crashes during static prerendering** (e.g. it touches `localStorage` or other
browser-only APIs at import time), Next.js skips emitting it and you get a 404
for that route *even with the trailing slash set*. SE2's block-explorer pages
are the classic offender. If a specific route still 404s after this fix while
others work, check the build log for a prerender error on that page rather than
assuming it's a gateway problem.
