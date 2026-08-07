# Why `/debug` 404s on the IPFS gateway (and how to fix it)

## The file layout

You uploaded this directory tree to IPFS:

```
out/index.html
out/debug.html
out/404.html
out/_next/...
```

When `ipfs add -r out` runs, IPFS builds a **UnixFS DAG**: the root is a
directory node whose named entries are exactly the top-level names you see —
`index.html`, `debug.html`, `404.html`, `_next` (itself a directory). The names
are literal. There is **no entry called `debug`** in that directory.

## Gateway mechanics: why `/` works but `/debug` 404s

An IPFS gateway does **content-addressed path resolution**, not filesystem-style
URL rewriting. For a request `…/ipfs/<CID>/<path>` it walks the DAG one path
segment at a time, matching each segment against a *literal* named link in the
current directory node.

**Request for `/` (the home page) → works:**

1. The path resolves to the **root directory node** itself.
2. Gateways apply a single special rule for directories: *if the resolved
   entity is a directory, look for a child literally named `index.html` and
   serve it.*
3. The root has an `index.html`, so it's served. 200.

**Request for `/debug` → 404:**

1. The gateway takes the segment `debug` and looks for a link literally named
   `debug` in the root directory.
2. The only matching-ish entries are `debug.html` and `debug/` — neither is
   named `debug`. There is **no exact match**.
3. Because `debug` isn't a directory either, the "serve `index.html`" rule
   never kicks in. The gateway has nothing to return → **404**.

The key point: the gateway will **not** silently append `.html` for you.
`/debug` and `/debug.html` are two different, unrelated paths. A Node server
(e.g. `next start`) or Vercel has rewrite middleware that maps `/debug` →
`debug.html`; a static IPFS gateway has no such layer. That rewrite is exactly
what's missing.

This is also why the default Next.js static export "works locally but 404s on
IPFS" — `next start` and most dev servers fake the clean-URL rewrite; the
gateway is honest about the raw bytes.

## The `next.config` change that fixes it

Set `trailingSlash: true` alongside your static-export config:

```js
// next.config.js  (or next.config.mjs)
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",     // you already have this — emits the static out/ dir
  trailingSlash: true,  // <-- the fix
  images: { unoptimized: true }, // required for static export if you use next/image
};

module.exports = nextConfig;
```

`trailingSlash: true` changes how Next.js *emits* each route. Instead of writing
`route.html` at the parent level, it writes `route/index.html`. Now every route
becomes a **directory containing `index.html`** — which is precisely the one
shape the gateway's directory rule knows how to serve.

It also makes the internal `<Link>`s and the router emit `/debug/` (with the
trailing slash), so client-side navigation and the URLs users copy line up with
the on-disk layout.

## What `out/` looks like after the change

```
out/index.html            # the "/" route (unchanged — root already had index.html)
out/debug/index.html      # was out/debug.html
out/404.html              # stays at root; the gateway 404 rule looks here
out/_next/...             # unchanged
```

Every page route is now `<route>/index.html`. Requesting `/debug/` resolves the
`debug` link to a **directory**, the gateway applies the `index.html` rule, and
serves `out/debug/index.html`. Requesting `/debug` (no slash) makes most
gateways issue a `301` redirect to `/debug/` (since `debug` is a directory),
which then resolves correctly.

`404.html` intentionally stays at the root — it's the gateway's conventional
"not found" document, not a normal route.

## Verify from the command line before re-uploading

Don't trust a dev server here — `next start`, `npx serve`, and similar tools do
clean-URL rewriting and will show green even when the export is broken on IPFS.
Test against IPFS itself.

First, rebuild and confirm the on-disk shape:

```bash
next build          # with output:"export", this writes ./out
find out -name index.html
# expect: out/index.html and out/debug/index.html (NOT out/debug.html)
```

Then add it to a local IPFS node (dry-run add computes the CID without pinning),
inspect the DAG, and curl your local gateway exactly as a public gateway would
resolve it:

```bash
# Get the root CID (dry run: -n computes the hash without storing/pinning)
CID=$(ipfs add -rQn --cid-version 1 out)
echo "$CID"

# Confirm 'debug' is now a DIRECTORY entry, not a .html file
ipfs ls "$CID"
# expect a line ending in 'debug/'  (with trailing slash = directory)

# To actually serve it, do a real add so the local gateway (127.0.0.1:8080) has it:
CID=$(ipfs add -rQ --cid-version 1 out)

curl -sI "http://127.0.0.1:8080/ipfs/$CID/"         # 200  (home page)
curl -sI "http://127.0.0.1:8080/ipfs/$CID/debug/"   # 200  (fixed route)
curl -sI "http://127.0.0.1:8080/ipfs/$CID/debug"    # 301 -> /debug/
```

Interpreting the results:

- `/` → **200**: home page still works.
- `/debug/` → **200**: the route that was 404ing now serves. This is the check
  that matters.
- `/debug` → **301** with `Location: .../debug/`: expected; the gateway
  redirects the slash-less form to the directory.

If you see `debug/` in `ipfs ls` and `/debug/` returns 200 locally, the export
is correct and safe to re-upload / re-pin. If `ipfs ls` still shows `debug.html`
or `/debug/` 404s, the `trailingSlash` change didn't take effect — rebuild and
re-check before uploading.
