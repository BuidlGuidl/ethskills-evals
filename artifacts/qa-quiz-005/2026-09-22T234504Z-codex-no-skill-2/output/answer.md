Production is not using the paid RPC because `NEXT_PUBLIC_RPC_URL` is only a build-time input for a static Next.js app.

The chain is:

1. `scaffold.config.ts` is bundled into the Next.js client code. Its Base override is:

   ```ts
   rpcOverrides: {
     [chains.base.id]: process.env.NEXT_PUBLIC_RPC_URL,
   }
   ```

2. On developer machines, `.env.local` is present when `next dev` or `next build` runs, so Next replaces `process.env.NEXT_PUBLIC_RPC_URL` with the paid RPC URL in the browser bundle. The app therefore has a truthy Base override.

3. On the static production deploy, the generic host's runtime environment does not matter. There is no Next server reading env vars per request, and the browser cannot read the host environment. `NEXT_PUBLIC_*` values are inlined during `next build`, so the value used is whatever existed in the build environment. If `NEXT_PUBLIC_RPC_URL` was absent during the production build, the deployed JS contains `undefined` or no usable URL for that override.

4. `packages/nextjs/services/web3/wagmiConfig.tsx` then builds the viem client. For each chain it starts with fallback transports:

   ```ts
   let rpcFallbacks = [
     ...(chain.id === mainnet.id ? mainnetFallbackWithDefaultRPC : []),
     http(),
   ];
   ```

   For Base, the mainnet-only extra fallback is not included, so the starting list is just `http()`.

5. It reads:

   ```ts
   const rpcOverrideUrl = scaffoldConfig.rpcOverrides?.[chain.id];
   ```

   If the production bundle baked in no `NEXT_PUBLIC_RPC_URL`, this is falsy, so `http(rpcOverrideUrl)` is not prepended.

6. With no override, wagmi/viem keeps the bare `http()` transport. A bare viem `http()` uses the configured chain's default RPC URL. The viem Base chain definition has:

   ```ts
   rpcUrls.default.http = ["https://mainnet.base.org"]
   ```

   So production Base reads, polling, multicalls, etc. land on `https://mainnet.base.org`, which explains the public-RPC 429s.

The operational check that settles whether the fix is real: inspect a real production page load after redeploy and verify the browser's Network tab, or the paid provider logs, shows Base JSON-RPC POSTs going to the paid RPC host and zero requests to `https://mainnet.base.org`. Checking that the hosting UI has `NEXT_PUBLIC_RPC_URL` set is not enough; it must have been present for the build that produced the deployed static assets.

There is also a second trap in `wagmiConfig.tsx`: even after the env var is fixed, the override is only prepended to the fallback list:

```ts
rpcFallbacks = [http(rpcOverrideUrl), ...rpcFallbacks];
```

`...rpcFallbacks` still contains the bare `http()`, so the public Base RPC remains a fallback transport. If the paid RPC errors, times out, rate limits, or does not support a method, viem's fallback transport can try the next transport and send that request to `mainnet.base.org`. For a production app that must never touch public RPCs, the Base transport list should contain only the paid RPC and any explicitly approved private backup RPCs, not the default `http()`.
