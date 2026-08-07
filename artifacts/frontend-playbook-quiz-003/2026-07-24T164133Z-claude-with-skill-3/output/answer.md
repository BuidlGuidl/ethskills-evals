# Why `/debug` 404s on the IPFS gateway (and how to fix it)

## 1. The gateway mechanics that produce the 404s

An IPFS gateway is **not** a Next.js server. There is no runtime, no router, and
no rewrite engine deciding "the URL `/debug` should map to the file
`debug.html`." A gateway does exactly one thing: it takes the path after the
CID and looks for a matching entry inside the uploaded directory (a UnixFS
DAG). It resolves paths just like a plain static file server / directory tree:

- If the path resolves to a **file**, it serves that file's bytes.
- If the path resolves to a **directory**, it looks for an `index.html`
  *inside that directory* and serves it.
- If the path resolves to neither, it returns **404**.

Now map that behavior onto your uploaded layout:

```
out/index.html      <- served for "/"      because "/" is a directory -> index.html
out/debug.html      <- a FILE named "debug.html"
out/404.html
out/_next/...
```

When a user requests `/debug`:

1. The gateway looks for an entry literally named `debug` in the root directory.
2. There is **no** `debug` directory and **no** `debug` entry — the file is
   named `debug.html`, not `debug`.
3. The gateway does **not** guess extensions. It will not silently try
   `debug.html`, `debug/index.html`, or anything else. A static gateway only
   appends `index.html` when the path is a *directory*; it never appends `.html`
   to a bare path.
4. No match → it falls through to the directory's `404.html` (or a generic
   gateway 404). Either way the user sees a 404.

The same failure hits **every** route except `/`, because every non-home route
was emitted as a sibling `*.html` file (`debug.html`, `blockexplorer.html`,
etc.) rather than as a directory containing `index.html`.

### Why the home page still works

`/` is special. Requesting `/` resolves to the **root directory itself**, and
the gateway's "directory → look for `index.html`" rule kicks in. `out/index.html`
exists, so it's served. The home page works *by accident of the one rule that
already applies to it* — the exact rule that never fires for `/debug` because
`debug.html` is a file, not a directory.

So this is not a "the debug page is broken" problem. The page rendered fine at
build time; it's purely a **file-naming / path-resolution mismatch** between how
Next.js emitted the files and how a static gateway resolves URLs.

## 2. The `next.config` change that fixes it

The build already has `output: "export"` (that's why you have static `.html`
files at all). The missing piece is **`trailingSlash: true`**.

With `trailingSlash: true`, Next.js emits each route as a **directory with an
`index.html`** instead of a bare `.html` file. That converts every route into
the one shape a gateway can resolve: a directory → `index.html`.

```ts
// next.config.ts
const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

const nextConfig = {
  // ...existing config...
};

if (isIpfs) {
  nextConfig.output = "export";     // static HTML export (already needed)
  nextConfig.trailingSlash = true;  // <-- THE FIX: emit debug/index.html, not debug.html
  nextConfig.images = { unoptimized: true }; // no Image Optimization server on IPFS
}

export default nextConfig;
```

`trailingSlash: true` also makes internal links and canonical URLs point at
`/debug/` (with the slash), which is the form that resolves cleanly to
`debug/index.html` on the gateway.

> Note: you must do a **clean rebuild** (`rm -rf .next out` first). The `out/`
> directory is not surgically updated — stale `.html` files can linger and
> you'll re-upload the broken layout. A real change always produces a new CID;
> if the CID didn't change, you uploaded the old output.

## 3. What `out/` looks like after the change

Every route becomes its own directory with an `index.html`:

```
out/index.html            <- "/"        (unchanged; already worked)
out/debug/index.html      <- "/debug"   (was out/debug.html)
out/404.html
out/_next/...
```

Now the resolution works for every route:

- `/`        → root directory      → `index.html`        ✅
- `/debug`   → `debug/` directory  → `debug/index.html`  ✅ (previously 404)

No bare `debug.html` at the top level anymore — it moved into `debug/index.html`.

## 4. Verify the routes from the command line before re-uploading

**A. Confirm the on-disk layout is right (do this before uploading anything):**

```bash
cd packages/nextjs

# Each route should now be a directory containing index.html:
ls out/*/index.html
# expect: out/debug/index.html  (and any other routes)

# Sanity: the old flat file should be GONE:
ls out/debug.html 2>/dev/null && echo "STILL FLAT — rebuild!" || echo "good: no bare debug.html"

# Guard against a stale build: source must be OLDER than the output dir.
stat -f '%Sm' app/debug/page.tsx   # source mtime
stat -f '%Sm' out/                 # build mtime  (out/ should be newer)
```

If `out/debug/index.html` doesn't exist, the fix didn't take — re-check
`trailingSlash: true` and that `NEXT_PUBLIC_IPFS_BUILD=true` was set for the
build, then `rm -rf .next out` and rebuild.

**B. After uploading, confirm the gateway actually returns 200 (follow redirects):**

```bash
CID=<your-new-cid>
GATEWAY=https://community.bgipfs.com   # or any IPFS gateway

# Home (should already be 200):
curl -s -o /dev/null -w "%{http_code}\n" -L "$GATEWAY/ipfs/$CID/"

# The route that used to 404 — note the TRAILING SLASH:
curl -s -o /dev/null -w "%{http_code}\n" -L "$GATEWAY/ipfs/$CID/debug/"
# expect: 200   (was 404)
```

The `-L` follows the redirect the gateway issues from `/debug` → `/debug/`, so
`200` confirms the directory-plus-`index.html` layout resolves correctly. Once
that route returns `200` from the command line, it's safe to re-upload / point
ENS at the new CID.
