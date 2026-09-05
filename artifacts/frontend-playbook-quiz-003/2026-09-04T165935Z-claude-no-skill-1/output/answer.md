# Static export on IPFS: why `/debug` 404s and `/` doesn't

## 1. The gateway mechanics

An IPFS gateway is **not** a web server with a rewrite engine. It is a
UnixFS **path walker**. When you request:

    https://<cid>.ipfs.dweb.link/debug

the gateway takes the request path, splits it on `/`, and walks the DAG
link-by-link from the root CID. There is exactly one question at each
step: *does this directory node contain a link whose name is literally
this segment?*

Your root directory node has these links:

    index.html    debug.html    404.html    _next/

Walking `debug`:

- Is there a link named `debug`? **No.** There is a link named
  `debug.html`, which is a completely different string.
- The walk fails immediately. Kubo/boxo returns HTTP 404 with a body
  like:

      ipfs resolve -r /ipfs/<cid>/debug: no link named "debug" under <cid>

The critical thing: **the gateway never tries appending `.html`.** That
"clean URL" behavior is a convention implemented by Vercel, Netlify,
`nginx try_files $uri $uri.html`, GitHub Pages, `npx serve`, etc. It is a
server-side feature, not a property of the files. IPFS has no such rule
and no config file where you could add one. The bytes you uploaded are
the whole contract.

### Why `/` still works

There is exactly **one** implicit behavior in the gateway spec, and it is
directory-scoped, not extension-scoped:

> If the resolved path terminates at a **directory** node, look for a
> child link named `index.html` and serve that. Otherwise render a
> directory listing.

Requesting `/` resolves to the root directory node — a successful walk of
zero segments. The gateway then applies the index rule, finds
`index.html`, and serves it. That is the *only* reason the home page
works. It is not "the gateway found the home route"; it's "the gateway
found a directory and applied its one fallback."

Two corollaries worth internalizing:

- `https://<cid>.ipfs.dweb.link/debug.html` **does work right now.** Try
  it — it will confirm the diagnosis in one request. The file is there;
  the name you're asking for is wrong.
- Directory paths without a trailing slash get a `301` to the same path
  *with* a trailing slash (so relative URLs inside the page resolve
  correctly). So `/debug` → `301 /debug/` → `index.html`. Follow
  redirects when testing (`curl -L`).

### Why `404.html` is dead weight

Next emits `404.html` for hosts that honor a conventional error page.
Gateways don't. They render their own error page and never look for
`404.html`. It costs you nothing to ship, but it will never be served.

(The one escape hatch is a `_redirects` file at the export root —
IPIP-002. It only takes effect when the site is served at an **origin
root**: a subdomain gateway `<cid>.ipfs.dweb.link` or a DNSLink domain.
It is ignored on path gateways like `ipfs.io/ipfs/<cid>/...`. See §5.)

### A symptom that confirms this

If you load `/` and *click* the Debug Contracts link, it works. If you
then hit refresh, you get a 404. That's because clicking is client-side
routing handled entirely in the browser by the Next router — no gateway
request is made for the route. Refresh, deep-link, or "copy link and
paste in a new tab" issues a real HTTP request, hits the path walk, and
dies. Same for every route except `/`.

## 2. The fix: `trailingSlash: true`

You need Next to emit each route as a **directory containing
`index.html`**, so that the gateway's one fallback rule catches every
route the same way it currently catches the home page.

