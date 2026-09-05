# Why `/debug` 404s on an IPFS gateway (and `/` doesn't)

## 1. The gateway mechanics

An IPFS gateway is not a web server with a router. It is a **path resolver over a
UnixFS DAG**. When you request `https://gateway/ipfs/<CID>/debug`, the gateway:

1. Loads the directory node for `<CID>`.
2. Splits the remaining path into segments (`["debug"]`).
3. For each segment, looks for a **link with exactly that name** in the current
   directory node.

Your root directory node has exactly these links:

```
index.html
debug.html
404.html
_next
```

There is no link named `debug`. Resolution fails at step 3, and the gateway
returns `404 Not Found`. That is the whole story — the file `debug.html` is
present and pinned, but nothing in the gateway will ever try `debug + ".html"`.

This is what makes IPFS different from the static hosts you may be used to.
Netlify, Cloudflare Pages, S3 website endpoints and `serve` all implement
**extension fallback**: `/debug` misses, so they retry `/debug.html` and it
works. Gateways implement no such rule. Two consequences follow:

- **No `.html` fallback.** `/debug` never becomes `debug.html`.
- **No SPA fallback.** There is no server-side rewrite of unknown paths to
  `index.html`, so the Next.js client router never gets a chance to take over.
  `404.html` is not consulted either — to a gateway it is just a file that
  happens to be named `404.html`. It is served with `200` if you request
  `/404.html` directly, and it is ignored entirely for a failed lookup.

### Why the home page still works

The one implicit rule gateways *do* implement is the **directory index
convention**: if a path resolves to a directory, the gateway serves that
directory's `index.html` child if one exists (otherwise it renders a directory
listing).

`https://gateway/ipfs/<CID>/` resolves to the root directory, so the gateway
serves `<CID>/index.html` → `200`. The home page works for exactly the same
reason every other route fails: the root is a *directory* with an `index.html`,
while `/debug` is a *name that doesn't exist*.

The related behaviour that makes the fix work: when a path resolves to a
directory and the request URL has no trailing slash, the gateway answers
`301` to the same path *with* a trailing slash, then serves the index. So once
`debug/` exists as a directory, both `/debug` and `/debug/` land on the page
(the first via one redirect — remember `curl -L`).

### Why this passed local testing

Two things hide the bug until you hit the gateway:

- `next start` / `next dev` and most local static servers do extension fallback,
  so `/debug` worked on your machine.
- On the deployed site, clicking a `<Link>` from the home page still works,
  because that is a client-side route transition — no HTTP request for `/debug`
  is made. It only breaks on a hard load, a refresh, or a shared deep link.

### One adjacent gotcha

If you are testing on a **path** gateway (`https://gw/ipfs/<CID>/…`) rather than
a subdomain gateway (`https://<cid>.ipfs.gw/…`), note that Next's emitted asset
URLs are root-absolute (`/_next/static/…`), which resolve to the gateway root
rather than to your CID. Prefer the subdomain form (or your `.eth.link` domain)
when verifying — it gives your site its own origin, so absolute paths resolve
correctly. Origin isolation is also what enables gateway support for a
`_redirects` file, if you ever want a custom 404 page or SPA rewrites.

## 2. The `next.config` change

The fix is `trailingSlash: true`. It changes what Next.js *emits*:

- `trailingSlash: false` (the default) → `out/debug.html`
- `trailingSlash: true` → `out/debug/index.html`

The second form turns every route into a directory, which is precisely the shape
the gateway's directory-index rule knows how to serve.

```typescript
// packages/nextjs/next.config.ts
const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";        // emit static HTML, no server
  nextConfig.trailingSlash = true;     // debug/index.html, not debug.html  ← the fix
  nextConfig.images = { unoptimized: true }; // no image optimizer at runtime
}
```

Gating on `NEXT_PUBLIC_IPFS_BUILD` keeps local dev on normal Next.js behaviour
and applies the export settings only to the IPFS build.

Two things to check alongside it, because they produce the *same* 404 symptom
from a different cause:

- **`output: "export"`** must be set, or there are no static HTML files to
  resolve in the first place.
- **Every page must survive prerendering.** A page that throws during
  `yarn build` is skipped, and a skipped page is a missing directory, which is
  another gateway 404. In SE2 the usual offender is the block explorer, which
  touches `localStorage` at import time; rename `app/blockexplorer` to
  `app/_blockexplorer-disabled` if you don't need it. On Node 25 the same class
  of crash hits every page, and needs `NODE_OPTIONS="--no-experimental-webstorage"`
  so the fix reaches the prerender workers.

## 3. What `out/` looks like after the change

Before:

```
out/index.html
out/debug.html
out/404.html
out/_next/...
```

After:

```
out/index.html            # "/"      → root dir index          ✅ (unchanged)
out/debug/index.html      # "/debug" → 301 /debug/ → index.html ✅
out/404.html              # still top-level; cosmetic on IPFS
out/_next/...
```

Every route is now a directory containing `index.html`. `index.html` stays at the
root because `/` was already the directory-index case. `404.html` remains at the
top level — it is the error-document convention for hosts that support one, and
gateways don't, so it does no harm and does no work.

## 4. Verifying from the command line before re-uploading

**Always rebuild from clean first** — deploying a stale `out/` is the most common
way this "fix" appears not to work:

```bash
cd packages/nextjs
rm -rf .next out
NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  NODE_OPTIONS="--no-experimental-webstorage" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

### a. Check the file layout

```bash
ls out/*/index.html                 # one line per route directory
find out -name '*.html' -not -path 'out/_next/*'
```

You want `out/debug/index.html` to exist and `out/debug.html` to be gone. If a
route you expect is missing, it was skipped during prerender — read the build log
for `Error occurred prerendering page "/…"` rather than re-uploading.

### b. Confirm the build is not stale

```bash
stat -c '%y' app/page.tsx
stat -c '%y' out/
# out/ must be NEWER than your sources
```

### c. Simulate gateway semantics locally

Python's `http.server` is a good stand-in: it serves `index.html` for
directories and does **not** do extension fallback — the same two rules the
gateway follows.

```bash
(cd out && python3 -m http.server 8000) &
curl -s -o /dev/null -w '%{http_code}\n' -L http://127.0.0.1:8000/
curl -s -o /dev/null -w '%{http_code}\n' -L http://127.0.0.1:8000/debug/
curl -s -o /dev/null -w '%{http_code}\n' -L http://127.0.0.1:8000/debug
# expect 200, 200, 200 — before the fix the last two were 404
```

Do not use `npx serve out` for this check: it does extension fallback, so
`/debug` returns 200 even with the broken layout.

### d. Optional: test a real gateway locally

If you have Kubo, you can resolve against actual gateway code without publishing:

```bash
CID=$(ipfs add -rQ out)
curl -s -o /dev/null -w '%{http_code}\n' -L "http://127.0.0.1:8080/ipfs/$CID/debug/"
```

### e. After upload

```bash
yarn bgipfs upload out              # save the CID
curl -s -o /dev/null -w '%{http_code}\n' -L "https://community.bgipfs.com/ipfs/<CID>/debug/"
```

`-L` matters: the first hop for a slashless URL is the gateway's `301` to the
directory form. A `200` here is the real confirmation; only then set the ENS
content hash.
