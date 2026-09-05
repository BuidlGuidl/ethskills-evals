# Why every route except `/` 404s on the IPFS gateway

## 1. The gateway mechanics

An IPFS gateway is **not** a web server with rewrite rules. It is a resolver over a
UnixFS DAG. When you request:

```
https://<gateway>/ipfs/<cid>/debug
```

the gateway splits the path after the CID into segments and walks the DAG one link
at a time, matching **literal directory entry names**. It looks in the root
directory for an entry named exactly `debug`.

Your uploaded directory has these entries:

```
index.html
debug.html
404.html
_next/
```

There is no entry named `debug`. There is an entry named `debug.html`. Those are
different strings, so the link resolution fails and the gateway returns
`404 Not Found` (some gateways phrase it `ipld: could not find debug`).

Crucially, the gateway will **never** try `debug.html` on your behalf. The
extensionless-to-`.html` fallback you are used to is a server feature —
nginx's `try_files $uri $uri.html`, Vercel's filesystem handler, Netlify's
"pretty URLs", `next start`'s router. None of that exists in the IPFS path
resolver. There is exactly one piece of implicit filename resolution in the
spec, and it is the next point.

### Why the home page still works

The one convention gateways *do* implement: **if a path resolves to a
directory, serve `index.html` from inside it.**

`https://<gateway>/ipfs/<cid>/` resolves to the root directory itself. Zero path
segments to walk, resolution trivially succeeds, the result is a directory, so
the gateway looks for the `index.html` entry — which exists — and serves it.

So the home page works for a reason that has nothing to do with routing and
everything to do with the directory-index convention. That is why "the site
loads" is worthless as a deploy check, and why the playbook insists on curling a
non-home route.

### Two corollaries worth knowing

- `https://<gateway>/ipfs/<cid>/debug.html` **does** work right now. The 404 is
  purely about the name the app links to (`/debug`) not matching the name on
  disk (`debug.html`). Every in-app `<Link href="/debug">` and every hard
  refresh on a sub-route hits the broken name.
- `404.html` is dead weight. It is a Next.js/static-host convention; the gateway
  has no notion of a custom error document and serves its own error page.
  (Kubo supports a `_redirects` file for SPA-style fallbacks, but only on
  subdomain and DNSLink gateways, not on `/ipfs/<cid>/` path gateways — so it is
  not a fix you can rely on for a raw-CID deploy.)

## 2. The `next.config` change

The export needs to emit a *directory per route* so that the directory-index
convention — the only resolution the gateway performs — is the one your URLs
depend on. That is `trailingSlash`:

```typescript
// packages/nextjs/next.config.ts
if (process.env.NEXT_PUBLIC_IPFS_BUILD === "true") {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;          // <- the fix for the 404s
  nextConfig.images = { unoptimized: true };
}
```

What each line is doing:

- `output: "export"` — you already have this, or you would have no `out/` at all.
- `trailingSlash: true` — **this is the actual fix.** It changes the export
  file layout from `debug.html` to `debug/index.html`, and makes the client
  router generate `/debug/` links so in-app navigation and hard refresh agree
  with what is on the DAG.
- `images: { unoptimized: true }` — required companion. `next/image` defaults to
  the `/_next/image` optimizer endpoint, which is a server route that cannot
  exist on IPFS. Without this the build fails outright, or ships `<img>` tags
  pointing at a URL that resolves to nothing.

Also set the production origin at build time, or your OG tags will advertise
`localhost`:

```bash
cd packages/nextjs
rm -rf .next out
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  yarn build
```

The `rm -rf .next out` is not hygiene theater here. Next does not prune `out/`
between builds, so a rebuild on top of your current tree leaves the stale
`debug.html` sitting next to the new `debug/index.html`, you upload both, and
you get a CID carrying the old broken layout alongside the new one.

## 3. What `out/` looks like afterwards

Before (what you uploaded):

```
out/
├── index.html
├── debug.html
├── 404.html
└── _next/...
```

After:

