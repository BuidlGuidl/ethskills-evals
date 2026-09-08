# Static export to IPFS: why every route but `/` 404s

## 1. What the gateway is actually doing

An IPFS gateway is not a web server with rewrite rules. It is a **path resolver over a
UnixFS DAG**. When you `ipfs add -r out/`, the directory becomes a DAG node whose links are
literal names:

```
<root CID>
├── index.html
├── debug.html
├── 404.html
└── _next/   (directory node)
```

A request for `https://<gw>/ipfs/<CID>/debug` is resolved segment by segment: take the root
node, look for a link **named exactly `debug`**. There is no such link — the link is named
`debug.html`. Resolution fails, and the gateway returns `404 Not Found` (kubo reports
something like `failed to resolve /ipfs/<CID>/debug: no link named "debug" under <CID>`).

The critical point: **a gateway never tries `$uri.html`.** That extensionless fallback is a
convention of Vercel, Netlify, GitHub Pages, and `nginx try_files $uri $uri.html`, and it is
exactly what masks this bug in every environment you tested before IPFS. Content addressing
has no rewrite layer to hang that convention on — the name in the DAG is the name in the URL.

`/debug/` (with the slash) fails for the same reason, one step earlier: `debug` still isn't a
link, so there's nothing to descend into.

### Why `/` still works

There is exactly one filename convention the gateway does implement: **directory index
resolution**. When a resolved path lands on a *directory* node, the gateway looks for a child
link named `index.html` and serves it. (Otherwise it renders the HTML directory listing you've
probably seen.)

`/` resolves to the root directory node → gateway finds `index.html` → 200. Your home page
works by accident of that one rule, not because static export is working. Every other route
is a sibling `*.html` file that no URL will ever name.

`404.html` is inert here for the same reason. Next.js emits it for hosts that map "not found"
to that file; the gateway has no such mapping and serves its own error page.

## 2. The fix: `trailingSlash: true`

Make the export emit each route as a **directory containing `index.html`**, so it lands on the
one rule the gateway does honor.

In `packages/nextjs/next.config.ts` (or `.js`/`.mjs`, depending on your Scaffold-ETH 2 vintage):

```ts
const nextConfig = {
  output: "export",       // static export; you already have this or out/ wouldn't exist
  trailingSlash: true,    // <-- the fix: route/index.html instead of route.html
  images: { unoptimized: true },  // required for export; the optimizer needs a server

  // ...keep your existing SE-2 settings (reactStrictMode, the webpack fallbacks for
  // fs/net/tls, the pino-pretty/lokijs/encoding externals, typescript/eslint ignores).
};

export default nextConfig;
```

`trailingSlash: true` does two things at once:

1. **Export shape** — the file emitter writes `out/debug/index.html` rather than `out/debug.html`.
2. **Link shape** — `next/link` and the client router generate `/debug/` hrefs, so the URLs
   your app produces match the URLs the gateway can resolve. Without this, an in-app
   navigation to `/debug` would work (client-side routing, no network fetch) but a hard reload
   or shared link would 404 — the confusing half-broken state.

If your SE-2 version gates the export behind an env flag (the `yarn ipfs` build path sets
something like `NEXT_PUBLIC_IPFS_BUILD`), set `trailingSlash` unconditionally anyway. It is
harmless on Vercel and it keeps the two builds from diverging in ways you only discover on the
gateway.

## 3. What `out/` looks like afterwards

```
out/
├── index.html               # /            → directory index of the root
├── debug/
│   └── index.html           # /debug/      → directory index of debug/
├── blockexplorer/
│   └── index.html           # /blockexplorer/
├── 404.html                 # still emitted; still not used by the gateway
└── _next/
    ├── static/chunks/...
    └── static/css/...
```

Every route is now a directory whose name matches the URL segment, terminating in the
`index.html` the gateway knows to look for. The `_next/` leading underscore is fine — that's a
Jekyll/GitHub Pages restriction, not an IPFS one.

