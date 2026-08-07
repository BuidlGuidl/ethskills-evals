# Why `/debug` 404s on an IPFS gateway (and `/` doesn't)

## 1. Gateway path resolution — the mechanics

An IPFS gateway does **not** behave like a traditional web server (nginx,
Apache, Vercel). It resolves a request path as a walk through the UnixFS DAG —
the directory tree you uploaded — matching **exact** path segments against the
named links in each directory node. There is no "try adding `.html`" fallback
and no configurable rewrite table. The only bit of magic it applies is the
**directory-index convention**: when the path resolves to a *directory* node,
the gateway looks for a child link literally named `index.html` and serves that.

Your uploaded tree looks like this to the gateway:

```
<root dir>
├── index.html      (file)
├── debug.html      (file)
├── 404.html        (file)
└── _next/          (dir)
```

Now walk each request:

- **`GET /`** → resolves to the **root directory** node. Directory → the
  gateway applies the index convention → finds the child `index.html` → serves
  it. **200.** This is why the home page works.

- **`GET /debug`** → the gateway looks in the root directory for a child link
  named exactly `debug`. There is **no** link named `debug` — there is a *file*
  named `debug.html`. `debug` ≠ `debug.html`, and the gateway will not guess the
  `.html` extension the way a classic web server would. Resolution fails →
  **404.** Same story for every non-root route.

- **`GET /debug.html`** → this *would* resolve (exact match on the file link),
  but your app's `<Link href="/debug">` / router never requests that URL, so in
  practice the whole app is broken past the landing page.

The root cause: **flat `route.html` files are unreachable by clean
(`/route`) URLs on an IPFS gateway.** The home page is the lucky exception only
because `/` collapses to the root directory and the index convention rescues it.

## 2. The `next.config` change that fixes it

Add **`trailingSlash: true`** to the Next.js config (alongside the static-export
settings). In a Scaffold-ETH 2 app this is `packages/nextjs/next.config.ts`
(older versions: `next.config.js`):

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",          // static export → out/  (required for IPFS)
  trailingSlash: true,       // <-- the fix: emit a directory per route
  images: { unoptimized: true },
  // ...rest of the Scaffold-ETH config
};

export default nextConfig;
```

`trailingSlash: true` does two cooperating things:

1. **Build output** — every route is emitted as `route/index.html` (a
   directory containing an `index.html`) instead of a flat `route.html`.
2. **Link generation** — the Next.js `<Link>` / router now produces hrefs with
   trailing slashes (`/debug/`), which resolve to those directories.

Because each route is now a directory with an `index.html` inside it, the
gateway's directory-index convention — the same rule that already made `/` work
— now applies to *every* route.

## 3. What `out/` looks like after the change

```
out/
├── index.html            # served for  /
├── 404.html
├── debug/
│   └── index.html        # served for  /debug/
├── blockexplorer/
│   └── index.html        # served for  /blockexplorer/
└── _next/
    └── ...               # hashed JS/CSS assets, unchanged
```

Every page route is now `<route>/index.html`. `GET /debug/` resolves to the
`debug` directory → index convention → serves `debug/index.html`. Fixed.

## 4. Verify from the command line before re-uploading

### Option A — faithful: add to a local IPFS (Kubo) node and hit its gateway

This reproduces exactly the resolution logic a public gateway uses.

```bash
# Import the export directory; -Q prints just the root CID.
CID=$(ipfs add -Qr --cid-version 1 out)
echo "root CID: $CID"

# Home page — expect 200 (both before and after the fix)
curl -s -o /dev/null -w "/            -> %{http_code}\n" \
  "http://127.0.0.1:8080/ipfs/$CID/"

# Route directory — expect 200 AFTER the fix, 404 BEFORE it
curl -s -o /dev/null -w "/debug/      -> %{http_code}\n" \
  "http://127.0.0.1:8080/ipfs/$CID/debug/"

# No trailing slash — Kubo 301-redirects to /debug/ once the dir exists
curl -s -o /dev/null -w "/debug       -> %{http_code}\n" \
  "http://127.0.0.1:8080/ipfs/$CID/debug"
```

Before the fix, `/debug/` returns `404`; after, you get `200` for `/debug/` and
a `301` (→ `/debug/`) for `/debug`.

### Option B — no IPFS node: a strict static server that mimics the gateway

Python's `http.server` shares the two behaviors that matter here — it serves
`index.html` for directory requests and 404s on missing exact paths — so it's a
good local proxy:

```bash
( cd out && python3 -m http.server 8000 ) &

curl -s -o /dev/null -w "/            -> %{http_code}\n" http://localhost:8000/
curl -s -o /dev/null -w "/debug/      -> %{http_code}\n" http://localhost:8000/debug/
curl -s -o /dev/null -w "/debug       -> %{http_code}\n" http://localhost:8000/debug
```

After the fix: `/` → 200, `/debug/` → 200, `/debug` → 301 (redirect to
`/debug/`). Before the fix `/debug/` and `/debug` both 404, matching the gateway.

> Note: avoid `npx serve out` as your test — `serve` *does* silently rewrite
> `/debug` → `debug.html`, so it will report success on the broken tree and hide
> the exact bug you're trying to catch.

### Quick structural sanity check (no server at all)

```bash
find out -name index.html
# broken tree: only  out/index.html
# fixed tree:  out/index.html, out/debug/index.html, out/blockexplorer/index.html, ...

test -f out/debug/index.html && echo "OK: /debug reachable" || echo "MISSING"
```

Once `out/debug/index.html` exists and the gateway/strict-server checks return
200 for `/debug/`, re-upload `out/` and re-pin the new CID.
