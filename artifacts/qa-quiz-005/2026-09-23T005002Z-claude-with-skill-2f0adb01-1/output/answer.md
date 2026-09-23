# Why production hits `mainnet.base.org` while dev machines don't

The config isn't wrong. The value it reads is missing at the only moment it
could ever have been read.

## The chain, step by step

**1. `NEXT_PUBLIC_*` is a build-time substitution, not a runtime lookup.**

Next.js does not ship `process.env` to the browser. During `next build`, the
compiler performs a textual find-and-replace on every *static* occurrence of
`process.env.NEXT_PUBLIC_FOO` in client-bundled code, substituting the literal
string that was in the build process's environment. What lands in the JS
chunk is a baked constant:

```js
rpcOverrides: { 8453: "https://base-mainnet.g.alchemy.com/v2/abc123" }
```

Two consequences that matter here:

- The value is frozen at build time. Setting the variable on the host *after*
  the build — or in a runtime-only env panel — changes nothing. A static export
  has no server process left to read it.
- Only exact static member accesses are inlined. `const { NEXT_PUBLIC_RPC_URL }
  = process.env` or `process.env[key]` are **not** substituted and evaluate to
  `undefined` in the browser regardless of how the host is configured.

**2. The build environment didn't have the variable.**

Developer machines have `packages/nextjs/.env.local`, which `next dev` and a
local `next build` both load automatically. `.env.local` is gitignored, so it
never reaches the CI/build container. Generic hosting ("upload this `out/`
directory") typically builds either in a CI job with its own env, or on a
developer's laptop — and the variable was only ever present in the latter.
Result in the shipped bundle:

```js
rpcOverrides: { 8453: undefined }
```

The key exists. The value is `undefined`. Every "is the override configured?"
check that tests truthiness sees a miss.

**3. `wagmiConfig.tsx` falls through to the chain's default RPC.**

The transport builder does roughly:

```ts
const rpcOverrideUrl = scaffoldConfig.rpcOverrides?.[chain.id];
// ...
rpcOverrideUrl ? http(rpcOverrideUrl) : http()   // <- bare http()
```

`undefined` is falsy, so it takes the bare `http()` branch. **A bare `http()`
with no URL argument is not an error and not a no-op** — viem falls back to
`chain.rpcUrls.default.http[0]` from the chain definition. For `base` that is
`https://mainnet.base.org`. The app boots, reads work, nothing throws, no
console warning. It just silently runs the entire production user base through
a free shared endpoint with aggressive per-IP limits → 429s.

**4. Why dev never reproduces it.** Locally `.env.local` is present, the
inlined literal is the paid URL, and `http(paidUrl)` is chosen. The failing
branch is unreachable on any machine that has the file. This is a build-env vs.
deploy-env divergence, not a code path that differs.

## The one operational check that settles it

**Grep the shipped bundle for the literal URL.** The env var is either baked
into the deployed JavaScript or it isn't — nothing else is evidence.

```bash
# against the build output
grep -ro "base-mainnet\.g\.alchemy\.com\|mainnet\.base\.org" packages/nextjs/out/_next/static/ | sort -u

# or against what production is actually serving
curl -s https://yourapp.example/ \
  | grep -o '/_next/static/chunks/[^"]*\.js' | sort -u \
  | while read -r c; do curl -s "https://yourapp.example$c"; done \
  | grep -o "base-mainnet\.g\.alchemy\.com\|mainnet\.base\.org" | sort -u
```

Paid host present and `mainnet.base.org` absent → fixed. Anything else → not
fixed. Note what this check is *not*: `vercel env ls | grep RPC` (or the
equivalent host env panel) proves the variable exists somewhere, not that it
was exposed to the build that produced the live artifact. Same for reading
`.env` on the box. Because the value is frozen at build time, the fix is
always *set the variable in the build environment, then rebuild and redeploy* —
and the grep is what confirms the rebuild actually picked it up.

## The second trap: `fallback()` in `wagmiConfig.tsx`

Fixing the env var is necessary but not sufficient. SE-2's transport is not a
single `http()` — it is a ranked `fallback` array that keeps a bare `http()` in
it alongside the override:

```ts
transport: fallback([
  http(rpcOverrideUrl),
  http(alchemyHttpUrl),
  http(),                 // <- public default, still in the list
], { rank: true }),
```

Two distinct leaks from that bare entry, both surviving a correct env var:

1. **Ranking actively probes every transport.** With `rank: true`, viem runs a
   background latency/stability sampler against *all* transports on an interval
   — including the public one — and reorders them. Traffic hits
   `mainnet.base.org` continuously even while the paid RPC is perfectly
   healthy, and if the public node happens to score better on a sample it gets
   promoted to primary for real user requests.
2. **Any transient failure fails over to it.** One timeout, one 5xx, one
   rate-limit blip from the paid provider and the fallback quietly routes to
   the public endpoint — exactly when load is highest, which is exactly when
   it will 429.

The fix is to stop treating a public endpoint as an acceptable backup:

```ts
transport: rpcOverrideUrl
  ? http(rpcOverrideUrl)
  : fallback([http(paidPrimary), http(paidSecondary)], { rank: false }),
```

Remove the bare `http()` from the array entirely; if you want redundancy, make
the secondary a *second keyed provider*, and set `rank: false` so viem uses
the list in order instead of continuously probing it. And make the missing-key
case loud rather than silent — throw at config load, or at minimum log an
error, so a future build that drops the env var fails visibly instead of
degrading into public RPC again.

## Summary

| Link | What happens |
|---|---|
| `NEXT_PUBLIC_*` semantics | Inlined as a literal at `next build`; no runtime env exists in a static export |
| Build environment | `.env.local` is local-only and gitignored; the build container never had the var |
| Shipped bundle | `rpcOverrides: { 8453: undefined }` |
| `wagmiConfig.tsx` | Falsy override → bare `http()` → viem uses `chain.rpcUrls.default` = `mainnet.base.org` |
| Symptom | Silent public-RPC traffic in prod, 429s under load, unreproducible on dev machines |
| Settling check | Grep the deployed JS chunks for the paid host / absence of `mainnet.base.org` |
| Second trap | Bare `http()` left inside `fallback([...], { rank: true })` — ranking probes it constantly and any blip fails over to it |