**Dynamic segments still need enumerating.** SE-2's block explorer has a route like
`blockexplorer/address/[address]`. Static export only writes the params returned by that
route's `generateStaticParams`, so you'll get `blockexplorer/address/<enumerated>/index.html`
and nothing else. Any address not in that list 404s at the gateway no matter what
`trailingSlash` does — those pages have to fetch their data client-side from a single
statically exported shell.

## 4. Verifying from the command line, before you re-upload

### Step 1 — check the shape of `out/`

```bash
find out -name '*.html' | sort
```

You want to see `out/debug/index.html`. If you still see `out/debug.html`, the config change
didn't take — check that you rebuilt and that you edited the config the build actually loads
(`packages/nextjs/`, not the repo root).

### Step 2 — serve it with a *deliberately dumb* server

This is the step that matters most, and it's where the original bug hid. **Do not verify with
`npx serve out`** — `serve` does extensionless `.html` fallback by default, so it happily
serves `/debug` from `debug.html` and reports 200 for a tree the gateway will reject.

Python's `http.server` has the same two behaviors as a gateway and no others: directory-index
resolution, and no `.html` fallback.

```bash
cd out && python3 -m http.server 8000
```

In another shell:

```bash
for p in / /debug/ /debug /blockexplorer/; do
  printf '%-18s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:8000$p")"
done
```

Expected after the fix:

```
/                  200
/debug/            200
/debug             301   # http.server redirects to /debug/, which is 200 — fine
/blockexplorer/    200
```

Before the fix, `/debug/` and `/debug` both return 404 here — reproducing the gateway failure
locally in about ten seconds.

### Step 3 — verify against a real gateway

If you have kubo locally, this is the ground truth:

```bash
CID=$(ipfs add -rQ --cid-version 1 out)
echo "$CID"

ipfs ls "/ipfs/$CID"                       # confirm 'debug/' is a directory link
ipfs resolve -r "/ipfs/$CID/debug/index.html"   # must resolve, not error

for p in / /debug/ /blockexplorer/; do
  printf '%-18s %s\n' "$p" \
    "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8080/ipfs/$CID$p")"
done
```

All 200s means the DAG is shaped correctly and the routes are reachable by name.

## 5. One adjacent trap you'll hit next: asset paths

`trailingSlash` fixes routing. It does not fix asset loading on a **path gateway**.

Your HTML references bundles as `/_next/static/...` (root-absolute). On
`https://ipfs.io/ipfs/<CID>/debug/`, the browser resolves that to
`https://ipfs.io/_next/static/...` — the gateway root, not your CID — and you get an unstyled
page with dead JS while the HTML itself returns 200.

The clean fix is to serve from an **origin-isolated root**, where `/` really is your app:

- a subdomain gateway: `https://<cidv1>.ipfs.dweb.link/debug/`
- or DNSLink / ENS on your own domain

That's also why `ipfs add --cid-version 1` above matters: subdomain gateways need a
case-insensitive base32 CIDv1, and a CIDv0 will just get converted (or rejected) on you.

Setting `assetPrefix: "./"` is the tempting alternative, but it interacts badly with
`trailingSlash` — relative prefixes resolve against each route's own directory depth, so
nested routes reach for the wrong path. Prefer the subdomain/DNSLink route.

If you specifically need a custom 404 or SPA-style fallback, gateways honor an IPIP-002
`_redirects` file placed at the export root (`packages/nextjs/public/_redirects`, which Next
copies to `out/_redirects`) — but, same as above, **only** when served from an origin-isolated
root. It is ignored on path gateways.

## Summary

| | |
|---|---|
| **Cause** | Gateways resolve URL segments to literal UnixFS link names. `/debug` looks for a link named `debug`; the export produced `debug.html`. No gateway does `$uri.html` fallback. |
| **Why `/` works** | The one filename convention gateways implement is directory-index: a path landing on a directory serves its `index.html` child. |
| **Fix** | `trailingSlash: true` in `next.config` (alongside `output: "export"`), then rebuild. |
| **Result** | `out/debug/index.html` — a directory named `debug`, which the index rule resolves. |
| **Verify** | `python3 -m http.server` in `out/` (never `npx serve` — its `.html` fallback hides the bug), then `ipfs add -rQ --cid-version 1 out` and curl the local gateway. |
