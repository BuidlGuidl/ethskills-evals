# Why `/debug` 404s on an IPFS gateway (and `/` doesn't)

## 1. The gateway mechanics

An IPFS gateway is not a web server with a router. It resolves a path
against a **UnixFS directory tree** — the CID you uploaded is a directory
node, and each path segment is looked up as a *named link* in that node.
There is no rewrite layer, no `try_files`, no "if not found, try adding
`.html`". There are exactly two resolution rules:

1. **Exact name match.** `/ipfs/<CID>/debug.html` finds the link literally
   named `debug.html`. 
2. **Directory → `index.html`.** If a path resolves to a *directory* node,
   the gateway looks inside it for a link named `index.html` and serves
   that. This is the only implicit behaviour a gateway has.

Now apply those rules to your uploaded layout:

```
out/index.html
out/debug.html
out/404.html
out/_next/...
```

- **`/` works.** The path resolves to the root directory node itself.
  Rule 2 fires: the gateway looks for `index.html` inside it, finds
  `out/index.html`, serves it. The home page is not special-cased — it
  works *by accident of rule 2*, because the root is a directory and it
  happens to contain an `index.html`.

- **`/debug` 404s.** The gateway looks for a link literally named `debug`
  in the root directory. There isn't one. There is a link named
  `debug.html` — a *different name*. Rule 1 doesn't match (no exact
  `debug`), and rule 2 can't fire (nothing resolved, so there's no
  directory to descend into). The gateway returns 404. It will **never**
  guess the `.html` suffix; that suffix-appending is an nginx/Vercel/
  Netlify convention baked into their routing layers, and it is precisely
  the layer IPFS does not have.

- **`/debug.html` would actually work** — that's the exact-match rule. But
  no link in your app points there; Next's `<Link href="/debug">` and
  every user-typed URL use the extensionless form. So every route in the
  app is broken even though the HTML is sitting right there.

- **`out/404.html` does nothing for you either.** Serving a custom 404 body
  is another server convention. The gateway returns its own generic 404
  page and never consults that file.

The one-line version: **`/` works because the root is a directory
containing `index.html`; every other route fails because Next wrote
`debug.html` (a file) where the gateway needs `debug/` (a directory).**

## 2. The `next.config` change

The default `trailingSlash: false` is what makes Next emit `debug.html`.
Flip it to `true` and Next emits `debug/index.html` instead — which turns
each route into a *directory*, which is exactly what gateway rule 2
resolves.

In `packages/nextjs/next.config.ts`, gate the export settings on the IPFS
build flag so local dev and Vercel builds are unaffected:

```typescript
const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";        // emit static HTML, no server
  nextConfig.trailingSlash = true;     // ← THE FIX: debug/index.html
  nextConfig.images = { unoptimized: true };  // no server-side image optimizer exists
}
```

`output: "export"` you already have (you got an `out/` directory).
`trailingSlash: true` is the missing piece. `images: { unoptimized: true }`
belongs in the same block because `next/image`'s optimizer is a server
route — on a static export it would 404 the same way, just for images.

Build with the flag set:

```bash
cd packages/nextjs
rm -rf .next out            # ALWAYS clean first — stale out/ is the #1 footgun

NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  NODE_OPTIONS="--no-experimental-webstorage" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

## 3. What `out/` looks like afterwards

Before (broken):

```
out/
├── index.html
├── debug.html          ← file: gateway has no rule that reaches this from /debug
├── 404.html
└── _next/...
```

After (`trailingSlash: true`):

```
out/
├── index.html          ← still here; / still resolves via rule 2
├── debug/
│   └── index.html      ← /debug → directory → index.html ✅
├── blockexplorer/
│   └── index.html      ← (if you kept those pages)
├── 404.html
└── _next/...
```

Every route becomes a directory holding an `index.html`, so every route now
resolves the same way `/` already did. Note `index.html` stays at the root
rather than becoming `//index.html` — the root is already a directory, so
it needs no change.

## 4. Verifying from the command line *before* re-uploading

**Check the local build first — this is the cheap, fast check.** If the
directories aren't in `out/`, uploading cannot possibly fix it.

```bash
cd packages/nextjs

# Every route should appear as a directory + index.html.
ls out/*/index.html
# Expect: out/debug/index.html  (plus one line per other route)

# And no leftover bare .html route files at the top level
# (404.html is expected and fine; debug.html appearing here means the
#  flag did not take effect):
ls out/*.html

# Confirm this build is not stale — source must be OLDER than out/
stat -c '%y' app/page.tsx
stat -c '%y' out/
```

If `ls out/*/index.html` prints `No such file or directory`, the
`NEXT_PUBLIC_IPFS_BUILD=true` env var didn't reach the build, or the
config change isn't inside the `isIpfs` branch that got evaluated. Fix
that before spending an upload.

**Then, after uploading, verify against the gateway over HTTP:**

```bash
CID=<your-new-cid>
GW=https://community.bgipfs.com

for path in "" "debug/"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -L "$GW/ipfs/$CID/$path")
  echo "$code  /$path"
done
# Expect 200 for both.
```

Two details on that curl:

- **`-L` matters.** Gateways answer `/debug` (no trailing slash) with a
  301 to `/debug/`. Without `-L` you'll see the 301 and may misread it as
  a failure; with `-L` you follow it to the real 200.
- **Request the trailing-slash form** (`debug/`) to test the directory
  resolution directly, and drop the slash once to confirm the redirect
  chain also lands on 200 — that's the form users will actually type.

Finally, while you're checking the build output, confirm the OG image is
absolute and not `localhost:3000` — it's the other thing that only shows
up after deploy:

```bash
grep 'og:image' out/index.html
```

## Related gotcha worth knowing

`trailingSlash` fixes routes whose HTML *exists*. A page that **crashes
during static prerendering** never gets written at all, and 404s on IPFS
for a completely different reason — same symptom, different cause. In SE2
the usual culprit is the block explorer pages touching `localStorage` at
import time; on Node 25 the built-in `localStorage` global makes this bite
even harder (hence `NODE_OPTIONS="--no-experimental-webstorage"` in the
build command above — it must be on `NODE_OPTIONS` because Next prerenders
in child processes that a `next.config.ts` polyfill never reaches). If a
route is still 404ing after this fix, check whether its `index.html` is
actually in `out/` — if it isn't, it's a prerender failure, not a routing
one.
