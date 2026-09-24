# Why every route but `/` 404s on IPFS (Scaffold-ETH 2 static export)

## 1. What the gateway actually does

An IPFS gateway is **not a web server with routing rules**. It's a file lookup:

1. Take the URL path (`/ipfs/<CID>/debug`, or `/debug` on a subdomain/ENS gateway).
2. Split it into segments and walk the UnixFS directory tree (UnixFS = the file/folder format IPFS uses), one exact name at a time.
3. Result:
   - **Found a file** → serve its bytes.
   - **Found a directory** → if the URL has no trailing slash, redirect `301` to add one (`/debug` → `/debug/`). Then serve that directory's `index.html` if it has one (otherwise show a file listing).
   - **Nothing with that exact name** → `404`.

What the gateway does **not** do:
- No extension guessing. It never tries `debug` → `debug.html`. (That's a Vercel/Netlify/`next start` feature, often called "clean URLs".)
- No fallback to a SPA shell (a single-page-app `index.html` that handles every path). There is no server-side rewrite, and `_redirects` files only work on some gateways (subdomain/DNSLink ones) and only if you add one.

### Applied to your `out/`

```
out/index.html
out/debug.html
out/404.html
out/_next/...
```

| Request | Gateway lookup in root dir | Result |
|---|---|---|
| `/` | root is a directory → has `index.html` | **200** ✅ |
| `/debug` | entry named exactly `debug`? Only `debug.html` exists | **404** ❌ |
| `/debug/` | same lookup, `debug` doesn't exist | **404** ❌ |
| `/debug.html` | exact match | 200 (but nobody links to this URL) |

So the home page works only because `/` is the **one** path that points to a directory, and "directory → `index.html`" is the only automatic behavior a gateway has. Every other route is exported as a bare `name.html` file, and the gateway won't add `.html` for you.

Why it can look fine when you click around: if you open `/` and click a link to `/debug`, Next's client-side router loads the page with JavaScript, with no new request for the HTML document. The 404 only appears on a **hard load**: refresh, deep link, new tab, or shared URL. Those are exactly the cases that matter in production.

(Also, your `out/404.html` doesn't help. Gateways don't treat it as a custom not-found page by default, so you get the gateway's own 404.)

## 2. The fix: `trailingSlash: true`

In `packages/nextjs/next.config.ts`, apply the settings only for the IPFS build:

```ts
const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";          // static HTML export
  nextConfig.trailingSlash = true;       // debug.html -> debug/index.html  (THE fix)
  nextConfig.images = { unoptimized: true }; // no image optimizer server on IPFS
}
```

With `trailingSlash: true`, Next exports each route as a **directory with an `index.html` inside**. That's the one shape a gateway knows how to serve, and it also makes Next's own links end in `/`.

## 3. `out/` after the change

```
out/index.html
out/debug/index.html        <- was out/debug.html
out/404.html                <- 404 page (Next may also emit out/404/index.html)
out/_next/...
out/<every-other-route>/index.html
```

Now:
- `/debug` → gateway finds directory `debug` → `301` to `/debug/`
- `/debug/` → serves `debug/index.html` → **200** ✅

Also check:
- **Clean build.** Run `rm -rf .next out` before building. Otherwise leftover files can hide the change.
- **Pages must survive prerendering** (building each page's HTML ahead of time). If a page crashes during `yarn build`, it gets no HTML file and will still 404. A common cause is `localStorage` or browser APIs used at import time. SE2's `app/blockexplorer` does this: rename it to `app/_blockexplorer-disabled` if you don't need it. On Node 25+, use the `--require ./polyfill-localstorage.cjs` polyfill (see the build command below).

Full build:

```bash
cd packages/nextjs
rm -rf .next out
NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

## 4. Verify from the command line before re-uploading

### a) Check the file layout

```bash
cd packages/nextjs
ls out/*/index.html                    # expect out/debug/index.html, etc.
ls out/*.html                          # should be just index.html (+ 404.html), no debug.html
test -f out/debug/index.html && echo OK || echo "MISSING /debug"
```

### b) Serve it the way a gateway does, then curl the routes

Use a static server that serves directory `index.html` files but does **not** guess `.html`. Python's built-in server works:

```bash
python3 -m http.server 8787 -d out &
for r in / /debug /debug/; do
  printf "%-10s " "$r"
  curl -s -o /dev/null -L -w "%{http_code}\n" "http://localhost:8787$r"
done
kill %1
# expect 200 for all three (/debug gets a 301 to /debug/, which -L follows)
```

⚠️ Don't use `npx serve` / `vercel dev` for this check. They add `.html` automatically, so the broken layout would still show 200 and hide the bug.

### c) (Most accurate) Use a real IPFS gateway on your machine

```bash
ipfs add -r -Q out                     # prints root CID (local node only, nothing published yet)
CID=<that CID>
ipfs daemon &                          # local gateway at 127.0.0.1:8080
for r in "" debug debug/; do
  printf "%-8s " "/$r"
  curl -s -o /dev/null -L -w "%{http_code}\n" "http://127.0.0.1:8080/ipfs/$CID/$r"
done
```

Tip: use the subdomain form `http://$CID.ipfs.localhost:8080/debug/` to match how ENS / `.eth.link` serves the site from the root. Path gateways put the site under `/ipfs/<CID>/`, which can break absolute `/_next/...` asset paths even when the HTML returns 200.

### d) After upload

```bash
yarn bgipfs upload out                 # new CID. If the CID didn't change, you uploaded the old build
curl -s -o /dev/null -w "%{http_code}\n" -L "https://community.bgipfs.com/ipfs/<CID>/debug/"   # expect 200
```

Then point ENS at the new CID and check `https://yourapp.yourname.eth.link/debug` again.