In `packages/nextjs/next.config.ts` (older Scaffold-ETH 2 uses
`next.config.js` — same keys either way):

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",        // you already have this, or the export wouldn't exist
  trailingSlash: true,     // <-- the fix
  images: { unoptimized: true }, // required with output: "export"

  reactStrictMode: true,
  typescript: { ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true" },
  eslint: { ignoreDuringBuilds: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true" },
  webpack: config => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
```

If your config gates `output: "export"` behind an env flag (some SE-2
setups do this so `yarn start` stays dynamic), put `trailingSlash` right
next to it. Setting it unconditionally is fine and arguably better — it
keeps dev and the IPFS build resolving URLs identically, so you don't
discover this class of bug only after uploading.

`trailingSlash: true` does two jobs, and you need both:

1. **Emit side** — writes `out/debug/index.html` instead of
   `out/debug.html`.
2. **Link side** — `next/link` and the router now generate `/debug/`
   hrefs. Without this, your own in-app links would point at `/debug`,
   the gateway would 301 to `/debug/`, and you'd eat an extra round trip
   on every navigation (and inconsistent canonical URLs).

Then rebuild — the fix is in the emitted layout, so a stale `out/` will
reproduce the bug exactly:

```bash
cd packages/nextjs
rm -rf .next out
yarn build            # or: yarn ipfs, which builds then uploads
```

## 3. What `out/` looks like afterward

Before:

    out/
    ├── index.html
    ├── debug.html
    ├── 404.html
    └── _next/...

After:

    out/
    ├── index.html                    # "/"  — unchanged, still the root index
    ├── debug/
    │   └── index.html                # "/debug/"
    ├── blockexplorer/
    │   └── index.html                # "/blockexplorer/"
    ├── 404.html                      # still emitted, still never served by a gateway
    └── _next/
        └── static/...

Every route is now a directory whose only job is to hold an
`index.html`. Each one is reachable by the same mechanism that already
makes `/` work: walk to a directory, apply the index rule. The home page
behavior didn't change — the other routes were promoted to match it.

Depending on your Next version you may also see `out/404/index.html`
alongside `out/404.html`; harmless either way.

## 4. Verifying from the command line before re-uploading

### 4a. Check the layout (instant, no server)

The whole fix is structural, so you can assert it directly:

```bash
cd packages/nextjs
find out -name '*.html' -not -path 'out/_next/*' | sort
```

You want to see `out/debug/index.html`. If you see a top-level
`out/debug.html`, the config change didn't take effect — you're looking
at a stale build.

A hard failure check you can drop in CI:

```bash
# Any non-index .html at the top level is a route the gateway can't reach
find out -maxdepth 1 -name '*.html' ! -name 'index.html' ! -name '404.html'
```

Empty output = good.

### 4b. Serve it with gateway-like semantics

**Do not test with `npx serve out` or `npx http-server out`.** Both
implement extensionless `.html` fallback, so they will happily serve
`/debug` from `debug.html` and tell you the broken build is fine. They
mask exactly the bug you're hunting.

Python's stdlib server is a good stand-in: it serves `index.html` for
directories, 301-redirects directories to a trailing slash, and does
**no** extension fallback — the same three behaviors that matter here.

```bash
python3 -m http.server 8000 --directory out
```

In another shell:

```bash
curl -sS -o /dev/null -w '%{http_code} %{url_effective}\n' -L http://127.0.0.1:8000/
curl -sS -o /dev/null -w '%{http_code} %{url_effective}\n' -L http://127.0.0.1:8000/debug
curl -sS -o /dev/null -w '%{http_code} %{url_effective}\n' -L http://127.0.0.1:8000/debug/
```

All three should end in `200`. Run the same three against the *old*
build and `/debug` gives you `404` — that's your before/after proof.

### 4c. Authoritative check: a real gateway

This is the one that actually settles it, because it exercises the real
DAG walk:

```bash
ipfs daemon &                                  # local gateway on :8080
CID=$(ipfs add -r -Q --cid-version 1 out)
echo "$CID"

# Inspect the root node's link names — the bug is visible here directly
ipfs ls "$CID"
```

`ipfs ls` prints the literal link names. You should see a `debug/` entry,
not `debug.html`. That listing *is* the thing the gateway walks.

Then hit the routes:

```bash
for p in "" debug debug/ blockexplorer/; do
  printf '%-16s ' "/$p"
  curl -sS -o /dev/null -w '%{http_code}\n' -L "http://127.0.0.1:8080/ipfs/$CID/$p"
done
```

For the closest match to production, test through the subdomain gateway
form too, since that's what `dweb.link` / `<cid>.ipfs.` URLs use and it's
where origin-root behavior (absolute asset paths, `_redirects`) differs:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -L \
  --resolve "$CID.ipfs.localhost:8080:127.0.0.1" \
  "http://$CID.ipfs.localhost:8080/debug/"
```

Only after all of these return 200 should you re-upload.

## 5. Two adjacent traps, since you're already here

**Path gateways will break your assets.** Next emits absolute asset URLs
(`/_next/static/...`). Under a subdomain or DNSLink gateway the app is at
the origin root, so those resolve correctly — which is consistent with
your home page rendering fine. Under a *path* gateway
(`https://ipfs.io/ipfs/<cid>/`) the app root is not the origin root, so
`/_next/static/...` resolves to `https://ipfs.io/_next/static/...` and
every script and stylesheet 404s. If you need path-gateway support,
distribute the subdomain/DNSLink URL, or serve via a DNSLink domain.
Prefer that over trying to make the export fully relative — the App
Router does not support a relative `assetPrefix` cleanly.

**Dynamic routes are a separate problem `trailingSlash` does not solve.**
Scaffold-ETH 2 ships `/blockexplorer/address/[address]` and
`/blockexplorer/transaction/[txHash]`. A static export can only emit
pages it can enumerate at build time via `generateStaticParams`, and you
cannot enumerate every address. So those URLs will 404 on a gateway no
matter what — there is no file to walk to. Options:

- Accept it; reach those pages only through client-side navigation from
  an already-loaded page.
- Add a `_redirects` file to the export root with an SPA-style rewrite:

      /blockexplorer/address/*  /blockexplorer/address/index.html  200

  and a `generateStaticParams` returning at least one param so the shell
  page exists, with the component reading the address from
  `window.location` on the client. Remember this only works on subdomain
  or DNSLink gateways (§1).

## Summary

| | Before | After |
|---|---|---|
| File for `/debug` | `out/debug.html` | `out/debug/index.html` |
| Gateway walks `debug` | no link named `debug` → 404 | resolves to a directory |
| Then | — | index rule serves `index.html` → 200 |
| `/` | already a directory + index → 200 | unchanged |

One line of config: `trailingSlash: true`. The reason it works is that it
makes every route reach the gateway's single fallback rule — the same
rule that has been quietly carrying your home page all along.
