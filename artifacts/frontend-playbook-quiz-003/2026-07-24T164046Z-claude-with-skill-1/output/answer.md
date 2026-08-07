# Why every route except `/` 404s on the IPFS gateway

## 1. The gateway mechanics

An IPFS gateway is **not a web server**. It has no routing logic, no
rewrite rules, no "try `.html` if the file is missing" fallback. It only
knows how to do two things with a path under a CID:

1. If the path resolves to a **file**, return that file's bytes.
2. If the path resolves to a **directory**, look inside that directory
   for an **`index.html`** and return it. (This is the one and only
   implicit-lookup convenience gateways provide.)

That's it. There is no rule that maps a bare path like `/debug` to a
sibling file named `debug.html`. The gateway never appends `.html`.

Now map that against your uploaded layout:

```
out/index.html      <- directory "/"  contains index.html
out/debug.html      <- a FILE literally named "debug.html"
out/404.html
out/_next/...
```

- **Request `/`** → resolves to the root directory of the CID → gateway
  finds `index.html` inside it → **200**. This is exactly rule #2, which
  is why the home page is the *one* route that works.

- **Request `/debug`** → the gateway looks for an entry named `debug`
  under the CID. There is no file called `debug` and no directory called
  `debug` — the only thing there is a file called **`debug.html`**. The
  names don't match, so nothing resolves → **404**.

- **Request `/debug.html`** (with the extension) would actually 200,
  because that file literally exists — but that's not the URL Next.js
  links to internally, and it's not what users type.

So the layout works for exactly one route (`/`) and fails for every
other route, which is precisely the symptom you're seeing. The problem
is not a bad upload or a broken gateway — it's that a directory-first
resolver was handed a flat pile of `*.html` files.

## 2. The `next.config` change that fixes it

The fix is to make Next.js emit each route as a **directory containing
`index.html`** instead of a bare `route.html` file. That is controlled
by `trailingSlash`.

- `trailingSlash: false` (the default) → `out/debug.html`
- `trailingSlash: true` → `out/debug/index.html`

With `trailingSlash: true`, a request for `/debug` resolves to the
`debug/` **directory**, and the gateway's directory→`index.html` rule
(rule #2 above) kicks in — the same rule that already makes `/` work.

You also need static export turned on in the first place. The complete
IPFS-safe block in `next.config.ts`:

```typescript
const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";      // emit static HTML instead of a server
  nextConfig.trailingSlash = true;   // emit route/index.html, not route.html  <-- the actual fix
  nextConfig.images = { unoptimized: true }; // no image-optimization server on IPFS
}
```

`output: "export"` is what produces `out/` at all; `trailingSlash: true`
is the specific line that turns `debug.html` into `debug/index.html`.

## 3. What `out/` looks like after the change

Every route becomes its own directory with an `index.html` inside:

```
out/
├── index.html              # "/"      (unchanged)
├── debug/
│   └── index.html          # "/debug" -> now resolves via the directory rule
├── 404.html
└── _next/
    └── ...
```

Compare to before:

```
out/index.html
out/debug.html      # <- the flat file the gateway couldn't route to
out/404.html
out/_next/...
```

Every additional route (`/blockexplorer`, etc.) follows the same
`route/index.html` pattern. `404.html` stays as a top-level file — that's
the conventional not-found document and doesn't need a directory.

## 4. Verify from the command line before re-uploading

**First, confirm the build shape locally — do this before you upload:**

```bash
# Every route should be a directory with an index.html.
# If this lists debug/index.html (not debug.html), the fix took.
ls out/*/index.html
```

If you still see bare `out/debug.html`, the `trailingSlash` change didn't
take effect (stale build — `rm -rf .next out` and rebuild).

**Then, after uploading, verify the live routes over the gateway:**

```bash
CID=<your-new-cid>
GATEWAY=https://community.bgipfs.com   # or any IPFS gateway

# Home page — should already have worked
curl -s -o /dev/null -w "%{http_code}\n" -L "$GATEWAY/ipfs/$CID/"

# The route that used to 404 — trailing slash matters
curl -s -o /dev/null -w "%{http_code}\n" -L "$GATEWAY/ipfs/$CID/debug/"
```

Both should print **200**. The `-L` follows redirects (a request to
`/debug` without the slash will 308-redirect to `/debug/` once trailing
slashes are on), and `-w "%{http_code}"` prints just the status so you
get a clean pass/fail.

**One more sanity check — make sure you actually uploaded new content:**
a real code/config change always produces a **new CID**. If your CID is
identical to the broken deploy's CID, you re-uploaded the stale `out/`
and nothing will have changed. Rebuild from a clean tree (`rm -rf .next
out`) and re-upload.
