# IPFS gateway route mechanics

The uploaded directory contains:

```text
out/index.html
out/debug.html
out/404.html
out/_next/...
```

An IPFS HTTP gateway serves a UnixFS directory by path lookup. It does not run
Next.js routing logic, and it usually does not rewrite clean routes to `.html`
files.

That means:

- `https://<gateway>/ipfs/<cid>/` asks for the root directory. The gateway can
  serve `index.html` from that directory, so the home page works.
- `https://<gateway>/ipfs/<cid>/debug` asks for a child named `debug`. The
  uploaded directory has `debug.html`, not `debug`, so the gateway returns 404.
- `https://<gateway>/ipfs/<cid>/debug/` asks for a `debug` directory and then,
  if present, its `index.html`. There is no `debug/` directory, so that also
  returns 404.

`debug.html` exists, so `/debug.html` may work if requested directly, but the
app's route is `/debug`. IPFS gateways are static file servers, not Next.js
servers, so root success does not prove that clean routes resolve.

# Fix in `next.config`

For IPFS static exports, enable directory-style route output:

```ts
if (process.env.NEXT_PUBLIC_IPFS_BUILD === "true") {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = { unoptimized: true };
}
```

The route fix is `trailingSlash: true`. With static export, that changes clean
routes from single HTML files into directories with `index.html` files.
`images.unoptimized` is also needed for fully static IPFS builds because the
Next image optimizer is a server feature.

# Expected `out/` shape after rebuilding

After removing stale artifacts and rebuilding with `NEXT_PUBLIC_IPFS_BUILD=true`,
the route files should look like:

```text
out/index.html
out/debug/index.html
out/404.html
out/_next/...
```

For additional routes, expect the same pattern:

```text
out/some-route/index.html
out/nested/route/index.html
```

Next may still emit special files such as `404.html` at the export root, but
normal application routes should be directories with their own `index.html`.

# Verify before re-uploading

From the Next.js package directory:

```bash
rm -rf .next out
NEXT_PUBLIC_IPFS_BUILD=true yarn build
find out -maxdepth 3 -name index.html | sort
```

Confirm that every route you expect appears as a directory:

```bash
test -f out/index.html
test -f out/debug/index.html
```

Then serve the exported directory locally as static files and request the same
paths the gateway will see:

```bash
npx serve out
```

In another terminal:

```bash
curl -I http://localhost:3000/
curl -I http://localhost:3000/debug/
curl -I http://localhost:3000/debug
```

`/` and `/debug/` should return `200`. Depending on the local static server,
`/debug` may redirect to `/debug/` or return `200`; the important exported file
is `out/debug/index.html`.

After uploading, verify the CID itself through the gateway:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -L "https://<gateway>/ipfs/<cid>/"
curl -s -o /dev/null -w "%{http_code}\n" -L "https://<gateway>/ipfs/<cid>/debug/"
```

Both should print `200`. If the CID did not change after re-uploading, the bytes
you uploaded did not change either, so check the rebuild and upload target before
suspecting gateway caching.
