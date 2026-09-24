# Why production lands on `mainnet.base.org` while dev doesn't

## 1. The chain, end to end

**Step 1 — `NEXT_PUBLIC_*` is a build-time constant, not a runtime lookup.**
Next.js does not read `process.env` in the browser. During `next build`, webpack's
DefinePlugin performs a *textual* substitution on every literal occurrence of
`process.env.NEXT_PUBLIC_RPC_URL` in code that reaches a client bundle, replacing it
with the JSON-serialized value present **in the shell that ran the build**. Two
consequences that matter here:

- If the variable is absent at build time, the expression is inlined as the literal
  `undefined` — permanently baked into the chunk. It is not "looked up later and
  found missing"; there is nothing left to look up.
- The substitution is literal-only. `process.env[key]`, destructuring
  (`const { NEXT_PUBLIC_RPC_URL } = process.env`), or passing `process.env` around
  are not rewritten and yield `undefined` in the browser regardless of the build env.

`scaffold.config.ts` is imported by client components, so it is a client bundle and
its `rpcOverrides` value is frozen at build time along with everything else.

**Step 2 — where the dev/prod divergence comes from.**
Developers have `packages/nextjs/.env.local`, which is gitignored and never uploaded.
`yarn start` (dev server) reads it, so the override is a real URL on every dev machine.
The production build runs somewhere that file doesn't exist — CI, a build container, a
`yarn build` on a host where the value was only ever entered into a *runtime* env
settings panel. The build therefore emits `undefined`.

**Step 3 — static export removes the last chance to recover.**
The deploy is a static Next.js build on generic hosting: no Node server, no
`getServerSideProps`, no runtime env injection, no edge middleware. Whatever the
bundle says is what ships. Setting `NEXT_PUBLIC_RPC_URL` in the host's environment
after the fact changes nothing, because nothing on the host executes at request time;
it only takes effect through a **new build followed by a new deploy**. This is the
single most common shape of this bug: the variable *is* set correctly in the
dashboard, and is still `undefined` in the served JavaScript.

**Step 4 — what the config object then looks like.**

```ts
rpcOverrides: { [chains.base.id]: undefined }   // key present, value undefined
```

The key exists, so the config "looks right" on inspection of the source. SE-2 guards
with a truthiness check (`if (rpcOverrideUrl) { ... }`), so this falls to the else
branch.

**Step 5 — what the transport does with no override.**
In `packages/nextjs/services/web3/wagmiConfig.tsx`, the wagmi `client({ chain })`
factory builds a fallback array. With no override and no non-default Alchemy key, it
is effectively `fallback([http()])`. Bare `http()` with no URL argument is viem's
"use the chain's own default" mode: it resolves to
`chain.rpcUrls.default.http[0]`, which for `base` is **`https://mainnet.base.org`**.

That is the landing point. Every read, every `useScaffoldReadContract`, every
`watchBlockNumber`/polling tick from every production visitor hits a single shared
public endpoint, and the aggregate trips its rate limit → 429.

The polling interval compounds it: SE-2 sets `pollingInterval` for non-Hardhat chains,
and wagmi/viem block-watching plus per-hook contract reads multiply the request count
per user per minute. Public-endpoint limits that are invisible for one developer are
saturated by modest concurrent traffic.

## 2. The one operational check that settles it

**Grep the deployed JavaScript for the paid RPC host.**

Against the artifact actually being served — not the repo, not the dashboard:

```bash
# locally, against the build output
grep -r "your-paid-rpc-host" packages/nextjs/.next/static/chunks/ | head

# or against production, which is the authoritative version
curl -s https://your-app.example/_next/static/chunks/<main-chunk>.js | grep -o 'your-paid-rpc-host[^"]*'
```

If the hostname (or the API key path segment) appears, the value was inlined and the
fix is real. If it does not appear — or you find `rpcOverrides` sitting next to a bare
`undefined`/`void 0` — the build environment still lacked the variable and nothing you
change at runtime will help.

This check is decisive because it interrogates the only artifact that matters and
bypasses every intermediate belief (the `.env` file, the CI secret, the host's env
panel, the source code). It is also the check that catches the most likely failed fix:
setting the variable and *not* triggering a fresh build, which leaves the old chunk
hash — and the old baked `undefined` — being served. Confirm the chunk hash changed,
or that the deploy is newer than the env change.

## 3. The second, transport-level trap

Even once `NEXT_PUBLIC_RPC_URL` is correctly inlined, `wagmiConfig.tsx` keeps a public
RPC in the rotation:

```ts
let rpcFallbacks = [http()];
const rpcOverrideUrl = scaffoldConfig.rpcOverrides?.[chain.id];
if (rpcOverrideUrl) {
  rpcFallbacks = [http(rpcOverrideUrl), http()];   // <-- bare http() still here
} else {
  const alchemyHttpUrl = getAlchemyHttpUrl(chain.id);
  if (alchemyHttpUrl) {
    const isUsingDefaultKey = scaffoldConfig.alchemyApiKey === DEFAULT_ALCHEMY_API_KEY;
    rpcFallbacks = isUsingDefaultKey
      ? [http(), http(alchemyHttpUrl)]             // <-- public FIRST, by design
      : [http(alchemyHttpUrl), http()];
  }
}
return createClient({ chain, transport: fallback(rpcFallbacks), ... });
```

Two distinct hazards:

**(a) The bare `http()` survives the override.** The fallback array is
`[paid, public]`, never `[paid]`. viem's `fallback` transport silently rotates to the
next transport on any error the paid endpoint returns — a 429 of its own, a 5xx, a
timeout, a transient network blip, or an unsupported method (`eth_getLogs` range
limits, archive-depth `eth_call`, tracing methods). Worse, viem's fallback does not
merely retry once: after a transport errors it is marked down and **subsequent
requests skip it for a cooldown window**, so one bad minute on the paid provider
migrates a slice of production traffic onto `mainnet.base.org` and keeps it there.
The 429s therefore do not necessarily vanish after the env fix — they shrink and
become bursty and correlated with paid-provider hiccups, which reads as "the fix
partly worked" and is easy to misattribute.

**(b) The default-Alchemy-key branch deliberately puts the public RPC first.** If the
override is empty for any chain but `alchemyApiKey` is still the shipped SE-2 demo key,
`isUsingDefaultKey` is true and the order becomes `[http(), http(alchemy)]` — public
endpoint as the *primary*. This is intentional upstream (don't hammer the shared demo
key) and is exactly wrong for production. Note it is keyed on the Alchemy key, not on
the override, so it can bite a chain you weren't thinking about.

Also note this is per-chain: `rpcOverrides` is a map, so any chain in `targetNetworks`
without its own entry gets the public default independently. And
`wagmiConnectors`/RainbowKit and any wallet-injected provider are separate transports
that this config does not govern at all.

**Fix for (b)/(a):** drop the bare `http()` for chains where you have a paid endpoint —
`fallback([http(primaryUrl), http(secondaryPaidUrl)])`, i.e. make the *second* entry a
different paid provider rather than the public one — or use `http(url)` directly with
no `fallback` and let failures surface as errors you can alarm on. Silent degradation
to a public endpoint is the property to remove; a visible failure is preferable to an
invisible migration onto a rate-limited shared host. If you keep a fallback, set an
explicit `retryCount`/`timeout` on the primary so a slow-but-working paid endpoint
isn't demoted, and monitor per-transport request counts rather than only 429 rates.
