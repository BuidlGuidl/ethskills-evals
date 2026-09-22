# Why `/debug` 404s on IPFS

The exported files are valid for a static host that supports "clean URL" rewrites:

```text
out/index.html
out/debug.html
out/404.html
out/_next/...
```

But an IPFS gateway is serving a UnixFS directory tree, not running a web server with rewrite rules. When the browser requests:

```text
/ipfs/<cid>/debug
```

the gateway looks for a directory entry named `debug`. It does not automatically try `debug.html`. Since the uploaded directory contains `debug.html` but not a `debug/` directory, the lookup fails and the gateway returns 404.

The home page still works because:

```text
/ipfs/<cid>/
```

points at the root directory, and gateways know how to serve the directory index:

```text
out/index.html
```

So `/` succeeds, while `/debug` fails because there is no `out/debug/index.html` and the gateway does not perform the `debug -> debug.html` mapping.

# Next config fix

Set `trailingSlash: true` in the Next config used by the Scaffold-ETH 2 frontend:

```ts
// packages/nextjs/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
```

If the project already has a `nextConfig` object, keep the existing settings and add:

```ts
trailingSlash: true,
```

This makes Next export each route as a directory with an `index.html`, which matches how IPFS gateways resolve paths.

# Expected `out/` layout after rebuilding

After rebuilding the static export, the relevant files should look like:

```text
out/index.html
out/debug/index.html
out/404.html
out/_next/...
```

For nested routes, Next will do the same thing:

```text
out/some/route/index.html
```

Now a gateway request for `/debug/` maps to the `debug` directory, then serves `debug/index.html`.

# Command-line verification before re-uploading

Rebuild the export:

```bash
yarn build
```

Check the generated files directly:

```bash
test -f out/index.html
test -f out/debug/index.html
test -f out/404.html
```

Serve the exact `out/` directory with a plain static file server:

```bash
python3 -m http.server 8080 --directory out
```

In another shell, verify that the routes resolve without relying on `.html` filenames:

```bash
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/debug
curl -I http://127.0.0.1:8080/debug/
```

`/` and `/debug/` should return a successful status. `/debug` may return a redirect to `/debug/`, which is also fine. The important route check is `/debug/`, because that is the shape IPFS can satisfy from `out/debug/index.html`.

Optionally, confirm there is no old flat `debug.html` export:

```bash
find out -maxdepth 3 -type f | sort
```

Once the files are in the directory-index form, upload the `out/` directory again to IPFS.
