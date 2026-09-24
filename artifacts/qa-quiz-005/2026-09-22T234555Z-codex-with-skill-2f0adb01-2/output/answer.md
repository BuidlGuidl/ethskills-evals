The production path to `mainnet.base.org` is:

1. `scaffold.config.ts` reads `process.env.NEXT_PUBLIC_RPC_URL` inside `rpcOverrides`.
2. Because this is a static Next.js deployment, that value is not read from the hosting runtime when a user loads the site. `NEXT_PUBLIC_*` values are substituted into the browser bundle during `next build`. If `NEXT_PUBLIC_RPC_URL` was present in developers' `.env.local` but absent from the production build environment, the deployed bundle was built with that expression as `undefined`.
3. In `packages/nextjs/services/web3/wagmiConfig.tsx`, the Base client starts with `rpcFallbacks = [http()]`.
4. `const rpcOverrideUrl = scaffoldConfig.rpcOverrides?.[chain.id]` is therefore falsy for Base, so the override branch is skipped.
5. For `http()` with no URL, viem uses the chain's default public RPC URL. For `chains.base`, that default is `https://mainnet.base.org`.
6. SE-2 may also append an Alchemy URL from `alchemyApiKey`, but when using the default Scaffold-ETH key it deliberately keeps the default `http()` first. So Base reads hit `mainnet.base.org` first and only fall through later.

The operational check that proves the fix is real is the live production browser network trace, not the hosting settings page. Load the deployed static app after a fresh rebuild/cache purge, trigger the Base reads, and verify that JSON-RPC POSTs go to the paid RPC host and that there are zero requests to `https://mainnet.base.org`. The paid provider's request logs for that production origin should agree.

There is a second trap in `wagmiConfig.tsx`: even when `NEXT_PUBLIC_RPC_URL` is correctly baked into the bundle, the override only prepends the paid transport:

```ts
rpcFallbacks = [http(rpcOverrideUrl), ...rpcFallbacks];
```

Since `rpcFallbacks` already contains the bare `http()`, the public Base RPC remains in the fallback transport. If the paid RPC times out, errors, or is considered retryable by viem's fallback transport, some requests can still be replayed to `mainnet.base.org`. The fix is to remove the public `http()` fallback for production Base, or replace it with another paid endpoint, so the fallback set contains only approved RPC hosts.
