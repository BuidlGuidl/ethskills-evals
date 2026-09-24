# Fixing Next static exports on IPFS gateways

The uploaded directory is a valid Next static export, but it is shaped for a host that can rewrite pretty URLs:

```text
out/
  index.html
  debug.html
  404.html
  _next/
```

An IPFS HTTP gateway does not behave like a typical web server with `try_files $uri $uri.html $uri/`. It resolves the request path as a UnixFS path inside the CID.

For example, given `https://gateway.example/ipfs/<CID>/debug`, the gateway looks for a child named `debug` at the root of the uploaded directory. It does not guess `debug.html`, and it usually cannot apply app-specific rewrites. Since the export contains `debug.html` but not `debug` or `debug/index.html`, the path `/debug` misses and the gateway returns 404.

The home page still works because `/ipfs/<CID>/` resolves to the root directory itself. For directory requests, gateways commonly serve the directory index, so `out/index.html` is found and returned. That special directory-index behavior helps `/`, but it does not make `/debug` map to `/debug.html`.

The fix is to make exported routes directory indexes instead of sibling `.html` files. In `next.config.js` or `next.config.ts`, keep the static export setting and add `trailingSlash: true`:

```js
/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
};

module.exports = nextConfig;
```

If the app already has other Scaffold-ETH 2 or Next settings, merge this into the existing object rather than replacing the file.

After rebuilding, `out/` should look more like this:

```text
out/
  index.html
  debug/
    index.html
  404.html
  _next/
```

Nested routes follow the same pattern:

```text
out/
  blockexplorer/
    index.html
  blockexplorer/
    transaction/
      index.html
```

Now a gateway request for `/debug/` resolves to the `debug` directory and serves `debug/index.html`. Requests to `/debug` may redirect to `/debug/` depending on the gateway and URL form, but the route is now represented in the file tree in the way static directory hosts understand.

Before re-uploading to IPFS, rebuild and verify the file layout:

```sh
yarn build
find out -maxdepth 3 -type f | sort
test -f out/index.html
test -f out/debug/index.html
test -f out/404.html
```

Then serve the exact `out/` directory locally without Next:

```sh
npx serve out
```

In another terminal, check the routes as static files:

```sh
curl -I http://localhost:3000/
curl -I http://localhost:3000/debug/
curl -I http://localhost:3000/404.html
```

If `serve` chooses a different port, use the port it prints. A stronger IPFS-like check is to request the slash form and confirm it returns HTML:

```sh
curl -fsS http://localhost:3000/debug/ | head
```

Do not rely on `http://localhost:3000/debug.html` passing; that is the old shape. The route that needs to work through the gateway is `/debug/`, backed by `out/debug/index.html`.

Reference: Next.js documents that `trailingSlash: true` with `output: "export"` emits `/about/index.html` instead of `/about.html`: https://nextjs.org/docs/app/api-reference/config/next-config-js/trailingSlash
