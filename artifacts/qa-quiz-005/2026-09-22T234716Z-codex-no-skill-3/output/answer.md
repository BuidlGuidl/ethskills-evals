The production path to `https://mainnet.base.org` is:

1. `scaffold.config.ts` sets the Base override from `process.env.NEXT_PUBLIC_RPC_URL`:

   ```ts
   rpcOverrides: {
     [chains.base.id]: process.env.NEXT_PUBLIC_RPC_URL,
   }
   ```

2. Because this is a static Next.js build, that value is decided when `next build` runs. `NEXT_PUBLIC_*` variables are bundled into the browser JS at build time from the build environment, for example CI/build-host env or `.env*` files available to that build. The deployed static host's runtime environment does not fill this in later. If the generic hosting platform has `NEXT_PUBLIC_RPC_URL` only as a runtime setting, or the CI build did not have it, the compiled production bundle has the override as `undefined`/missing.

3. On developer machines, `.env.local` is present when Next runs, so the override is truthy and wagmi gets `http(paidRpcUrl)` first. That is why local traffic uses the paid RPC.

4. In `packages/nextjs/services/web3/wagmiConfig.tsx`, SE-2 builds the transports like this:

   ```ts
   let rpcFallbacks = [...(chain.id === mainnet.id ? mainnetFallbackWithDefaultRPC : []), http()];

   const rpcOverrideUrl = scaffoldConfig.rpcOverrides?.[chain.id];

   if (rpcOverrideUrl) {
     rpcFallbacks = [http(rpcOverrideUrl), ...rpcFallbacks];
   }

   transport: fallback(rpcFallbacks)
   ```

   For Base, if the override is missing, the list is just `http()` plus any non-override branch additions. A bare viem `http()` uses `chain.rpcUrls.default.http[0]`. For `chains.base`, that default is `https://mainnet.base.org`, so production users hit the public Base RPC and get 429s.

The operational check that settles whether the fix is real is production traffic, not config appearance: load the deployed production artifact and verify in browser Network logs, edge logs, or the paid RPC provider dashboard that JSON-RPC calls go to the paid Base endpoint and that there are zero calls to `https://mainnet.base.org` for the normal app paths. This proves the variable was present during the actual build users are running.

The second trap is that fixing the env var still does not make the paid RPC exclusive. With the override present, `wagmiConfig.tsx` creates:

```ts
[http(process.env.NEXT_PUBLIC_RPC_URL), http()]
```

wrapped in viem `fallback(...)`. If the paid transport errors or times out, viem can try the next transport, and that next transport is still the chain default public RPC. For Base, that means `mainnet.base.org` can still receive some requests. The production fix is to remove the bare `http()` for Base or replace it with only approved private fallback URLs.
