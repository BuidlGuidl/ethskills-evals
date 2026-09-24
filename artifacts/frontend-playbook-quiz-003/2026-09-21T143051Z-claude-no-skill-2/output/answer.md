# Why `/debug` 404s on IPFS (and `/` doesn't)

## 1. Gateway mechanics

An IPFS gateway is not a web server with rewrite rules. It **walks a directory tree** (UnixFS DAG) under your root CID, one path segment at a time, matching exact names:

```
GET /ipfs/<CID>/debug
  root dir entries: index.html, debug.html, 404.html, _next
  look up entry named "debug"  -> not found  -> 404
```

- There is **no extension guessing**. Vercel, `next start`, nginx `try_files $uri $uri.html` and `serve`'s "clean URLs" all quietly map `/debug` to `debug.html`. The gateway only sees an entry called `debug.html`, never `debug`, so the lookup fails.
- **Why `/` works:** `/` resolves to the root *directory* itself. When a path ends on a directory, the gateway serves that directory's `index.html` if there is one. `out/index.html` is exactly that file, so the home page loads.
- **Why clicking a link from home "works" but refresh/deep link doesn't:** once the home page loads, Next's client router handles `<Link href="/debug">` in JS, fetching chunks from `_next/` with no new page request. A hard reload or a pasted URL asks the gateway for `/debug`, and that request 404s.
- **Why you get the gateway's 404 and not your `404.html`:** gateways don't treat `404.html` as special. Under the gateway spec they look for **`ipfs-404.html`** in the requested directory and its parents. Your `404.html` is just a normal file that nothing ever serves.

So the rule is: **every route must be a directory containing `index.html`.** Only `/` meets that today.

## 2. The next.config fix

Set `trailingSlash: true`. Next then emits `route/index.html` instead of `route.html` (and makes links `/debug/`). A static export also needs `output: "export"` and `images.unoptimized` (there is no image-optimizer server on IPFS).

SE-2's `packages/nextjs/next.config.ts` already switches these on when it builds for IPFS:

```ts
const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;   // <- the fix: debug.html -> debug/index.html
  nextConfig.images = { unoptimized: true };
}
```

Your layout (`debug.html`) shows the export ran **without** `trailingSlash`. Most likely you ran `output: "export"` by hand, or built without `NEXT_PUBLIC_IPFS_BUILD=true`. Fix it by building through `yarn ipfs` (it sets the env var), or by setting `trailingSlash: true` directly.

Optional: make your custom 404 page reachable by copying it into place after the build:

```sh
cp out/404.html out/ipfs-404.html
```

## 3. `out/` after the change

```
out/index.html
out/debug/index.html          # was out/debug.html
out/blockexplorer/index.html  # every other route, same pattern
out/404.html                  # Next's export, not used by gateways
out/ipfs-404.html             # optional copy, gateways serve this
out/_next/...
```

Now `/debug/` resolves to directory `debug` and the gateway serves its `index.html`. Bare `/debug` also works: when a browser requests a directory without the trailing slash, the gateway answers `301 → /debug/`.

## 4. Verify from the command line before re-uploading

**a) Check the file layout.** No route should be a top-level `*.html` file:

```sh
cd packages/nextjs
NEXT_PUBLIC_IPFS_BUILD=true yarn build      # or: yarn ipfs (builds and uploads)
find out -name '*.html' -not -path 'out/_next/*' | sort
# expect: out/index.html, out/debug/index.html, out/404.html ...
ls out/*.html   # should list only index.html / 404.html (/ ipfs-404.html)
```

**b) Serve it with a server that does *not* add `.html` for you** (`npx serve` does add it, so it would hide the bug). Python's static server only serves real paths plus `dir/index.html`, which is how a gateway behaves:

```sh
python3 -m http.server 8000 -d out &
for r in / /debug/ /debug; do
  printf '%-10s ' "$r"; curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:8000$r"
done
# expect: /  200, /debug/  200, /debug  301 (redirect to /debug/)
kill %1
```

Before the fix, the same loop gives `/debug/ 404` and `/debug 404`, which is the bug you're seeing.

**c) Most faithful check: a real local gateway** (Kubo, `ipfs daemon` running). Adding the folder does not publish anything by itself:

```sh
CID=$(ipfs add -r -Q --cid-version 1 out)
ipfs ls "$CID/debug"                       # must list index.html
curl -sI  "http://$CID.ipfs.localhost:8080/debug/" | head -1   # HTTP/1.1 200
curl -sI  "http://$CID.ipfs.localhost:8080/debug"  | head -1   # 301 -> /debug/
curl -s   "http://$CID.ipfs.localhost:8080/debug/" | grep -o '<title>[^<]*'
```

Use the **subdomain** form (`<cid>.ipfs.localhost` or `<cid>.ipfs.dweb.link`), not `/ipfs/<cid>/`. Next emits absolute asset URLs like `/_next/...`, and on a path gateway those resolve to the gateway's root rather than your CID.

When every route returns 200 locally, upload `out/` again and share the new CID. The old CID is immutable and will keep 404ing.
