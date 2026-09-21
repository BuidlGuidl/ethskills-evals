# Why `/debug` 404s on IPFS, and how to fix it

## Gateway mechanics

An IPFS gateway is not a web server with rewrite rules. It maps the URL path directly onto the uploaded directory tree (UnixFS DAG), one path segment at a time, by **exact link name**:

- `GET /ipfs/<cid>/debug` → the gateway looks in the root directory for an entry named exactly `debug`.
- Your root holds `index.html`, `debug.html`, `404.html`, `_next`. There's no `debug` entry. The gateway **does not guess file extensions**: it never tries `debug.html`. Hosts like Vercel, Netlify, or `next start` do that with "clean URL" rewrites, but gateways don't. Lookup fails → **404**. (If the gateway supports a `404.html`/`_redirects` fallback, you may see your own 404 page instead of the gateway's, but it's still a 404.)
- Every other route fails the same way: `foo.html` exists, `foo` doesn't.

**Why `/` works:** a request for a *directory* makes the gateway serve that directory's `index.html` (the standard directory-index convention). `/ipfs/<cid>/` is the root directory, which has `index.html` → 200.

Side effect: clicking a link from home to `/debug` *appears* to work. That's because Next's client-side router fetches the page's JS chunks from `_next/` without asking the gateway for `/debug`. A hard refresh or a shared link to `/debug` goes to the gateway and 404s.

## The fix: `trailingSlash: true`

In `packages/nextjs/next.config.ts`, inside the IPFS-build branch:

```ts
if (process.env.NEXT_PUBLIC_IPFS_BUILD === "true") {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;          // ← the fix: emit route/index.html
  nextConfig.images = { unoptimized: true };
}
```

With `trailingSlash: true`, `next export` writes each route as a **directory with its own `index.html`** instead of `route.html`. It also makes internal links point at `/debug/`.

## `out/` after the change

```
out/index.html
out/debug/index.html        ← was out/debug.html
out/404.html                (404 page stays a file; Next may also emit 404/index.html)
out/_next/...
# plus one <route>/index.html per other page, e.g. out/blockexplorer/index.html
```

Now `GET /ipfs/<cid>/debug/` finds the directory `debug`, and the directory-index rule serves `debug/index.html` → 200. A request for `/debug` without the slash hits a directory, so gateways redirect it to `/debug/` and then serve it.

## Verify from the command line before re-uploading

```bash
cd packages/nextjs
rm -rf .next out                                   # no stale debug.html left behind
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
  NEXT_PUBLIC_IPFS_BUILD=true yarn build

# 1. Layout: each route has its own directory + index.html, no flat route .html files
ls out/*/index.html                                # expect out/debug/index.html, ...
ls out/*.html                                      # expect only index.html and 404.html

# 2. Serve out/ with a dumb static server (no clean-URL rewrites, like a gateway)
python3 -m http.server 8080 -d out &
curl -s -o /dev/null -w "%{http_code}\n"    http://localhost:8080/          # 200
curl -s -o /dev/null -w "%{http_code}\n"    http://localhost:8080/debug/    # 200
curl -s -o /dev/null -w "%{http_code}\n" -L http://localhost:8080/debug     # 200 (via redirect)
kill %1

# 3. Metadata uses the production origin, not localhost
grep -o 'og:image" content="[^"]*' out/index.html
```

Optional, closest to the real thing: add to a local Kubo node and hit its gateway:

```bash
CID=$(ipfs add -r -Q --cid-version=1 out)
ipfs ls $CID                                                   # expect a "debug/" entry
curl -s -o /dev/null -w "%{http_code}\n" -L http://127.0.0.1:8080/ipfs/$CID/debug/   # 200
```

After uploading, check that the CID changed from the broken release. Then repeat the `curl … /ipfs/<cid>/debug/` check against the public gateway. `/` returning 200 doesn't prove the other routes work.
