# Why /debug 404s on IPFS, and how to fix it

## 1. What the gateway does with this file layout

An IPFS upload of `out/` is a folder tree addressed by its CID (content ID). A gateway treats a URL path as a **literal path through that tree**. There is no web server logic in between: no rewrite rules, no `try_files`, no "also try adding `.html`".

For `https://<gateway>/ipfs/<cid>/<path>` the gateway:

1. Walks the tree one path segment at a time, looking for an entry with **exactly** that name.
2. If it lands on a **file**, it serves the file.
3. If it lands on a **folder**, it redirects to add a trailing slash if the URL has none, then serves that folder's `index.html` if there is one. If not, it shows a folder listing.
4. If some segment has no matching entry, it returns **404**. Some gateways that give each site its own origin (subdomain or DNSLink gateways) serve your `404.html` as the body or apply a `_redirects` file. They still return 404, and many path gateways ignore `404.html` entirely.

Applied to your upload:

| Request | Lookup | Result |
|---|---|---|
| `/ipfs/<cid>/` | the root folder itself, which contains `index.html` | **200**, home page |
| `/ipfs/<cid>/debug` | an entry named `debug`, but only `debug.html` exists | **404** |
| `/ipfs/<cid>/debug/` | same lookup, same miss | **404** |
| `/ipfs/<cid>/debug.html` | exact filename match | 200, but nobody links to this URL |

**Why the home page works:** `/` never needs a name lookup. It resolves to the root folder, and rule 3 serves `out/index.html`. That is the only route this layout serves by the folder-index rule. Every other route exists only as `<route>.html`, and the gateway never adds the `.html` suffix.

Locally this bug stays hidden because `next start`, Vercel, and most static servers (`npx serve` has `cleanUrls` on by default) quietly map `/debug` to `debug.html`. IPFS gateways do not.

Side effect worth knowing: clicking from the home page to `/debug` can still appear to work. Next's client-side router fetches that page's data files, such as `debug.txt`, which do exist as exact names. A reload, a shared link, or typing the URL directly then gives a 404. So test direct loads, not clicks.

## 2. The next.config change

In `packages/nextjs/next.config.ts`, turn on `trailingSlash` for the IPFS build:

```ts
if (process.env.NEXT_PUBLIC_IPFS_BUILD === "true") {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;          // <- the fix: emit route/index.html
  nextConfig.images = { unoptimized: true };
}
```

`trailingSlash: true` makes `next export` write each route as `<route>/index.html` instead of `<route>.html`. That is the layout the gateway's folder-index rule needs. It also makes Next generate `/debug/` links, which already match the gateway's canonical URL, so no extra redirect happens.

Rebuild from a clean slate so stale `debug.html` files don't mask the result:

```bash
cd packages/nextjs
rm -rf .next out
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  yarn build
```

## 3. What out/ looks like afterwards

```
out/index.html              # /
out/debug/index.html        # /debug/
out/blockexplorer/index.html  # (each other route likewise, e.g. SE-2's block explorer)
out/404.html                # custom 404 body (may also appear as 404/index.html)
out/_next/...               # JS/CSS chunks, unchanged
```

There should be no `out/debug.html` any more. Now `/ipfs/<cid>/debug` → redirect to `/debug/` → folder `debug` → `index.html` → **200**.

## 4. Verify from the command line before re-uploading

**a. Check the layout**

```bash
cd packages/nextjs
ls out/*/index.html                        # one per route: out/debug/index.html, ...
ls out/*.html                              # should list only index.html and 404.html
test -f out/debug/index.html && echo OK
```

**b. Serve it the way a gateway does, with no `.html` guessing.** `python3 -m http.server` resolves paths literally and serves folder `index.html`, like a gateway. Don't use `npx serve` with default settings, because its clean-URL feature hides the bug.

```bash
python3 -m http.server 8000 -d out &
for r in / /debug/ /debug; do
  printf '%-10s %s\n' "$r" "$(curl -s -o /dev/null -w '%{http_code}' -L "http://localhost:8000$r")"
done
kill %1
# expect 200 for all; before the fix /debug/ and /debug were 404
```

**c. Best check: go through a real IPFS gateway locally (Kubo, the standard IPFS node).** This gives the exact behaviour and the CID you are about to publish:

```bash
ipfs daemon &                                  # gateway on :8080
CID=$(ipfs add -r -Q --cid-version=1 out)      # prints the root CID only
ipfs ls "$CID/debug"                           # should list index.html
curl -s -o /dev/null -w '%{http_code}\n' -L "http://127.0.0.1:8080/ipfs/$CID/debug/"   # expect 200
curl -s -o /dev/null -w '%{http_code}\n' -L "http://$CID.ipfs.localhost:8080/debug/"   # subdomain style, expect 200
```

Use the same CID options your pinning service uses so the CIDs match. If the new CID equals the old one, the bytes didn't change: recheck the build before you blame caching.

**d. After uploading:** repeat the `curl -L .../ipfs/<cid>/debug/` check against the public gateway. Load the root and at least one other route, because a working root proves nothing about the other routes. Also check that the Open Graph URL and image point at the production origin, not localhost.
