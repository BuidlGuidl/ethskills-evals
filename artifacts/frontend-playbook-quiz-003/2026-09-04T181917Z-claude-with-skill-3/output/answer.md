# Why `/debug` 404s on the gateway (and `/` doesn't)

## 1. The gateway mechanics

An IPFS gateway is not a web server with rewrite rules. It is a resolver over a
UnixFS DAG: the path segments after the CID are looked up as *exact* directory
entry names, one hop at a time. There is no extension guessing, no
`try_files $uri $uri.html`, no Apache MultiViews, no S3-website
`index_document` inference.

Your uploaded root directory has exactly these entries:

    index.html
    debug.html
    404.html
    _next/

When a request for `/ipfs/<cid>/debug` arrives, the gateway looks in the root
directory for an entry literally named `debug`. There isn't one — the entry is
named `debug.html`. Resolution fails and the gateway returns 404. It will never
try appending `.html`, because doing so would be a guess about a naming
convention that UnixFS does not define.

The home page works because of the *one* implicit resolution step a gateway
does perform: when a path resolves to a **directory**, the gateway looks for a
child entry named exactly `index.html` and serves that. A request for
`/ipfs/<cid>/` resolves to the root directory, the gateway finds `index.html`
inside it, and serves it. That directory-index rule is the whole special case —
and it is why the home page is the only route that happens to be shaped
correctly for it.

So the layout you shipped only satisfies the gateway's contract at the root.
Every other route was written as a sibling `.html` file, a shape that requires a
host willing to map extensionless URLs onto `.html` files. Vercel, Netlify, and
GitHub Pages do that. An IPFS gateway does not.

Two corollaries worth internalizing:

- **`out/404.html` is dead weight here.** Next emits it for hosts that route
  unmatched paths to it. A gateway has no such config; on a failed resolution it
  returns its own error body. Your custom 404 page is only reachable by
  requesting `/404.html` explicitly. (Some gateways honor an opt-in `_redirects`
  file at the root, but that's a separate mechanism — not the fix you want here.)
- **The root success is not evidence about the other routes.** It exercises the
  directory-index rule and nothing else. This is exactly why the check after
  upload must hit a non-home route.

## 2. The `next.config` change

Add `trailingSlash` to the IPFS branch of the config, next to the export and
image settings:

```typescript
if (process.env.NEXT_PUBLIC_IPFS_BUILD === "true") {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;      // <- the fix
  nextConfig.images = { unoptimized: true };
}
```

`trailingSlash: true` changes how the exporter *materializes* each route. Instead
of writing route `/debug` to the file `debug.html`, it writes it to the directory
`debug/` containing `index.html`. That turns every route into the one shape the
gateway already knows how to resolve. It also makes Next emit internal links with
a trailing slash, so client-side navigation and a hard refresh land on the same
resolvable path.

`output: "export"` and `images: { unoptimized: true }` you presumably already
have (you got an `out/` at all, and unoptimized images are required because the
optimizer is a server runtime that doesn't exist on a gateway). The missing piece
is `trailingSlash`.

## 3. What `out/` looks like after the change

    out/index.html
    out/debug/index.html
    out/404.html
    out/_next/...

Plus one directory per additional route — e.g. `out/blockexplorer/index.html`,
`out/blockexplorer/address/[address]` variants, and so on for whatever your app
defines. The rule to look for: **every route except `/` is now a directory with
an `index.html` inside it, and there are no more bare `<route>.html` files.**
`404.html` still sits at the root and is still unused by the gateway; that's
expected, not a symptom.

Now `/ipfs/<cid>/debug/` resolves the `debug` directory entry, hits the
directory-index rule, and serves `debug/index.html`. Requesting `/ipfs/<cid>/debug`
without the slash also works: gateways redirect to the slashed form, which is why
`curl -L` matters below.

## 4. Verifying from the command line before re-uploading

**Rebuild from clean.** A stale `out/` is the most common way this "fix" appears
not to work — the old `debug.html` survives alongside the new directory and you
can't tell which one you're testing.

```bash
cd packages/nextjs
rm -rf .next out
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  yarn build
```

**Check the layout.** One `index.html` per route directory:

```bash
ls out/*/index.html
```

And confirm the old shape is gone — this should print nothing:

```bash
find out -maxdepth 1 -name '*.html' ! -name 'index.html' ! -name '404.html'
```

**Serve it with something that resolves like a gateway.** This matters more than
it looks: `npx serve` and `http-server` do clean-URL extension guessing, so they
will happily serve `debug.html` for `/debug` and give you a false green on the
exact bug you're trying to fix. Python's `http.server` does not guess extensions
and does apply the directory-index rule, which makes it a faithful stand-in:

```bash
python3 -m http.server 8080 --directory out &
curl -s -o /dev/null -w "%{http_code}\n" -L http://localhost:8080/           # 200
curl -s -o /dev/null -w "%{http_code}\n" -L http://localhost:8080/debug/     # 200
curl -s -o /dev/null -w "%{http_code}\n" -L http://localhost:8080/debug      # 200 via redirect
```

**Optionally, resolve it as real IPFS before publishing.** If you have a local
node, add the directory and serve the actual CID through your own gateway — this
tests DAG resolution rather than a filesystem approximation:

```bash
CID=$(ipfs add -rQ out)
curl -s -o /dev/null -w "%{http_code}\n" -L "http://127.0.0.1:8080/ipfs/$CID/debug/"
```

**After uploading,** repeat against the public gateway and record the CID. An
unchanged CID means the bytes you uploaded are identical to last time — check the
build output and the upload target before blaming gateway caching:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -L "https://<gateway>/ipfs/<cid>/debug/"  # expect 200
```

Also confirm the Open Graph URL and image in the served HTML carry the production
origin rather than `localhost` — `NEXT_PUBLIC_PRODUCTION_URL` has to be set at
build time, and a build that missed it produces pages that render fine while
sharing badly.

## Related caveat

If you are testing on a **path** gateway (`https://gw/ipfs/<cid>/...`), be aware
that a static export references its assets absolutely as `/_next/...`, which
resolves to `https://gw/_next/...` — outside the CID — and 404s. That your home
page renders correctly suggests you're on a **subdomain** gateway
(`https://<cid>.ipfs.<gw>/`), where the CID is the origin and absolute paths
resolve correctly. That's the right way to serve this build; just don't be
surprised if a path-gateway URL looks broken for a different reason than the one
above.
