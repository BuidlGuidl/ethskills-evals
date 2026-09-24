The production path to `https://mainnet.base.org` is:

1. `scaffold.config.ts` reads `process.env.NEXT_PUBLIC_RPC_URL` inside `rpcOverrides`.
2. Because this is a client/static Next.js build, `NEXT_PUBLIC_*` values are not read from the hosting runtime after upload. Next.js substitutes them during `next build` into the browser bundle. Local developer machines work because their shell or `.env.local` has `NEXT_PUBLIC_RPC_URL` at build/dev time. The generic static host does not magically provide that value unless it is present in the build environment that produced the static assets.
3. In the production build where that variable was absent, the bundle effectively contains an undefined/falsy Base override:

   ```ts
   rpcOverrides: {
     [chains.base.id]: undefined,
   }
   ```

4. `packages/nextjs/services/web3/wagmiConfig.tsx` reads the override with something like:

   ```ts
   const rpcOverrideUrl = scaffoldConfig.rpcOverrides?.[chain.id];
   ```

   Since the Base override is falsy, the configured paid `http(rpcOverrideUrl)` transport is not used.

5. The default SE-2 transport list still includes a bare viem transport:

   ```ts
   http()
   ```

   In viem, `http()` with no URL uses the selected chain's default public RPC URL. For Base mainnet, that chain default is `https://mainnet.base.org`, so production browser reads land on the public Base RPC and start getting 429s.

The operational check that settles whether the fix is real is not "the code references `process.env.NEXT_PUBLIC_RPC_URL`." It is: confirm the production build environment actually has `NEXT_PUBLIC_RPC_URL` set before `next build`, then inspect the built/deployed browser bundle or network traffic and verify the paid RPC hostname is present and `mainnet.base.org` is absent. On platforms with env inspection, the equivalent check is `env ls`/dashboard for the build environment plus a fresh rebuild and redeploy.

The second trap is also in `wagmiConfig.tsx`: even after the env var is fixed, SE-2's fallback array commonly remains:

```ts
rpcFallbacks = [http(rpcOverrideUrl), ...rpcFallbacks]
```

where the existing `rpcFallbacks` already contains bare `http()`. That means the paid RPC is first, but the public chain RPC is still a configured fallback. If the paid endpoint errors, times out, lacks a method, or a fallback/ranking setup probes alternates, some requests can still hit `https://mainnet.base.org`. For a production app that must never touch public RPCs, remove the bare `http()` fallback for Base and leave only explicit, intended RPC URLs.
