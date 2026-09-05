# Why `/debug` 404s on the IPFS gateway (and `/` doesn't)

## 1. The gateway mechanics

An IPFS gateway is not a web server with a filesystem behind it. `out/` was
imported as a UnixFS DAG: the root CID is a *directory node* holding named
links to child nodes. When you request

```
https://<gateway>/ipfs/<cid>/debug
```

the gateway splits the path after the CID into segments and walks the DAG,
resolving each segment as an **exact, literal link name** in the current
directory node. The root directory of your upload contains links named:

```
index.html   debug.html   404.html   _next
```

There is no link named `debug`. The walk fails at that segment and the gateway
returns 404 — the response never gets far enough to touch `debug.html`.

The critical point is what the gateway *doesn't* do. A conventional static host
tries fallbacks: nginx `try_files $uri $uri.html $uri/index.html`, Apache
`MultiViews`, GitHub Pages, `npx serve`, and Vercel all silently append `.html`
to an extensionless request. **An IPFS gateway has no such rule.** Link names
are content-addressed identifiers, not filenames it may embellish. So the
`.html` suffix that every other host would have papered over is fatal here.

### Why the home page still works

The gateway has exactly *one* implicit-file rule, and it is not extension
guessing. When a path resolves successfully **to a directory node**, the gateway
looks inside that directory for a child link literally named `index.html` and
serves it (otherwise it renders a directory listing). Requesting `/ipfs/<cid>/`
resolves to the root directory itself — zero path segments to walk, nothing to
fail on — and the root does contain `index.html`. So `/` succeeds for a reason
that never generalises: it is the only route whose file already sits at a
directory index, because a static export always names the root document
`index.html`. Every other route is a sibling `*.html` file that nothing will
ever ask for by that name.

Two corollaries that explain why this slipped through:

- **In-app navigation hides it.** Clicking from the home page to Debug
  Contracts is a client-side Next.js router transition — no HTTP request for
  the document. Only a hard load, a refresh, or a shared deep link hits the
  gateway and 404s. Testing by clicking around from `/` will always look green.
- **`404.html` does nothing.** It is a Next/GitHub-Pages/Netlify convention.
  A path gateway serves its own error body on a failed DAG walk; it does not
  look for `404.html`. (Custom 404s and rewrites via a `_redirects` file exist
  per IPIP-290, but only when the site is served from a subdomain or DNSLink
  root, not from a `/ipfs/<cid>/` path prefix.)

## 2. The `next.config` change

In `packages/nextjs/next.config.ts`, inside the IPFS-build branch:

```typescript
if (process.env.NEXT_PUBLIC_IPFS_BUILD === "true") {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;      // <- this is the fix
  nextConfig.images = { unoptimized: true };
}
```

`trailingSlash: true` is the line that resolves the 404s. It changes the
exporter's output naming: instead of emitting one `<route>.html` file per
route, it emits `<route>/index.html`. That converts every route into a
*directory* whose index the gateway's one implicit-file rule will actually
find. The other two lines are the surrounding requirements — `output: "export"`
is what produces `out/` at all (you clearly have it), and `images:
{ unoptimized: true }` is mandatory because the default Image Optimization
pipeline needs a running server that IPFS cannot provide.

## 3. What `out/` looks like afterwards

```
out/
├── index.html                     # /
├── 404.html
├── debug/
│   └── index.html                 # /debug
├── blockexplorer/
│   └── index.html                 # /blockexplorer
└── _next/
    └── static/...
```

The rule to internalise: **one directory containing an `index.html` per route**,
and no stray top-level `*.html` files other than `index.html` and `404.html`.

Caveat for dynamic routes (e.g. SE2's block explorer address/transaction
pages): static export only emits the concrete paths that `generateStaticParams`
returns. Anything not enumerated there simply will not exist in `out/` and will
404 on the gateway for the same DAG-walk reason — that is a separate problem
from this one and `trailingSlash` will not fix it.

Rebuild from clean so no stale flat files survive:

```bash
cd packages/nextjs
rm -rf .next out
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  yarn build
```

(If the build itself crashes during prerender on Node 25 with a `localStorage`
/ `getItem` error, that is the built-in Web Storage global lacking its methods;
export `NODE_OPTIONS="--localstorage-file=.node-localstorage"` — or
`--no-experimental-webstorage` — at the process level so build workers inherit
it. Unrelated to the routing issue, but it blocks the rebuild.)

## 4. Verifying from the command line before re-uploading

### a. Check the layout

```bash
ls out/*/index.html            # expect one line per non-home route
find out -maxdepth 1 -name '*.html'   # expect ONLY index.html and 404.html
```

If `debug.html` still appears at the top level, the IPFS branch of the config
didn't run (check `NEXT_PUBLIC_IPFS_BUILD`) or `out/` wasn't cleaned.

### b. Serve locally with gateway-like semantics

Do **not** verify with `npx serve out` or any dev server: they extension-guess,
so `/debug` returns 200 even with the broken layout. That false green is what
lets this ship. Python's `http.server` matches the gateway more honestly — it
serves `index.html` for a directory and refuses to invent `.html`:

```bash
(cd out && python3 -m http.server 8080) &
for r in "" debug/ blockexplorer/; do
  printf '%-20s %s\n' "/$r" \
    "$(curl -s -o /dev/null -w '%{http_code}' -L "http://127.0.0.1:8080/$r")"
done
```

Expect `200` on every line. `-L` matters: both this server and Kubo redirect an
extensionless directory request to the trailing-slash form.

### c. Highest-fidelity check — a real local gateway

If you have Kubo, resolve through actual DAG walking before spending an upload:

```bash
CID=$(ipfs add -Q -r out)
for r in "" debug/ blockexplorer/; do
  printf '%-20s %s\n' "/$r" \
    "$(curl -s -o /dev/null -w '%{http_code}' -L "http://127.0.0.1:8080/ipfs/$CID/$r")"
done
```

This exercises exactly the resolution path that produced your 404s.

### d. While you're in there

Confirm the metadata picked up the production origin rather than localhost:

```bash
grep -o '<meta property="og:[^>]*>' out/index.html
```

### e. After re-uploading

1. Record the new CID. If it is **unchanged**, the uploaded bytes are identical
   — the rebuild or the upload target is wrong; don't blame gateway caching.
2. Re-run the route check against the public gateway, and make sure it includes
   a non-home route:

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -L "https://<gateway>/ipfs/<cid>/debug/"
   ```

   Expect `200`. A working root proves nothing about exported routes — that is
   the exact assumption that produced this bug.
3. Only once the deployed CID has been reviewed and approved, update the ENS
   content hash, then confirm the resolver and a public gateway serve that CID.

### One more thing to watch on a path gateway

Even with correct routing, `/ipfs/<cid>/debug/` on a *path* gateway serves your
app under a path prefix, while the exported HTML references assets absolutely as
`/_next/...` — which resolves to the gateway's root, not your CID's root. If
assets 404 after the routing fix, that's this second issue, and the cure is
serving from a **subdomain gateway** (`<cid>.ipfs.<gateway>`) or a DNSLink
domain, where your CID root *is* the origin root. It is not another
`next.config` change.
