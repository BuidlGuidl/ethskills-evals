# Why `/debug` 404s on an IPFS static export

IPFS gateways serve files from the uploaded directory. They do not run a
Next.js server, so there is no server-side router that can translate a clean
URL like `/debug` into some other file.

With this export:

```text
out/index.html
out/debug.html
out/404.html
out/_next/...
```

the gateway can load `/` because directory requests conventionally fall back to
`index.html`. In other words:

```text
/  -> out/index.html
```

But `/debug` is different. A gateway request for `/debug` is a request for an
object at that exact path, or for a directory named `debug` that contains an
`index.html`. It does not automatically try `debug.html`.

So this file exists:

```text
out/debug.html
```

but the gateway is looking for one of these:

```text
out/debug
out/debug/index.html
```

Neither exists, so `/debug` returns 404. The same applies to every exported
route except `/`.

# The `next.config` fix

For IPFS static exports, enable trailing slashes when building:

```ts
// next.config.ts
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
```

If the app only uses static export for IPFS builds, gate it behind the existing
environment flag:

```ts
// next.config.ts
const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

const nextConfig = {};

if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = { unoptimized: true };
}

export default nextConfig;
```

`trailingSlash: true` changes the export shape from `debug.html` to a real
directory route:

```text
out/index.html
out/debug/index.html
out/404/index.html
out/_next/...
```

Now the gateway can resolve:

```text
/debug/ -> out/debug/index.html
```

Most gateways also redirect or normalize `/debug` to `/debug/`, after which the
directory `index.html` lookup succeeds.

# Verify before re-uploading

Clean and rebuild the static export first:

```bash
cd packages/nextjs
rm -rf .next out

NEXT_PUBLIC_IPFS_BUILD=true \
NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
yarn build
```

Then check that routes are exported as directories with `index.html` files:

```bash
find out -maxdepth 3 -name index.html | sort
```

You should see entries like:

```text
out/index.html
out/debug/index.html
out/404/index.html
```

You can also verify route responses locally with a static file server:

```bash
npx serve out
```

In another terminal:

```bash
curl -I http://localhost:3000/
curl -I http://localhost:3000/debug/
curl -I http://localhost:3000/404/
```

Each real route should return `200`. For the specific IPFS-style failure mode,
the important check is that `out/debug/index.html` exists before uploading:

```bash
test -f out/debug/index.html && echo "debug route will work"
```

After uploading, verify the gateway URL with the trailing slash:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -L \
  "https://GATEWAY/ipfs/CID/debug/"
```

That should print `200`, not `404`.
