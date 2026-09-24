# Why `/debug` 404s on IPFS

The uploaded CID is a UnixFS directory, and an HTTP IPFS gateway resolves the URL path as a literal path inside that directory:

```text
https://gateway.example/ipfs/<CID>/debug
                         ^^^^^^^
                         look for an entry named "debug"
```

With this export:

```text
out/index.html
out/debug.html
out/404.html
out/_next/...
```

the root route works because `/ipfs/<CID>/` resolves to the root directory, and gateways serve `index.html` when a requested directory contains one.

`/debug` fails because there is no directory or file named `debug`; there is only a file named `debug.html`. A normal Next server, or a configured web server, can rewrite `/debug` to `/debug.html`. An IPFS gateway is just serving static content by path. It does not run the Next router, does not apply Next rewrites, and does not guess the `.html` extension. So every exported route that exists only as `route.html` is invisible at the clean URL `route`.

# The fix

For a static IPFS build, set `trailingSlash: true` in `packages/nextjs/next.config.ts` or `next.config.js`. Keep `output: "export"` for the static export, and keep image optimization disabled for static hosting.

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
```

If the app only uses static export for IPFS builds, make it conditional:

```ts
import type { NextConfig } from "next";

const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

const nextConfig: NextConfig = {
  ...(isIpfs
    ? {
        output: "export",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
```

Next documents this exact export behavior: with `trailingSlash: true`, clean routes are emitted as directory indexes, so `/me.html` becomes `/me/index.html`.

# What `out/` should look like

After deleting the stale build and rebuilding:

```bash
cd packages/nextjs
rm -rf .next out
NEXT_PUBLIC_IPFS_BUILD=true yarn build
```

the relevant files should be shaped like this:

```text
out/index.html
out/debug/index.html
out/404.html
out/_next/...
```

For nested routes, the same rule applies:

```text
out/foo/index.html
out/foo/bar/index.html
```

Now an IPFS gateway request for `/debug` resolves to a real directory named `debug`; the gateway may redirect to `/debug/`, then serves `debug/index.html`.

# Verify before re-uploading

First check the artifact shape:

```bash
cd packages/nextjs
test -f out/index.html
test -f out/debug/index.html
find out -maxdepth 3 -type f -name index.html | sort
```

Then serve `out/` with a plain static file server that does not add SPA fallback behavior:

```bash
python3 -m http.server 4173 --directory out
```

In another terminal:

```bash
curl -I -L http://127.0.0.1:4173/
curl -I -L http://127.0.0.1:4173/debug
curl -I -L http://127.0.0.1:4173/debug/
```

Each route should finish with `HTTP/1.0 200 OK` or `HTTP/1.1 200 OK`. If `/debug` returns 404 locally, the IPFS gateway will 404 too.

If you have Kubo/IPFS installed, you can also test the exact gateway path locally before uploading to a remote pinning service:

```bash
CID=$(ipfs add -Qr out)
curl -I -L "http://127.0.0.1:8080/ipfs/$CID/"
curl -I -L "http://127.0.0.1:8080/ipfs/$CID/debug"
curl -I -L "http://127.0.0.1:8080/ipfs/$CID/debug/"
```

Only upload the rebuilt `out/` once those commands return 200 for every route you expect to be reachable.
