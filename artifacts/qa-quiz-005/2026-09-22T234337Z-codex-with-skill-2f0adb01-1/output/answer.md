# Why production is hitting `mainnet.base.org`

The config is only correct if `NEXT_PUBLIC_RPC_URL` exists when `next build` runs.

Next.js does not read `NEXT_PUBLIC_*` variables from the browser or from a static host at request time. For client code, it resolves them during the build, using `process.env` and the project `.env*` files, then inlines the value into the emitted JavaScript bundle. After the static build is produced, changing `NEXT_PUBLIC_RPC_URL` in the hosting runtime environment does not change the already-built app.

So the failure chain is:

1. Developers have `NEXT_PUBLIC_RPC_URL` in their local env, usually `.env.local`, so `process.env.NEXT_PUBLIC_RPC_URL` is defined while running/building locally.
2. The production static build was created without that variable in the build environment, or with it only configured as a hosting/runtime env var after the artifact was built.
3. During `next build`, this:

   ```ts
   rpcOverrides: {
     [chains.base.id]: process.env.NEXT_PUBLIC_RPC_URL,
   }
   ```

   becomes an override whose Base value is missing/`undefined` in the client bundle.
4. In `packages/nextjs/services/web3/wagmiConfig.tsx`, Scaffold-ETH builds transports like this:

   ```ts
   let rpcFallbacks = [...(chain.id === mainnet.id ? mainnetFallbackWithDefaultRPC : []), http()];
   const rpcOverrideUrl = scaffoldConfig.rpcOverrides?.[chain.id];

   if (rpcOverrideUrl) {
     rpcFallbacks = [http(rpcOverrideUrl), ...rpcFallbacks];
   }
   ```

5. Because the Base override is absent, `http(rpcOverrideUrl)` is never added. The remaining Base transport is `http()` with no URL.
6. viem's `http()` transport without a URL uses `chain.rpcUrls.default.http[0]`. For `viem/chains` Base, that default public RPC is `https://mainnet.base.org`.
7. Production browsers therefore send JSON-RPC reads to `mainnet.base.org`, and public Base rate limits show up as 429s.

# The operational check

The check that settles it is not "is the env var present in the hosting dashboard?" It is: after a fresh production rebuild and deploy, watch real production browser traffic or the paid RPC provider dashboard and confirm Base JSON-RPC calls are going to the paid RPC host, with no calls to `https://mainnet.base.org`.

If the paid provider shows no production traffic, the variable was not present at build time or the deployed artifact is stale.

# The second transport trap

Even after `NEXT_PUBLIC_RPC_URL` is correctly baked into the bundle, the current `wagmiConfig.tsx` still keeps public RPCs in the transport list:

```ts
rpcFallbacks = [http(rpcOverrideUrl), ...rpcFallbacks];
```

For Base, `...rpcFallbacks` still includes bare `http()`, which resolves to `https://mainnet.base.org`. Since the final transport is `fallback(rpcFallbacks)`, viem will try the next transport when the paid RPC transport errors, times out, or is considered unavailable. That means some production requests can still go to the public Base RPC as a fallback.

If production must never touch public RPCs, do not leave bare `http()` in the fallback list for Base. Build the Base transport as only the paid endpoint, or only explicit private fallback endpoints that ops owns and monitors.
