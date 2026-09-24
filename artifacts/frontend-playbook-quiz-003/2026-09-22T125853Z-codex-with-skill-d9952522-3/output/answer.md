# Why `/debug` 404s on IPFS

The upload is a valid static export, but it is not shaped the way an IPFS HTTP
gateway resolves clean routes.

With this layout:

```text
out/index.html
out/debug.html
out/404.html
out/_next/...
```

the root page works because a request for:

```text
https://<gateway>/ipfs/<cid>/
```

maps to the UnixFS directory root and the gateway serves `index.html`.

But a request for:

```text
https://<gateway>/ipfs/<cid>/debug/
```

is resolved as a path lookup for a `debug` directory, then an `index.html`
inside that directory. The uploaded DAG has `debug.html`, not
`debug/index.html`, so the gateway cannot find the requested object and returns
404.

Some web servers implement clean URL rewrites such as `/debug` -> `/debug.html`.
IPFS gateways generally do not provide Next.js-style route fallback or extension
rewrites for arbitrary static exports. They serve the files and directories that
were uploaded. That is why `/` succeeds while `/debug` and other non-home routes
fail.

# Fix

For an IPFS static build, configure Next to export route directories by enabling
`trailingSlash` for the IPFS build.

In `packages/nextjs/next.config.ts` or `next.config.js`:

```ts
if (process.env.NEXT_PUBLIC_IPFS_BUILD === "true") {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = { unoptimized: true };
}
```

Then rebuild from a clean output directory:

```bash
cd packages/nextjs
rm -rf .next out
NEXT_PUBLIC_IPFS_BUILD=true yarn build
```

# Expected `out/` Layout

After the change, exported application routes are emitted as directories with
their own `index.html` files:

```text
out/index.html
out/debug/index.html
out/<other-route>/index.html
out/404.html
out/_next/...
```

The important difference is `out/debug/index.html` instead of
`out/debug.html`. Now the gateway path `/ipfs/<cid>/debug/` resolves to an
actual directory index.

# Verify Before Uploading

Check that routes were exported as directories:

```bash
cd packages/nextjs
find out -maxdepth 3 -name index.html | sort
```

You should see entries like:

```text
out/index.html
out/debug/index.html
```

Serve the static output locally and test the same slash-style URLs the gateway
will receive:

```bash
npx serve out
```

In another shell:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -L http://localhost:3000/
curl -s -o /dev/null -w "%{http_code}\n" -L http://localhost:3000/debug/
```

Both should return `200`.

You can also test the raw files without a server:

```bash
test -f out/index.html
test -f out/debug/index.html
```

After uploading, verify the gateway CID directly:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -L "https://<gateway>/ipfs/<cid>/"
curl -s -o /dev/null -w "%{http_code}\n" -L "https://<gateway>/ipfs/<cid>/debug/"
```

The non-home route must return `200`; a working home page alone does not prove
the IPFS route layout is correct.
