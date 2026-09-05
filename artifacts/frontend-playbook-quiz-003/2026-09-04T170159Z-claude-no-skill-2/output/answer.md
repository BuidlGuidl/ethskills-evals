# Static export on IPFS: why `/debug` 404s and `/` doesn't

## 1. What the gateway is actually doing

An IPFS gateway is not a web server with a filesystem behind it. When you
`ipfs add -r out`, the directory is encoded as a UnixFS DAG: each directory
becomes a node holding a list of **named links** to child nodes. Your root
node's links are exactly:

    index.html
    debug.html
    404.html
    _next

Resolving `https://<gateway>/ipfs/<CID>/debug` means: start at `<CID>`, then
walk one link **whose name is literally `debug`**. There is no such link, so
resolution fails and the gateway answers 404 — in Kubo the body reads roughly:

    failed to resolve /ipfs/bafy.../debug: no link named "debug" under bafy...

That is the whole mechanism. A gateway does **not**:

- append `.html` and retry (`debug` → `debug.html`),
- run `try_files $uri $uri.html $uri/index.html`,
- consult a router, rewrite table, or `next start` process,
- treat `404.html` as an error document — the gateway emits its *own* 404 page,
  so your styled Next.js not-found never renders.

There is exactly **one** implicit filename in the spec: if a path resolves and
lands on a UnixFS **directory** node, the gateway looks for a child link named
`index.html` and serves it (otherwise it renders a directory listing). That is
why `/` works: `/ipfs/<CID>/` terminates on the root directory node, the
`index.html` link exists, done. `/` is not special-cased as "the home page" —
it just happens to be the only path in your layout that ends on a directory.

So the layout is fine for hosts that do extension-guessing (Vercel, `next start`,
Netlify, Caddy's `try_files`), which is why it passed every local check, and
fatal on a gateway, which does none of it. Next's static export emits the flat
`page.html` layout by default precisely because it assumes such a host.

Two corollaries worth knowing:

- **Client-side navigation still works.** Clicking a `<Link>` to `/debug` never
  hits the gateway — the App Router swaps the RSC payload in the browser. The
  404 only appears on a hard load, a refresh, or a shared deep link. That is why
  this often survives QA.
- **`404.html` earns nothing on IPFS.** If you want a custom fallback you need a
  gateway-side `_redirects` file (IPIP-002), and that is only honoured on
  **subdomain and DNSLink** gateways, never on a path gateway
  (`/ipfs/<CID>/...`).

## 2. The `next.config` change

Set `trailingSlash: true` alongside the export config. In Scaffold-ETH 2 that
file is `packages/nextjs/next.config.ts`:

```ts
const nextConfig: NextConfig = {
  output: "export",          // already there for the IPFS build
  trailingSlash: true,       // <-- the fix
  images: { unoptimized: true },
  // ...rest unchanged (typescript/eslint ignores, webpack fallbacks, etc.)
};
```

`trailingSlash: true` changes the exporter's naming convention from
`route.html` to `route/index.html`, and makes `<Link>`/router hrefs carry a
trailing slash. Now `/debug/` resolves the link `debug` → a directory node →
implicit `index.html` → 200. `/debug` (no slash) also works: the gateway
resolves it to a directory and redirects to `/debug/`.

If you use SE-2's `yarn ipfs`, this belongs in the config the IPFS build reads,
not in a one-off env branch — otherwise the dev build and the shipped build
disagree about URL shape.

### Two caveats that bite right after this fix

- **Path gateways break absolute asset URLs.** Your HTML references
  `/_next/static/...`. On `https://ipfs.io/ipfs/<CID>/debug/` that resolves to
  the *gateway's* root, not the CID's — assets 404. The correct answer is to
  serve from a **subdomain gateway** (`https://<cid>.ipfs.dweb.link/debug/`) or
  DNSLink, where the CID is the origin root and absolute paths are right. Do
  *not* reach for `assetPrefix: "./"`: with `trailingSlash` every page now sits
  one directory deep, so `./_next/...` would resolve to `/debug/_next/...`. If
  your home page "loads fine" through a path gateway today, check whether it is
  actually styled or just rendering unstyled HTML.
- **Dynamic segments still 404.** Routes like
  `/blockexplorer/address/[address]` only exist for the params emitted by
  `generateStaticParams` at build time. Arbitrary addresses have no file and no
  server to generate one; they need a client-side read of `location.pathname`
  from a catch-all page, which is what SE-2 does.

## 3. `out/` after the change

```
out/
├── index.html                     # "/"      → root dir + implicit index.html
├── debug/
│   └── index.html                 # "/debug/"
├── blockexplorer/
│   ├── index.html
│   └── address/
│       └── <prerendered-param>/
│           └── index.html
├── 404.html                       # still flat; gateways ignore it anyway
├── _next/
│   ├── static/chunks/...
│   └── static/css/...
└── favicon.ico, manifest, ...
```

The signal to check for: **no top-level `debug.html`**. Every route is now a
directory whose sole entry point is `index.html`.

## 4. Verifying from the command line, before re-uploading

**a) Inspect the tree.** Fastest smoke test:

```bash
find out -name '*.html' | sort
test -e out/debug/index.html && echo OK || echo "trailingSlash not applied"
test -e out/debug.html && echo "STILL FLAT — bad"
```

**b) Don't verify with a server that cheats.** `npx serve out` enables clean
URLs and will happily serve `/debug` from `debug.html`, giving you a false pass.
Use Python's server, which does directory-`index.html` resolution and nothing
else — the same semantics as a gateway:

```bash
(cd out && python3 -m http.server 8080) &
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/debug/   # 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/debug    # 301
```

**c) Best: test through a real local gateway.** This exercises the actual link
walk:

```bash
CID=$(ipfs add -Q -r --cid-version 1 out)

ipfs ls "$CID"          # expect a `debug/` entry, NOT debug.html
ipfs ls "$CID/debug"    # expect index.html

for p in / /debug/ /blockexplorer/; do
  printf '%-20s %s\n' "$p" \
    "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8080/ipfs/$CID$p")"
done
```

Then repeat against the subdomain gateway, which is how it will really be
served — this is the run that proves the assets resolve too:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Host: $CID.ipfs.localhost" http://127.0.0.1:8080/debug/
```

**d) Confirm the assets load, not just the HTML.** A 200 on the document with
404s on every chunk still looks broken:

```bash
grep -o '"/_next/static/[^"]*"' out/debug/index.html | tr -d '"' | sort -u |
while read -r a; do
  printf '%-60s %s\n' "$a" \
    "$(curl -s -o /dev/null -w '%{http_code}' \
        -H "Host: $CID.ipfs.localhost" "http://127.0.0.1:8080$a")"
done
```

Only after every one of those is 200 should you pin and publish the new CID.
