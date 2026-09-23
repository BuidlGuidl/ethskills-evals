The production path to `https://mainnet.base.org` is:

1. `scaffold.config.ts` reads:

   ```ts
   rpcOverrides: {
     [chains.base.id]: process.env.NEXT_PUBLIC_RPC_URL,
   }
   ```

2. Because this value is `NEXT_PUBLIC_*`, Next.js does not look it up from the static host at request time. During `next build`, Next loads the build environment and `.env*` files, then inlines `process.env.NEXT_PUBLIC_RPC_URL` into the client bundle. After the static build is produced, changing the host/runtime environment does not change that value.

3. On developer machines, `.env.local` or the shell has `NEXT_PUBLIC_RPC_URL`, so the local dev bundle contains the paid Base RPC URL. The wagmi config sees `scaffoldConfig.rpcOverrides[8453]` and prepends `http(paidRpcUrl)`.

4. In production, the generic static host either did not have `NEXT_PUBLIC_RPC_URL` available during `next build`, or it was added only as a runtime/deploy environment variable after the static files were built. The shipped JS therefore has the override value as `undefined`. The config still "looks right" in source, but the artifact does not contain the paid URL.

5. In `packages/nextjs/services/web3/wagmiConfig.tsx`, the Base client starts with:

   ```ts
   let rpcFallbacks = [...(chain.id === mainnet.id ? mainnetFallbackWithDefaultRPC : []), http()];
   const rpcOverrideUrl = scaffoldConfig.rpcOverrides?.[chain.id];
   ```

   For Base, if `rpcOverrideUrl` is missing, that leaves `rpcFallbacks` as `[http()]` unless another configured provider is added later.

6. A viem `http()` transport with no URL uses `chain.rpcUrls.default.http[0]`. The viem Base chain defines that default as `https://mainnet.base.org`, so production requests land on the public Base RPC and start getting 429s.

The operational check that proves the fix is real is not "the env var exists in hosting settings." It is: after a clean rebuild and redeploy, load the production site and verify in the paid RPC provider's logs/analytics that production browser traffic is hitting the paid Base endpoint, with no production browser requests to `https://mainnet.base.org`.

There is a second transport-level trap even after the env var is fixed: SE-2 prepends the override but keeps the unauthenticated fallback in the array:

```ts
rpcFallbacks = [http(rpcOverrideUrl), ...rpcFallbacks];
```

Since `rpcFallbacks` already contains bare `http()`, Base still has `http(paidRpcUrl)` followed by `http()`, which is the public Base RPC. If the paid transport fails, times out, rejects a method, or otherwise falls through, viem's `fallback(...)` can send that request to `mainnet.base.org`. The production fix should make the override authoritative, or use only explicitly approved fallback URLs, for example `[http(rpcOverrideUrl)]` for Base instead of `[http(rpcOverrideUrl), http()]`.
