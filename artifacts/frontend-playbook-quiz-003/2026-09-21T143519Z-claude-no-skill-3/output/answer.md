# Why `/debug` 404s on IPFS (and `/` doesn't)

## 1. What the gateway actually does

An IPFS gateway isn't a web server with rewrite rules. It walks a **UnixFS directory tree** (the folder structure stored under the CID), one path segment at a time. For `GET /ipfs/<CID>/debug` (or `https://<CID>.ipfs.dweb.link/debug`) it:

1. Opens the root directory of the CID.
2. Looks for an entry named **exactly** `debug`.
3. If that entry is a **file**, it serves the file.
4. If it's a **directory**, it redirects `/debug` → `/debug/` and then serves `debug/index.html` if one exists (otherwise it shows a directory listing).
5. If nothing is named `debug`, it returns **404**.

It does **not** guess extensions. There's no `try_files $uri $uri.html` and no "clean URLs". So with your layout:

| Request  | Entry the gateway looks for | Exists?                              | Result |
|----------|-----------------------------|--------------------------------------|--------|
| `/`      | root dir → `index.html`     | yes                                  | 200    |
| `/debug` | `debug`                     | **no** (only `debug.html` exists)    | 404    |
| `/debug/`| directory `debug/`          | no                                   | 404    |

**Why the home page works:** `/` resolves to a directory (the root), and every gateway serves `index.html` for a directory. That's the one route that goes through the directory → `index.html` rule. Every other page was exported as a flat `name.html` file, which only `/debug.html` would match, and your app never links to that URL.

**Why `out/404.html` doesn't help:** gateways don't treat `404.html` as a special file. The UnixFS gateway spec only looks for `ipfs-404.html` (or a `_redirects` file) on subdomain/DNSLink gateways, and only for the "not found" page. It never uses it as a SPA fallback. So you get the gateway's own 404.

**Side note:** clicking a `<Link>` from `/` to `/debug` can seem to work, because the Next router renders the page on the client without asking the gateway for `/debug`. But a hard refresh, a bookmark, or a shared link on `/debug` goes to the gateway and 404s.

(Scaffold-ETH 2 itself is fine. Vercel and `next start` map `/debug` → `debug.html` for you. A plain static host with no rewrites, like IPFS, doesn't.)

## 2. The fix: `trailingSlash: true`

Make Next emit every route as `route/index.html`, so each route becomes a **directory**. That turns them into the same case as `/`, which already works.

`packages/nextjs/next.config.ts`:

```ts
const nextConfig: NextConfig = {
  // ...existing config
};

const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;          // <- the fix: route/index.html instead of route.html
  nextConfig.images = { unoptimized: true }; // no image optimizer on a static host
}

module.exports = nextConfig;
```

(Recent SE-2 versions already ship this block, and `yarn ipfs` sets `NEXT_PUBLIC_IPFS_BUILD=true`. If you built with a plain `output: "export"` and no `trailingSlash`, or with a custom build command that skipped that env var, you get the flat layout above.)

Rebuild:

```sh
cd packages/nextjs
rm -rf .next out
NEXT_PUBLIC_IPFS_BUILD=true NEXT_PUBLIC_IGNORE_BUILD_ERROR=true yarn build
```

## 3. `out/` after the change

```
out/index.html
out/index.txt            # RSC payload (App Router)
out/debug/index.html     # was out/debug.html
out/debug/index.txt      # was out/debug.txt
out/blockexplorer/index.html   # ...same for every other route
out/404.html
out/404/index.html
out/_next/...
```

Now `/debug` → the gateway finds the directory `debug` → redirects to `/debug/` → serves `debug/index.html` → 200. `<Link>`s also produce trailing-slash URLs (`/debug/`), so shared or copied links go straight to the directory.

## 4. Verify from the command line before re-uploading

**a) Check the layout.** There should be no `*.html` pages at the top level besides `index.html` and `404.html`:

```sh
find out -name '*.html' -not -path 'out/_next/*' | sort
# expect: out/404.html, out/404/index.html, out/debug/index.html, out/index.html, ...
test -f out/debug/index.html && echo OK || echo MISSING
```

**b) Serve it with a server that does NOT guess extensions.** Don't use `npx serve`: its "clean URLs" feature maps `/debug` → `debug.html` and would hide the bug. Python's server behaves like a gateway here (directory → `index.html`, nothing else):

```sh
cd out && python3 -m http.server 8000 &
for r in / /debug /debug/ /blockexplorer/; do
  printf '%-16s ' "$r"; curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:8000$r"
done
# /        200
# /debug   301   (-> /debug/, same as a gateway)
# /debug/  200
kill %1
```

Run the same script against the *old* build and `/debug` returns 404, the same failure you see on IPFS.

**c) Most faithful check: a real local IPFS gateway (Kubo).** You get the actual resolution logic, and the CID you'll publish:

```sh
ipfs daemon &                                   # local gateway on :8080
CID=$(ipfs add -r -Q --cid-version 1 out)       # add locally only, nothing is pinned remotely
ipfs ls /ipfs/$CID/debug                        # should list index.html
curl -sIL "http://127.0.0.1:8080/ipfs/$CID/debug"  | grep -E '^HTTP|^[Ll]ocation'
# HTTP/1.1 301 ... Location: /ipfs/<CID>/debug/
# HTTP/1.1 200
curl -sIL "http://$CID.ipfs.localhost:8080/debug/" | grep '^HTTP'   # subdomain gateway, like dweb.link
```

(Use the subdomain form, `<CID>.ipfs.localhost` / `<CID>.ipfs.dweb.link`, as your real URL. On path-style gateways (`/ipfs/<CID>/...`), Next's absolute `/_next/...` asset paths point to the gateway root and break.)

To get just the CID without adding anything: `ipfs add -r -Q --only-hash --cid-version 1 out`. It should match the CID your pinning service reports after upload.

Once `/debug/` returns 200 locally, re-upload `out/`, then check the live gateway with the same `curl -sIL https://<CID>.ipfs.dweb.link/debug`.