```
out/
├── index.html                          # "/"  — unchanged, still the root index
├── 404.html                            # still emitted, still ignored by gateways
├── debug/
│   └── index.html                      # "/debug/"
├── blockexplorer/
│   ├── index.html                      # "/blockexplorer/"
│   └── address/
│       └── <prerendered-addr>/
│           └── index.html              # only if generateStaticParams supplies them
├── _next/
│   └── static/...
└── favicon.png, etc.
```

The rule to check by eye: **every route except `/` is a directory containing
`index.html`, and no route is a bare `<name>.html`.**

Now `/ipfs/<cid>/debug/` walks to the `debug` directory entry, finds a directory,
applies the index convention, serves `debug/index.html`. And `/ipfs/<cid>/debug`
without the slash also works — resolution succeeds (the entry `debug` exists),
the gateway sees a directory and issues a `301` to the slashed form, which then
serves. That is why `curl -L` is used below.

### One caveat about path gateways

Static export emits absolute asset paths (`/_next/static/...`). Under a **path**
gateway those resolve to `https://<gateway>/_next/...` — off the CID root — so
assets can 404 even after routes are fixed. Subdomain gateways
(`<cid>.ipfs.<gateway>`) and DNSLink/ENS domains put the CID at the origin root
and do not have this problem. If you are testing on a path gateway, check for
asset 404s separately and prefer the subdomain form for real verification.

## 4. Verifying from the command line before re-uploading

### Step 1 — assert the layout

```bash
cd packages/nextjs
ls out/*/index.html
```

You should see one line per non-home route. Then confirm nothing is still
flattened:

```bash
find out -maxdepth 1 -name '*.html' -not -name 'index.html' -not -name '404.html'
```

Expect **no output**. Any `debug.html` printed here means `trailingSlash` did not
take effect or `out/` was not cleaned.

### Step 2 — serve `out/` with a resolver that behaves like a gateway

Do not use `npx serve` for this check. `serve` performs extensionless `.html`
fallback by default, so it happily serves `/debug` from `debug.html` — it will
tell you the broken build is fine. Python's static server does directory-index
resolution and a `301` for directories, and does *not* do `.html` fallback,
which is exactly the gateway's behaviour:

```bash
(cd out && python3 -m http.server 8080) &

curl -s -o /dev/null -w "%{http_code}\n" -L http://localhost:8080/
curl -s -o /dev/null -w "%{http_code}\n" -L http://localhost:8080/debug/
curl -s -o /dev/null -w "%{http_code}\n" -L http://localhost:8080/debug     # 301 -> 200
```

All three should print `200`. Run the same against the old build and `/debug/`
prints `404` — that is the bug reproduced locally, without spending an upload.

### Step 3 — the truest pre-upload check: a local IPFS gateway

This exercises the real DAG resolver on the real bytes:

```bash
CID=$(ipfs add -rQ out)          # add locally, no pinning service involved
ipfs ls "$CID"                   # confirm a 'debug/' entry, not 'debug.html'

curl -s -o /dev/null -w "%{http_code}\n" -L "http://127.0.0.1:8080/ipfs/$CID/"
curl -s -o /dev/null -w "%{http_code}\n" -L "http://127.0.0.1:8080/ipfs/$CID/debug/"
```

If `/debug/` returns `200` here, it will return `200` on a public gateway,
because it is the same resolution algorithm over the same CID.

### Step 4 — check metadata while you are in there

```bash
grep -o '<meta property="og:[^>]*>' out/index.html
```

Confirm the origin is your production domain and not `localhost:3000`.

### Step 5 — after uploading

```bash
curl -s -o /dev/null -w "%{http_code}\n" -L "https://<gateway>/ipfs/<cid>/"
curl -s -o /dev/null -w "%{http_code}\n" -L "https://<gateway>/ipfs/<cid>/debug/"
```

Record the new CID and confirm it **changed** from the previous upload — the
layout changed, so identical bytes would mean you uploaded the stale `out/`
rather than a gateway caching issue. Only update the ENS content hash once that
CID has been reviewed and both routes return `200`.
