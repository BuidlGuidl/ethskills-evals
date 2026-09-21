# Why every route except `/` returns 404 on IPFS

## What the gateway does

An IPFS gateway is not a web server with rewrite rules. It is closer to a
plain file lookup: it takes the URL path after `/ipfs/<cid>/`, walks the
directory stored under that CID, and returns what is at that exact path.
It does **not** try other file names such as `<path>.html`.

- **`/ipfs/<cid>/`**: the path points at the root *directory*. For a
  directory, the gateway looks for an `index.html` inside it and serves that.
  `out/index.html` exists, so the home page works.
- **`/ipfs/<cid>/debug`**: the gateway looks for an entry named exactly
  `debug` in the root. There is only `debug.html`. The gateway won't
  add `.html` for you (Next.js's own server and hosts like Vercel do this
  quietly, and that's why it works locally). No `debug` entry means **404**. When a
  `404.html` exists, the gateway may serve it as the body of the error
  page, but the status is still 404.
- The same happens for every other route: each one was exported as a
  `<route>.html` file, never as a `<route>/` directory, so nothing matches.

In short, the home page works only because it's the one route that
happens to be a directory with an `index.html`. That's the one case the
gateway handles on its own.

## The fix: `trailingSlash: true`

In `packages/nextjs/next.config.ts`, turn it on for the IPFS build (along
with static export and unoptimized images):

```ts
if (process.env.NEXT_PUBLIC_IPFS_BUILD === "true") {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;          // emit <route>/index.html
  nextConfig.images = { unoptimized: true }; // no image-optimizer server on IPFS
}
```

With `trailingSlash: true`, Next.js writes every route as a folder that
holds an `index.html`. Its internal links also get a trailing slash
(`/debug/`), so page-to-page navigation lands on those folders.

## What `out/` looks like after rebuilding

```
out/index.html
out/debug/index.html
out/404.html          # (Next may also emit out/404/index.html)
out/_next/...
```

There should be no `debug.html` left. Now `/ipfs/<cid>/debug/` resolves to a
directory, the gateway serves its `index.html`, and you get **200**.
`/ipfs/<cid>/debug` without the slash also works, because gateways redirect
a directory path to the version with the trailing slash.

## Rebuild cleanly

Delete old output first so a stale `debug.html` can't slip into the upload:

```bash
cd packages/nextjs
rm -rf .next out
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  yarn build
```

(If you're on Node 25 and the build crashes on `localStorage.getItem`
during prerender, add
`NODE_OPTIONS="--no-experimental-webstorage"`, or
`NODE_OPTIONS="--localstorage-file=.node-localstorage"`.)

## Verify from the command line before re-uploading

1. **Check the file layout.** Every route should be its own folder with an
   `index.html`, and no stray `<route>.html` files should remain:

   ```bash
   ls out/*/index.html            # expect out/debug/index.html, etc.
   ls out/*.html                  # expect only index.html (and 404.html)
   ```

2. **Serve `out/` with a plain static server that has no rewrites**, so it
   behaves like a gateway, and check the status codes:

   ```bash
   python3 -m http.server 3000 -d out &
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/        # 200
   curl -s -o /dev/null -w "%{http_code}\n" -L http://localhost:3000/debug/ # 200
   ```

   `python3 -m http.server` is a good stand-in. Like a gateway, it only
   serves exact paths and a folder's `index.html`. Avoid `npx serve`: it
   quietly adds `.html` to paths, so it hides this bug. Against the old
   build it returns 404 for `/debug/`. That shows the test really catches
   the bug.

3. **Best check: put the folder on a local IPFS node and test through a
   real gateway** before publishing anywhere:

   ```bash
   CID=$(ipfs add -r -Q --cid-version 1 out)
   curl -s -o /dev/null -w "%{http_code}\n" -L "http://127.0.0.1:8080/ipfs/$CID/"       # 200
   curl -s -o /dev/null -w "%{http_code}\n" -L "http://127.0.0.1:8080/ipfs/$CID/debug/" # 200, not 404
   ```

4. **Check the page metadata.** It should point at the production site, not
   localhost:

   ```bash
   grep -o 'og:[a-z]*" content="[^"]*"' out/index.html   # should show https://<production-domain>
   ```

After you upload, repeat the `curl` on `/ipfs/<cid>/debug/` against the
public gateway. Also check that the CID changed. If the CID is the same as
before, you uploaded the same files, so look at the build or the upload
target before you blame gateway caching.
