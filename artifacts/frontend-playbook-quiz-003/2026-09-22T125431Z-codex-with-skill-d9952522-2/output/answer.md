# Why `/debug` 404s on IPFS

The uploaded `out/` directory currently contains:

```text
out/index.html
out/debug.html
out/404.html
out/_next/...
```

An IPFS gateway serves the CID as a UnixFS directory. For a request like:

```text
https://<gateway>/ipfs/<cid>/
```

the gateway resolves the CID root as a directory and serves its `index.html`, so the home page works.

For a request like:

```text
https://<gateway>/ipfs/<cid>/debug
```

the gateway looks for a path entry named `debug`. It does not automatically rewrite that request to `debug.html`. Since the export contains `debug.html` as a file, but not a `debug/` directory or a `debug` file, the path lookup fails and the gateway returns the exported `404.html` or its own 404 response.

The same thing happens for every non-root route emitted as `<route>.html`: `/about` is not resolved to `about.html`, `/foo` is not resolved to `foo.html`, and so on. The root is special only because directory indexes conventionally resolve to `index.html`.

# `next.config` Fix

For an IPFS static export, configure Next to emit directory-style routes:

```ts
// next.config.ts

if (process.env.NEXT_PUBLIC_IPFS_BUILD === "true") {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = { unoptimized: true };
}
```

The key setting for this bug is:

```ts
nextConfig.trailingSlash = true;
```

With `output: "export"` and `trailingSlash: true`, Next exports non-root routes as directories with their own `index.html` files. That matches how gateways resolve URL paths.

# What `out/` Looks Like Afterward

After rebuilding, the same app should look more like:

```text
out/index.html
out/debug/index.html
out/404.html
out/_next/...
```

Additional routes follow the same pattern:

```text
out/about/index.html
out/blockexplorer/index.html
out/your-route/index.html
```

Now `/ipfs/<cid>/debug/` resolves to the directory `debug/`, then serves `debug/index.html`.

# Verify Before Re-uploading

From the Next app package, rebuild from a clean output directory:

```bash
cd packages/nextjs
rm -rf .next out
NEXT_PUBLIC_IPFS_BUILD=true yarn build
```

Check that routes were emitted as directories:

```bash
test -f out/index.html
test -f out/debug/index.html
ls out/*/index.html
```

Then test with a simple static file server:

```bash
python3 -m http.server 8080 --directory out
```

In another shell, verify the root and a non-root route:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -L http://127.0.0.1:8080/
curl -sS -o /dev/null -w "%{http_code}\n" -L http://127.0.0.1:8080/debug/
```

Both should print:

```text
200
200
```

You can also check the no-slash version:

```bash
curl -sS -o /dev/null -w "%{http_code} %{url_effective}\n" -L http://127.0.0.1:8080/debug
```

That should follow the directory redirect and end at:

```text
200 http://127.0.0.1:8080/debug/
```

After uploading the rebuilt `out/`, run the same route check against the gateway CID:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -L "https://<gateway>/ipfs/<cid>/"
curl -sS -o /dev/null -w "%{http_code}\n" -L "https://<gateway>/ipfs/<cid>/debug/"
```

The important proof is that at least one non-home route returns `200` through the gateway. A working home page alone only proves that the gateway found the root `index.html`.
