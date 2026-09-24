# Why `/debug` 404s on IPFS (and `/` doesn't)

## 1. Gateway mechanics

An IPFS gateway is **not a web server with rewrite rules**. It resolves the URL path
literally, segment by segment, against the UnixFS directory tree (the folder you uploaded):

```
https://<cid>.ipfs.<gateway>/debug
                           └─ look for an entry named exactly "debug" in the root dir
```

Resolution rules that matter here:

| Request path | What the gateway looks for | Your `out/` has | Result |
|---|---|---|---|
| `/` | root **directory** → its `index.html` | `index.html` | 200 ✅ |
| `/debug` | an entry named `debug` (file or dir) | only `debug.html` | **404** ❌ |
| `/debug/` | directory `debug/` → `debug/index.html` | nothing | **404** ❌ |
| `/debug.html` | file `debug.html` | `debug.html` | 200 (ugly URL, nobody links it) |

- **No extension guessing.** Vercel / `next start` / nginx `try_files $uri $uri.html` quietly map
  `/debug` → `debug.html`. IPFS gateways don't. `debug` ≠ `debug.html`, so the lookup fails.
- **Directories are the only "pretty URL" mechanism.** When the path hits a *directory*, the gateway
  serves its `index.html` (redirecting `/foo` → `/foo/` first). That's the only reason `/` works:
  the root of the CID is a directory and it contains `index.html`. Every other route was emitted as
  a flat `name.html` file, so none get that treatment.
- **`404.html` doesn't save you.** Gateways don't use `404.html` as a fallback (the IPFS convention
  is `ipfs-404.html`, only honored on subdomain/DNSLink gateways, and it's still a 404 — not an SPA
  rewrite). So you get the gateway's own 404 page.

Why it may have *looked* fine in testing: clicking a `<Link>` from the home page does client-side
navigation — the Next router fetches the RSC payload (`debug.txt`) via JS, which does exist, so
the page renders. Only a **direct load / refresh / shared link** of `/debug` hits the gateway's
path resolution and 404s.

## 2. The fix: `trailingSlash: true`

Tell Next to emit every route as `route/index.html` instead of `route.html`.
In `packages/nextjs/next.config.ts` (SE-2 already gates static export on `NEXT_PUBLIC_IPFS_BUILD`):

```ts
const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;      // ← the fix: /debug → debug/index.html
  nextConfig.images = { unoptimized: true };
}
```

`trailingSlash: true` also makes Next's `<Link>`s generate `/debug/`, matching what the gateway
serves (no redirect hop).

## 3. `out/` after the change

```
out/index.html
out/404.html
out/debug/index.html          ← was debug.html
out/debug/index.txt           ← RSC payload for client nav
out/blockexplorer/index.html  ← (and any other route, same pattern)
out/_next/...
```

Now `/debug` → gateway finds directory `debug` → redirects to `/debug/` → serves
`debug/index.html`. Same mechanism that already made `/` work.

Notes:
- Dynamic routes (e.g. `blockexplorer/address/[address]`) only exist in the export if they have
  `generateStaticParams`; otherwise they aren't in `out/` at all and will 404 regardless.
- Use a **subdomain** gateway (`https://<cid>.ipfs.dweb.link/`) or DNSLink. On a *path* gateway
  (`https://gw/ipfs/<cid>/debug/`) the absolute `/_next/...` asset URLs resolve to `https://gw/_next/`
  and break.

## 4. Verify from the command line before re-uploading

**Build:**
```bash
cd packages/nextjs
NEXT_PUBLIC_IPFS_BUILD=true NEXT_PUBLIC_IGNORE_BUILD_ERROR=true yarn build
```

**Check the layout — no flat route `.html` files except `index.html`/`404.html`:**
```bash
find out -name '*.html' -not -path 'out/_next/*' | sort
# expect: out/404.html, out/index.html, out/debug/index.html, ...
test -f out/debug/index.html && echo OK || echo MISSING
```

**Serve with a literal static server (no `.html` guessing) and curl each route:**
```bash
python3 -m http.server 8080 -d out &   # like a gateway: dir → index.html, no extension fallback
for r in / /debug/ /debug /blockexplorer/; do
  printf '%-16s ' "$r"; curl -s -o /dev/null -L -w '%{http_code}\n' "http://localhost:8080$r"
done
kill %1
```
All should print `200`. Don't use `npx serve` for this — its `cleanUrls` default maps `/debug` →
`debug.html` and would hide the bug.

**Best: test against a real IPFS gateway locally (Kubo), without publishing:**
```bash
ipfs daemon --offline &
CID=$(ipfs add -r -Q --cid-version 1 out)
ipfs ls /ipfs/$CID/debug                   # should list index.html
for r in / /debug/ /debug; do
  printf '%-10s ' "$r"
  curl -s -o /dev/null -L -w '%{http_code}\n' "http://$CID.ipfs.localhost:8080$r"
done
```
`200` everywhere → re-upload. After uploading, run `ipfs ls /ipfs/<new-cid>/debug` (or curl the
public subdomain gateway) to confirm the pinned tree has the same layout. The CID may differ from your
local one if the pinning service uses different chunking settings.
