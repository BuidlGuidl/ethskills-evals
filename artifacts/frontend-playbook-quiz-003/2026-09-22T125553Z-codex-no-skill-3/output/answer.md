# Why `/debug` 404s on IPFS

The upload is a plain static directory:

```text
out/
  index.html
  debug.html
  404.html
  _next/
```

An IPFS HTTP gateway resolves URL paths as filesystem paths inside the uploaded
UnixFS directory. It does not apply Next.js-style route matching, and it does
not normally rewrite `/debug` to `/debug.html`.

So these requests behave differently:

```text
/ipfs/<cid>/        -> directory root -> gateway serves index.html
/ipfs/<cid>/debug   -> looks for an entry named debug -> not found -> 404
/ipfs/<cid>/debug.html -> looks for debug.html -> found
```

The home page works because `/` maps to the root directory and gateways know how
to serve that directory's `index.html`. The `/debug` route fails because the
directory contains `debug.html`, but the requested path is `debug`.

# Next config fix

Configure the static export to emit each route as a directory with its own
`index.html`:

```js
// next.config.js
const nextConfig = {
  output: "export",
  trailingSlash: true,
};

module.exports = nextConfig;
```

Or, if the project uses ESM:

```js
// next.config.mjs
const nextConfig = {
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
```

In a Scaffold-ETH 2 app, make the same change in the Next app's
`next.config.js`, `next.config.mjs`, or `next.config.ts`, whichever the project
uses.

# What `out/` looks like after

After rebuilding with `trailingSlash: true`, the export should look like this:

```text
out/
  index.html
  debug/
    index.html
  404.html
  _next/
```

For additional routes, the same pattern applies:

```text
out/
  blockexplorer/
    index.html
  example-ui/
    index.html
```

Now a gateway request for `/ipfs/<cid>/debug` resolves to a real directory named
`debug`. The gateway may redirect to `/ipfs/<cid>/debug/`, then serves
`debug/index.html`.

# Verify before re-uploading

First rebuild the static export:

```sh
yarn build
```

Then verify that the route files exist as directory indexes:

```sh
test -f out/index.html
test -f out/debug/index.html
test -f out/404.html
```

You can also inspect the top-level layout:

```sh
find out -maxdepth 3 -type f | sort | sed -n '1,80p'
```

Finally, test the routing with a simple static file server that behaves like a
filesystem server:

```sh
python3 -m http.server 8080 --directory out
```

In another shell:

```sh
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/debug
curl -I http://127.0.0.1:8080/debug/
```

The important result is that `/debug` should no longer be a missing file. It
should either return `200 OK` directly or redirect to `/debug/`, and
`/debug/` should return `200 OK`.
