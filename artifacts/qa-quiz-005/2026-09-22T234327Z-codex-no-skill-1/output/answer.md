The production path to `mainnet.base.org` is:

1. `scaffold.config.ts` sets the Base override with:

   ```ts
   rpcOverrides: {
     [chains.base.id]: process.env.NEXT_PUBLIC_RPC_URL,
   }
   ```

2. Because this is a browser-facing Next.js app, `NEXT_PUBLIC_*` is not read from the host at request time. Next inlines `process.env.NEXT_PUBLIC_RPC_URL` during `next build`, using the value visible to the build process (`process.env` / `.env*` loaded for that build). In a static build, changing the hosting environment after the artifact is built does not change the JavaScript already emitted to `_next/static`.

   That is why dev machines work: their local Next process sees `.env.local` or shell env and bakes/serves the paid RPC. Production fails when the CI/static build did not have `NEXT_PUBLIC_RPC_URL`; the emitted bundle has the override as `undefined`.

3. In `packages/nextjs/services/web3/wagmiConfig.tsx`, the client transport starts with:

   ```ts
   let rpcFallbacks = [
     ...(chain.id === mainnet.id ? [http("https://mainnet.rpc.buidlguidl.com")] : []),
     http(),
   ];
   ```

   For Base, that initial list is just `[http()]`.

4. Then it reads:

   ```ts
   const rpcOverrideUrl = scaffoldConfig.rpcOverrides?.[chain.id];
   ```

   If the build-time env was missing, `rpcOverrideUrl` is falsy, so `http(process.env.NEXT_PUBLIC_RPC_URL)` is never added.

5. With no override, the code may add an Alchemy transport, but the bare `http()` remains. With the default Scaffold-ETH Alchemy key, the order is still public first, then Alchemy. Viem's `http()` with no URL uses the chain's default RPC URL, and `viem/chains` defines Base's default as:

   ```ts
   https://mainnet.base.org
   ```

6. `createClient({ transport: fallback(rpcFallbacks) })` then sends each JSON-RPC request to the first transport. For the broken production build on Base, that means requests start at `https://mainnet.base.org`, so production traffic hits the public endpoint and gets 429s.

The operational check that proves the fix is real is to inspect the deployed artifact or live browser traffic, not the host's runtime env screen. After rebuilding with `NEXT_PUBLIC_RPC_URL` present in the build environment, verify that the deployed `_next/static` JS or the browser Network tab contains/calls the paid RPC host and no longer contains/calls `https://mainnet.base.org` for Base reads. If the built bundle still has `mainnet.base.org` as the active Base transport, the fix did not land.

The second trap is that even after the env var is fixed, `wagmiConfig.tsx` still prepends the paid URL to a fallback list that includes bare `http()`:

```ts
rpcFallbacks = [http(rpcOverrideUrl), ...rpcFallbacks];
```

For Base, that becomes effectively:

```ts
[http(PAID_BASE_RPC), http()]
```

The fallback transport is per request. If the paid RPC errors, times out, rate-limits, or lacks support for a method, viem can try the next transport, and the next transport is the chain default public RPC: `https://mainnet.base.org`. So fixing the env var only makes the paid RPC first; it does not guarantee zero public RPC traffic. If production must never touch public RPCs, remove the bare `http()` fallback for Base or replace it with another private/paid Base endpoint.
