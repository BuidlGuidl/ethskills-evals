# Why production hits `mainnet.base.org` while dev machines don't

## The chain, link by link

**1. `NEXT_PUBLIC_*` is a build-time substitution, not a runtime lookup.**
Next.js does not read `process.env` in the browser — there is no `process` there.
At `next build`, the compiler statically replaces every literal occurrence of
`process.env.NEXT_PUBLIC_RPC_URL` in client code with the string value present
*in the environment of the build process*, and that literal is baked into the JS
chunks. So the value is frozen at the moment the bundle is compiled, on whatever
machine compiled it.

**2. Dev machines have the value; the build host doesn't.**
Locally, `packages/nextjs/.env.local` is loaded by `yarn start`, so the paid URL
is inlined and everything works — which is exactly why this is invisible in dev.
`.env.local` is gitignored and never reaches CI. On the host, the variable is
typically either (a) never set, (b) set only in the *runtime* environment of a
generic static host — which cannot matter, because a static export serves
pre-built files and no server evaluates env at request time, (c) set in the wrong
scope (preview vs. production, wrong project), or (d) set *after* the last build.
In every case the compiler saw `undefined` and inlined `undefined`.

**3. `scaffold.config.ts` therefore ships as `rpcOverrides: { 8453: undefined }`.**
The key exists; the value is falsy. The config "looks right" in the repo because
you are reading source, not the shipped artifact.

**4. `wagmiConfig.tsx` silently degrades to the public endpoint.**
The per-chain `client({ chain })` factory does roughly:

```ts
let rpcFallbacks = [http()];                       // <- bare http(), no URL
const rpcOverrideUrl = scaffoldConfig.rpcOverrides?.[chain.id];
if (rpcOverrideUrl) {
  rpcFallbacks = [http(rpcOverrideUrl), http()];
} else {
  const alchemyHttpUrl = getAlchemyHttpUrl(chain.id);
  if (alchemyHttpUrl) {
    const isUsingDefaultKey = scaffoldConfig.alchemyApiKey === DEFAULT_ALCHEMY_API_KEY;
    rpcFallbacks = isUsingDefaultKey
      ? [http(), http(alchemyHttpUrl)]             // public FIRST
      : [http(alchemyHttpUrl), http()];
  }
}
return createClient({ chain, transport: fallback(rpcFallbacks), ... });
```

`http()` with no argument is the critical part: viem falls back to
`chain.rpcUrls.default.http[0]`, which for `base` is **`https://mainnet.base.org`**.
There is no error, no warning — a missing override is indistinguishable from a
deliberate choice to use the chain's public default.

With the override `undefined`, control goes to the `else` branch. If
`alchemyApiKey` is still SE-2's shared `DEFAULT_ALCHEMY_API_KEY` (the usual case
when someone is using `rpcOverrides` instead), the order is deliberately
`[http(), http(alchemy)]` — public endpoint *first*, by design, so the demo key
isn't burned. So **100% of steady-state traffic** goes to `mainnet.base.org`, and
`pollingInterval` multiplies it by every mounted `useScaffoldReadContract` and
block watcher across every live session. Hence 429s in prod only.

## The one operational check that settles it

**Grep the deployed JS bundle for the RPC hostname.** The source is irrelevant;
only the artifact is evidence:

```bash
# against the built output
grep -r "your-paid-rpc-host" packages/nextjs/.next/static/chunks | head
# or against what's actually live
curl -s https://your-app.example/_next/static/chunks/<main>.js | grep -c "your-paid-rpc-host"
```

Zero hits — or a hit on `rpcOverrides:{8453:void 0}` — proves the variable was
absent at build time. A non-zero hit proves the fix landed. Confirm in the
browser's Network panel that no request goes to `mainnet.base.org`.

The corollary: because this is a build-time inline, **setting the variable on the
host is not the fix — you must set it in the build environment and redeploy.**
A restart, a cache purge, or a runtime env change does nothing.

## The second, transport-level trap

Fixing the env var does not remove the public endpoint from the transport. The
override branch still builds `fallback([http(rpcOverrideUrl), http()])` — the
bare public `http()` remains as entry two. viem's `fallback` fails over on any
transport error, including **429, 5xx, and timeouts**. So the moment the paid RPC
rate-limits, blips, or times out, every subsequent request quietly lands on
`mainnet.base.org` — and since a rate-limit spike is precisely when traffic is
heaviest, the failover kicks in exactly when it hurts most. The 429s get quieter
but never disappear, and nothing in the UI reports the demotion.

Two concrete consequences of "some requests," both in this same factory:

- **Failover spillover** — as above; a fraction of prod traffic rides the public
  endpoint permanently, proportional to paid-RPC error rate.
- **The auto-injected mainnet chain** — `enabledChains` appends `mainnet` to
  `targetNetworks` when chain 1 isn't already there, so ENS name and avatar
  resolution behind `<Address/>` and `<AddressInput/>` runs on chain 1. Your
  `rpcOverrides` only keys `chains.base.id`, so chain 1 takes the `else` branch
  and resolves through the public mainnet default (or the shared demo Alchemy
  key). Every address rendered on the page is a public-RPC call, no matter how
  correct the Base override is.

**Fix both:** add a mainnet entry to `rpcOverrides` (`[chains.mainnet.id]:
process.env.NEXT_PUBLIC_MAINNET_RPC_URL`), set a real `alchemyApiKey` so the
default-key branch can't prioritize the public endpoint, and either drop the bare
`http()` from the fallback array or replace it with a second *paid* provider so
failover degrades to another authenticated endpoint rather than to
`mainnet.base.org`.
