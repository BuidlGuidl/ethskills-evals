The source config can be correct and production can still hit `https://mainnet.base.org` because `NEXT_PUBLIC_*` is a build-time input for a static Next.js deploy.

On a developer machine, `next dev` loads `.env.local`, so:

```ts
rpcOverrides: {
  [chains.base.id]: process.env.NEXT_PUBLIC_RPC_URL,
}
```

evaluates with the paid RPC URL present. Wagmi sees a truthy Base override and puts that URL first.

On a generic static production host, there is no runtime server reading `process.env` for the already-built client bundle. `NEXT_PUBLIC_*` values are taken from the environment of the `next build` process and inlined/frozen into the JS that gets uploaded. If `NEXT_PUBLIC_RPC_URL` exists on laptops but was missing from the build environment, or was added to hosting after the static build was produced, the production bundle effectively contains:

```ts
rpcOverrides: {
  [8453]: undefined,
}
```

Then `packages/nextjs/services/web3/wagmiConfig.tsx` does this:

```ts
let rpcFallbacks = [...(chain.id === mainnet.id ? mainnetFallbackWithDefaultRPC : []), http()];

const rpcOverrideUrl = scaffoldConfig.rpcOverrides?.[chain.id];

if (rpcOverrideUrl) {
  rpcFallbacks = [http(rpcOverrideUrl), ...rpcFallbacks];
} else {
  const alchemyHttpUrl = getAlchemyHttpUrl(chain.id);
  ...
}

transport: fallback(rpcFallbacks)
```

For Base, a missing override means the only built-in transport at the front is bare `http()`. In viem, `http()` with no URL uses the chain's default RPC URL. For `chains.base`, that default is the public Base RPC, `https://mainnet.base.org`. So the production path is:

`static build env missing NEXT_PUBLIC_RPC_URL` -> `client bundle has undefined Base override` -> `wagmiConfig` treats it as no override -> `rpcFallbacks` starts with bare `http()` -> viem resolves that to Base's default public RPC -> production users generate 429s from `mainnet.base.org`.

The operational check that settles whether the fix is real is to verify the deployed production artifact is actually sending Base JSON-RPC traffic to the paid endpoint. Do this after a fresh rebuild/redeploy with the env var present in the build environment: open the production site or run a synthetic check against it, then confirm in the browser network log and/or paid RPC provider dashboard that chain 8453 requests from the production origin are hitting the paid RPC and that no requests go to `https://mainnet.base.org`. Source code or hosting env screens alone do not prove it for a static build.

There is a second transport-level trap even after `NEXT_PUBLIC_RPC_URL` is fixed. The override does not replace the public transport; it prepends the paid RPC to the existing fallback list:

```ts
rpcFallbacks = [http(rpcOverrideUrl), ...rpcFallbacks];
```

For Base, that leaves `http()` behind the paid RPC, and `http()` still means Base's public default RPC. If the paid RPC has a transport failure, timeout, or retryable 429/5xx, viem's `fallback(...)` can try the next transport and send those requests to `mainnet.base.org` anyway. For production, the Base transport should be made exclusive to approved RPCs, for example `rpcFallbacks = [http(rpcOverrideUrl)]` for chains with required overrides, or a fallback list containing only paid/private endpoints.
