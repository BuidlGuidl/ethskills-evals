# Why `/` works but `/debug` 404s on IPFS

The uploaded CID is a static directory. An IPFS HTTP gateway is not running
the Next.js router and it is not applying framework rewrites. It resolves the
URL path against files and directories inside the UnixFS directory you uploaded.

With this export:

```text
out/
  index.html
  debug.html
  404.html
  _next/
```

the gateway can serve the home page because `/ipfs/<CID>/` points at the root
directory, and gateways know how to serve a directory's `index.html`.

But `/ipfs/<CID>/debug` is a request for a path named `debug`. There is no
`out/debug` file or `out/debug/` directory. The file that exists is
`out/debug.html`, which would only be served at `/ipfs/<CID>/debug.html`.
Since the gateway has no Next.js server behind it to map `/debug` to
`debug.html`, the lookup misses and the gateway returns 404. The same thing
happens for every other static-exported route that was emitted as
`<route>.html`.

# The fix

For an IPFS static export, make Next emit each route as a directory containing
`index.html`.

In `packages/nextjs/next.config.ts` or `next.config.js`, enable
`trailingSlash: true` for the IPFS/static-export build:

```ts
import type { NextConfig } from "next";

const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

const nextConfig: NextConfig = {
  // existing config...
};

if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = { unoptimized: true };
}

export default nextConfig;
```

If `output: "export"` is already set elsewhere, the critical missing option is:

```ts
trailingSlash: true
```

Next documents this behavior: with `output: "export"`, `/about` normally emits
`/about.html`; with `trailingSlash: true`, it emits `/about/index.html`.

# What `out/` looks like after rebuilding

After deleting the stale build artifacts and rebuilding, application routes
should be directory indexes:

```text
out/
  index.html
  debug/
    index.html
  404.html
  _next/
    ...
```

For additional routes, expect the same shape:

```text
out/
  blockexplorer/
    index.html
  your-route/
    index.html
```

`404.html` may remain a special top-level file depending on the Next version
and router setup. That is fine. The important check is that real app routes are
no longer only `debug.html`, `foo.html`, etc.; they have
`debug/index.html`, `foo/index.html`, and so on.

# Verify before re-uploading

Clean first so you do not upload stale output:

```bash
cd packages/nextjs
rm -rf .next out

NEXT_PUBLIC_IPFS_BUILD=true yarn build
```

Check the export shape:

```bash
test -f out/index.html
test -f out/debug/index.html
find out -mindepth 2 -maxdepth 2 -name index.html -print | sort
```

A useful sanity check is that route HTML files like `out/debug.html` should not
be the only representation of the route anymore:

```bash
find out -maxdepth 1 -name "*.html" -print | sort
```

Then serve `out/` with a plain static file server and hit it with `curl`:

```bash
python3 -m http.server 4173 --directory out &
server_pid=$!

for path in / /debug/ /debug; do
  curl -s -L -o /dev/null -w "$path -> %{http_code} %{url_effective}\n" \
    "http://127.0.0.1:4173$path"
done

kill "$server_pid"
```

Expected result:

```text
/ -> 200 http://127.0.0.1:4173/
/debug/ -> 200 http://127.0.0.1:4173/debug/
/debug -> 200 http://127.0.0.1:4173/debug/
```

That local test mirrors the important gateway behavior: directory paths resolve
to `index.html`, while bare extensionless paths do not magically resolve to
`*.html`. Once those checks pass, upload the fresh `out/` directory to IPFS.

Sources:

- https://nextjs.org/docs/app/api-reference/config/next-config-js/trailingSlash
- https://nextjs.org/docs/app/guides/static-exports
