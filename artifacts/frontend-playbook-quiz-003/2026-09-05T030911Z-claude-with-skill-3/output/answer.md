# Why every route except `/` 404s on the IPFS gateway

## 1. The gateway mechanics

An IPFS gateway is not a server framework. There is no router, no rewrite
engine, no "try `$path.html` before giving up" fallback. It resolves a path
against a UnixFS DAG — a directory tree — and applies exactly one convenience
rule:

> **If the resolved path is a directory, serve the `index.html` entry inside
> it.** If the resolved path names no entry at all, return 404.

That single rule is the whole story, and it explains both halves of your
symptom.

Your uploaded directory is:

```
out/index.html
out/debug.html
out/404.html
out/_next/...
```

**Request `/` (or `/ipfs/<CID>/`)** → resolves to the *root directory* of the
CID. It's a directory, so the gateway applies the directory→`index.html` rule
and serves `out/index.html`. **200.** The home page works for exactly one
reason: it happens to be the one page whose file is named `index.html` and sits
inside a directory that the URL naturally resolves to.

**Request `/debug`** → the gateway looks for an entry literally named `debug`
in the root directory. There isn't one. There is an entry named `debug.html`,
but the gateway will **not** try appending `.html`, because that extension-
guessing behavior is a web-server convention (nginx `try_files`, Apache
MultiViews, Vercel's filesystem router), not an IPFS one. No entry named
`debug` → **404**.

Note what this means: `/debug.html` *would* actually return 200 through the
gateway. The file is there and reachable. The problem is purely that Next.js
emitted names in a shape (`<route>.html`) that only a server that guesses
extensions can route, while IPFS only understands the shape
`<route>/index.html`.

Two follow-on consequences worth knowing:

- **`out/404.html` does nothing.** That file is a Next.js convention that a
  hosting platform is supposed to wire up as the error document. A bare IPFS
  gateway has no such configuration, so you get the gateway's own plain 404
  body, not your styled Next.js 404 page.
- **`out/_next/...` still loads fine** on the home page, because those are
  requested by their literal, fully-qualified filenames — the gateway resolves
  them exactly. So the home page isn't just an empty shell; it's fully
  functional, which is precisely why this bug is easy to miss before upload.

## 2. The `next.config` change that fixes it

Set **`trailingSlash: true`** alongside `output: "export"`. That flips the
emitted filename convention from `debug.html` to `debug/index.html`, which is
the one shape IPFS's directory rule can resolve.

The IPFS-safe block in `packages/nextjs/next.config.ts`:

```typescript
const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";        // emit static HTML, no server
  nextConfig.trailingSlash = true;     // <route>/index.html, not <route>.html
  nextConfig.images = { unoptimized: true };  // no server-side image optimizer
}
```

`trailingSlash: true` also makes Next's client-side `<Link>` hrefs and the
canonical URLs emit as `/debug/` rather than `/debug`, so in-app navigation and
a hard refresh on a deep link agree with each other. That matters: without it,
a user who lands on `/debug` via client-side routing sees the page work, then
gets a 404 the moment they reload — which is the confusing half-broken state
people often report after "fixing" this with only a rename.

Guard it behind `NEXT_PUBLIC_IPFS_BUILD` so your normal `yarn start` dev
server and any Vercel build keep default behavior.

### The other cause of route 404s — check this too

`trailingSlash` fixes the *naming* problem. There is a second, independent
cause of a missing route: **a page that crashes during static prerendering is
skipped, and a page that was never emitted 404s no matter what you name it.**

In SE2 the usual culprit is `app/blockexplorer`, which touches `localStorage`
at import time. On Node 25 this also hits `/_not-found` because Node 25 ships a
built-in `localStorage` global that is truthy but has no `getItem`:

```
TypeError: localStorage.getItem is not a function
Error occurred prerendering page "/_not-found"
```

The fix has to reach the *build workers* — Next.js prerenders in child
processes, so a polyfill in `next.config.ts` or `instrumentation.ts` never
applies. Carry it on `NODE_OPTIONS`, which every child inherits:

```bash
NODE_OPTIONS="--no-experimental-webstorage"
```

If you don't need the block explorer, renaming `app/blockexplorer` to
`app/_blockexplorer-disabled` is an equally valid fix.

So: after the rebuild, confirm the route directory actually exists rather than
assuming `trailingSlash` covered it. If `out/debug/index.html` is missing after
a clean build, the cause is prerender failure, not routing.

## 3. What `out/` looks like after the change

```
out/
├── index.html              #  /        → root dir → index.html      ✅
├── debug/
│   └── index.html          #  /debug/  → debug dir → index.html     ✅
├── 404.html
├── 404/
│   └── index.html
└── _next/
    └── static/...
```

Every route is now a **directory containing `index.html`**, which is exactly
the shape the gateway's one resolution rule handles. `/debug` (no slash) also
works in practice — gateways redirect a directory hit to its trailing-slash
form, and Next emits the canonical `/debug/` links anyway.

## 4. Verify from the command line before re-uploading

Do a clean rebuild first — deploying a stale `out/` is the single most common
way this "fix" appears not to work:

```bash
cd packages/nextjs
rm -rf .next out

NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  NODE_OPTIONS="--no-experimental-webstorage" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

### Check the layout locally (before upload)

```bash
# Every route should appear as a directory + index.html
ls out/*/index.html

# The bug's signature: bare .html siblings at the root.
# After the fix, this should return nothing but 404.html.
ls out/*.html
```

Expected: `out/debug/index.html` present; no `out/debug.html`.

### Serve `out/` locally and curl the routes

This reproduces gateway semantics closely enough to catch the bug, because
Python's static handler applies the same directory→`index.html` rule and does
*not* guess extensions:

```bash
python3 -m http.server 8080 --directory out &

curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/debug/
# Both → 200. Before the fix, /debug/ → 404.

kill %1
```

### After upload, verify against the real gateway

```bash
yarn bgipfs upload out    # save the CID

CID=<your-cid>
for route in "" "debug/"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -L \
    "https://community.bgipfs.com/ipfs/$CID/$route")
  echo "$code  /$route"
done
```

Both should be `200`. `-L` matters — a bare `/debug` gets a 301 to `/debug/`
first, and without following redirects you'd misread a working route as broken.

One more check while you're there — confirm the build is the one you think it
is, and that OG metadata isn't pointing at localhost:

```bash
grep 'og:image' out/index.html      # should be your production URL, not localhost:3000
stat -c '%y' app/page.tsx out/      # source must be OLDER than out/, else stale build
```

## Summary

| | Before | After |
|---|---|---|
| `next.config` | `output: "export"` only | `+ trailingSlash: true` |
| Emitted file | `out/debug.html` | `out/debug/index.html` |
| Gateway resolves `/debug` | no entry named `debug` → **404** | directory → `index.html` → **200** |
| Why `/` worked | root path resolves to root dir, which has `index.html` | unchanged |

The home page was never evidence that the deploy was correct — it was the one
route that accidentally satisfied IPFS's only routing rule.
