# Why `/debug` 404s on the IPFS gateway (and `/` doesn't)

## TL;DR

Your export writes routes as **sibling `.html` files** (`out/debug.html`), but
an IPFS gateway resolves a URL path as a **walk through UnixFS directory
entries** and never appends `.html`. There is no entry named `debug` in the
root directory, so `/debug` is a hard 404. The home page works only because
`/` lands on a directory and gateways have a built-in "serve `index.html` for a
directory" rule. Fix it by setting `trailingSlash: true` so every route is
exported as `route/index.html`, which the gateway *can* resolve.

---

## 1. The gateway mechanics that turn this layout into 404s

When you `ipfs add -r out`, the directory becomes a UnixFS DAG. The **root
directory** is just a listing that maps names → CIDs:

```
<root CID> (a UnixFS directory)
├── index.html   -> CID
├── debug.html   -> CID
├── 404.html     -> CID
└── _next        -> CID (another directory)
```

A request to `https://<gateway>/ipfs/<root CID>/debug` is resolved by the
gateway like this:

1. Start at the root directory node.
2. Split the path into segments: `["debug"]`.
3. Look for a **child entry literally named `debug`** in the directory listing.
4. There is no such entry. The listing only contains `index.html`,
   `debug.html`, `404.html`, and `_next`. → **404 / not found.**

The two things that trip people up:

- **Gateways do no extension fallback.** Next.js's own Node server (and Vercel)
  rewrite `/debug` → `/debug.html` for you. A plain IPFS/IPFS-http gateway does
  not. It matches path segments against directory-entry names *exactly*.
  `debug.html` is only reachable at the literal path `/debug.html` — not the
  URL your app's `<Link href="/debug">` actually navigates to.
- **The only implicit rewrite a gateway does is the directory index.** If a
  path resolves to a *directory* node, the gateway looks inside it for an
  `index.html` entry and serves that (this is the same convention as
  Apache/nginx `index.html`, and it's what `DirIndex`/`_redirects`-free
  gateways do by default).

### Why the home page still works

`/` resolves to the **root directory node itself**. Because that target is a
directory, the gateway applies the directory-index rule, finds the `index.html`
entry in the listing, and serves it. So `/` → `index.html` succeeds for exactly
the same reason `/debug` fails: `index.html` is reachable via the directory
convention, while `debug.html` is a bare file whose name never matches the
segment `debug`.

(`404.html` has the same problem — some pinning services, e.g. Fleek, are
configured to serve a root `404.html` on not-found, but that's a
provider-specific nicety, not core gateway behavior.)

---

## 2. The `next.config` change that fixes it

Add **`trailingSlash: true`** to the export config. Scaffold-ETH 2 already
exports statically, so the relevant file (`packages/nextjs/next.config.js` or
`next.config.mjs`) should look like:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",     // static HTML export -> out/ (already set in SE-2)
  trailingSlash: true,  // <-- the fix: emit route/index.html, not route.html
  images: { unoptimized: true }, // required for static export; SE-2 sets this
  // ...rest of your SE-2 config
};

module.exports = nextConfig;
```

`trailingSlash: true` tells Next to treat every route as a directory:
instead of writing `out/debug.html`, it writes `out/debug/index.html`, and it
generates internal links/redirects with the trailing slash (`/debug/`). That
directory form is exactly what the gateway's directory-index rule can resolve.

Rebuild after changing it:

```bash
yarn next:build          # or: cd packages/nextjs && next build
```

---

## 3. What `out/` looks like after the change

Each page becomes a folder with an `index.html` inside it:

```
out/
├── index.html              # "/"          -> directory index of root
├── debug/
│   └── index.html          # "/debug/"    -> directory index of out/debug
├── 404.html                # still a bare file (Next keeps this special page)
└── _next/
    └── ...                 # unchanged JS/CSS/chunk assets
```

Now the gateway can resolve `/debug`:

1. Path segments `["debug"]`.
2. Root listing has an entry named `debug` → it's a **directory**.
3. Directory → apply index rule → serve `out/debug/index.html`. ✅

Any additional routes get the same treatment
(e.g. `out/blockexplorer/index.html`, `out/blockexplorer/address/[.../index.html]`).

---

## 4. Verifying the routes from the command line before re-uploading

You want to confirm resolution using something that mimics the gateway's
**exact-match + directory-index, no-`.html`-fallback** behavior. Two levels:

### a. Confirm the file layout

```bash
find out -name index.html
# expect: out/index.html AND out/debug/index.html (not out/debug.html)

# quick negative check — this should print nothing after the fix:
find out -name '*.html' -maxdepth 1 -name 'debug.html'
```

### b. Serve it the way a gateway would

Python's `http.server` is a good stand-in: it serves `index.html` for a
directory and does **not** invent a `.html` extension — the same two rules the
gateway uses.

```bash
python3 -m http.server 8080 --directory out
```

In another shell (`-L` follows the 301 that adds the trailing slash):

```bash
curl -sIL http://localhost:8080/          | head -n1   # 200 (home)
curl -sIL http://localhost:8080/debug/    | head -n1   # 200 after fix
curl -sIL http://localhost:8080/debug     | head -n1   # 200 (redirects to /debug/)
```

Before the fix, `/debug` and `/debug/` return **404** here — reproducing the
gateway failure locally. After the fix they return **200**.

### c. (Best) Test against a real IPFS resolver

If you have IPFS installed, add the directory and hit your local gateway with
the actual CID so you're testing genuine UnixFS path resolution:

```bash
CID=$(ipfs add -rQ --cid-version 1 out)   # -Q = quiet, prints only the root CID
ipfs daemon >/dev/null 2>&1 &             # if not already running

curl -sI "http://127.0.0.1:8080/ipfs/$CID/"        | head -n1   # 200
curl -sI "http://127.0.0.1:8080/ipfs/$CID/debug/"  | head -n1   # 200 after fix
curl -sI "http://127.0.0.1:8080/ipfs/$CID/debug"   | head -n1   # 301 -> /debug/, then 200
```

Only re-upload / re-pin once `/debug/` returns 200 in step (b) or (c). Then
share links with the trailing slash (`.../ipfs/<CID>/debug/`) so the first hit
resolves without depending on the redirect.
