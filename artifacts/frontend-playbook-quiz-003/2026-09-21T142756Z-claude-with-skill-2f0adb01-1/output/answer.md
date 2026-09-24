# Why /debug 404s on IPFS, and the fix

## 1. Gateway mechanics

An IPFS gateway is **not a web server with rewrite rules**. It only maps a URL path onto the UnixFS directory tree (the folder structure stored under your CID) and follows a few fixed rules:

1. **Exact path match.** `/ipfs/<CID>/a/b` → look up the entry named `a`, then `b` inside it. Names are matched exactly. There is **no extension guessing**: nothing adds `.html` for you.
2. **Directory → `index.html`.** If the path resolves to a *directory* and that directory contains `index.html`, the gateway serves it (usually after a redirect from `/dir` to `/dir/`).
3. **Not found → 404.** If no entry matches, the gateway returns 404. It may serve a `404.html` from the root as the error page body (newer gateways/`_redirects` support), but the status is still 404.

Now apply that to your upload:

```
out/index.html
out/debug.html
out/404.html
out/_next/...
```

- **`/` works:** the root CID *is* a directory, and it contains `index.html` → rule 2 serves it. That's the only route that happens to be shaped as "directory + index.html".
- **`/debug` fails:** the gateway looks for an entry literally named `debug`. There is `debug.html`, but no `debug`. No rule turns `debug` into `debug.html` → rule 3 → **404** (you likely saw your own `out/404.html` page, which makes it look like a Next.js 404).
- **`/debug/` fails too:** it wants a *directory* `debug/` with `index.html` inside. Doesn't exist → 404.
- `/debug.html` would actually load, but nobody links to that, and Next's client router uses `/debug`.

Why it works on `next start` / Vercel: those servers have rewrite logic ("try `path.html`"). IPFS gateways don't. Next's default `trailingSlash: false` assumes such a server exists.

(Client-side navigation from the home page via `<Link>` may appear to work, since the JS router fetches `_next` data, but a hard reload or direct link to `/debug` hits the gateway and 404s.)

## 2. The next.config fix

Set `trailingSlash: true` (with static export). In SE2's `packages/nextjs/next.config.ts`:

```ts
const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;          // <-- the fix
  nextConfig.images = { unoptimized: true };
}
```

`trailingSlash: true` makes Next emit every route as `route/index.html` instead of `route.html`, and makes all generated links point to `/route/`.

## 3. What `out/` looks like after

```
out/index.html
out/debug/index.html
out/404.html              # (with trailingSlash also out/404/index.html)
out/_next/...
```

(plus any other routes, e.g. `out/blockexplorer/index.html` — if block explorer pages crash on prerender because of `localStorage`, they are silently skipped and will 404; disable them by renaming `app/blockexplorer` → `app/_blockexplorer-disabled`.)

Now `/debug` → gateway redirects to `/debug/` → directory → `debug/index.html` → **200**.

## 4. Verify from the command line before re-uploading

Clean rebuild (stale `out/` is a common trap):

```bash
cd packages/nextjs
rm -rf .next out
NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  yarn build
```

Check the layout:

```bash
ls out/*/index.html          # expect out/debug/index.html (one per route)
ls out/*.html                # should only be index.html / 404.html — no debug.html
test -f out/debug/index.html && echo OK || echo MISSING
```

Serve `out/` with a dumb static server that, like a gateway, does **no** `.html` guessing, and curl the routes:

```bash
python3 -m http.server 8080 -d out &
curl -s -o /dev/null -w "%{http_code}\n" -L http://localhost:8080/          # 200
curl -s -o /dev/null -w "%{http_code}\n" -L http://localhost:8080/debug     # 200 (301 -> /debug/)
curl -s -o /dev/null -w "%{http_code}\n" -L http://localhost:8080/debug/    # 200
kill %1
```

(With the old layout these return 404 — same as the gateway.)

Most faithful test: add to a local IPFS node without publishing and hit its gateway:

```bash
CID=$(ipfs add -r -Q --cid-version=1 out)
curl -s -o /dev/null -w "%{http_code}\n" -L "http://127.0.0.1:8080/ipfs/$CID/debug/"   # 200
```

Then upload (`yarn bgipfs upload out`), confirm the **CID changed** vs. the broken deploy, and re-check on the public gateway:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -L "https://community.bgipfs.com/ipfs/<NEW_CID>/debug/"   # 200
```

Only then update the ENS content hash.
