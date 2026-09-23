The production path to `mainnet.base.org` is:

1. `scaffold.config.ts` reads:

   ```ts
   rpcOverrides: {
     [chains.base.id]: process.env.NEXT_PUBLIC_RPC_URL,
   }
   ```

2. Because this is a client/static Next.js build, `NEXT_PUBLIC_*` is not read dynamically by the deployed static files. Next.js inlines the value that exists when `next build` runs. Local dev works because `next dev` sees the developer's `.env.local` or shell env. Production only gets the paid RPC if `NEXT_PUBLIC_RPC_URL` is present in the hosting provider's build environment before the static artifact is built. Setting it later as a runtime env var for generic static hosting does not change the already-built JS.

3. If `NEXT_PUBLIC_RPC_URL` was absent or empty during the production build, the built bundle effectively contains:

   ```ts
   rpcOverrides: {
     [8453]: undefined,
   }
   ```

4. In `packages/nextjs/services/web3/wagmiConfig.tsx`, the Base client then evaluates:

   ```ts
   let rpcFallbacks = [http()];
   const rpcOverrideUrl = scaffoldConfig.rpcOverrides?.[chain.id];
   ```

   Since the override is falsy, it does not prepend the paid RPC. The config falls through to the default fallback transport. A bare viem `http()` with no URL uses the chain's default RPC URL. For `chains.base`, that default is `https://mainnet.base.org`. That is how production reads land on the public Base endpoint and get 429s even though the source config looks correct.

The operational check that settles whether the fix is real: after a clean rebuild and redeploy, the paid RPC provider's logs/dashboard must show production browser traffic for Base. Do not stop at "the env var exists in the host UI" or "the source code has `process.env.NEXT_PUBLIC_RPC_URL`"; the static bundle has to be rebuilt with that value, and the paid provider seeing live production requests is the proof.

There is a second trap in `wagmiConfig.tsx`: even when the override is present, the code keeps the bare public transport in the fallback list:

```ts
let rpcFallbacks = [http()];
if (rpcOverrideUrl) {
  rpcFallbacks = [http(rpcOverrideUrl), ...rpcFallbacks];
}
return createClient({ transport: fallback(rpcFallbacks), ... });
```

So for Base the effective transport becomes:

```ts
fallback([http(process.env.NEXT_PUBLIC_RPC_URL), http()])
```

The first transport is the paid RPC, but the second is still Base's public `https://mainnet.base.org`. If the paid RPC errors, times out, is regionally flaky, or otherwise fails a request, viem's `fallback` transport can try the next transport. That means some production requests can still hit the public endpoint after the env var is fixed. For production, remove the bare `http()` fallback for Base or replace it with another authenticated RPC, so every fallback target is an endpoint you operate and monitor.
