# Why production hits `mainnet.base.org` while dev doesn't

## The chain, link by link

**1. `NEXT_PUBLIC_*` is a build-time literal, not a runtime lookup.**

Next.js does not ship `process.env` to the browser. During `next build`, webpack's
DefinePlugin performs a textual substitution on every `process.env.NEXT_PUBLIC_FOO`
it finds in client code, replacing it with the string value present *in the
environment of the build process*. The emitted bundle contains the literal, e.g.:

```js
rpcOverrides: { 8453: "https://base-mainnet.g.alchemy.com/v2/abc123" }
```

If the variable is absent at build time, the substitution still happens — the
expression becomes the literal `undefined`:

```js
rpcOverrides: { 8453: undefined }
```

There is no later opportunity to supply it. Setting the variable on the web host,
in the container that serves the files, or in a runtime `.env` changes nothing,
because the value was frozen into the JS chunk hours earlier.

**2. Dev machines get it, CI doesn't.**

Locally, `packages/nextjs/.env.local` is loaded by `next dev` / `next build` from
the working directory. That file is gitignored, so it exists on every developer's
box and on nobody's build agent. The build agent runs `yarn next build` with
`NEXT_PUBLIC_RPC_URL` unset, and inlines `undefined`. This is the single asymmetry
that explains "works on dev machines, 429s in prod."

**3. A static export removes the last escape hatch.**

`output: "export"` produces `out/` — plain HTML/JS/CSS. There is no Node server,
no `getServerSideProps`, no runtime env injection, no middleware. Whatever host
serves `out/` cannot participate in configuration at all. So the build step is the
*only* place the URL can be injected, and generic hosting providers that let you
set "environment variables" on the site typically apply them to the runtime, not
the build — which for a static export is a no-op.

**4. What the transport does with `undefined`.**

In `packages/nextjs/services/web3/wagmiConfig.tsx`, the wagmi `client({ chain })`
factory does roughly:

```ts
let rpcFallbacks = [http()];

const rpcOverrideUrl = scaffoldConfig.rpcOverrides?.[chain.id];
if (rpcOverrideUrl) {
  rpcFallbacks = [http(rpcOverrideUrl), http()];
} else {
  const alchemyHttpUrl = getAlchemyHttpUrl(chain.id);
  if (alchemyHttpUrl) {
    const isUsingDefaultKey = scaffoldConfig.alchemyApiKey === DEFAULT_ALCHEMY_API_KEY;
    rpcFallbacks = isUsingDefaultKey
      ? [http(), http(alchemyHttpUrl)]          // note the ordering
      : [http(alchemyHttpUrl), http()];
  }
}

return createClient({ chain, transport: fallback(rpcFallbacks), ... });
```

`undefined` is falsy, so the `else` branch runs. And the critical viem detail:
**`http()` called with no URL is not a no-op — it resolves to
`chain.rpcUrls.default.http[0]`**, which for `viem/chains`'s `base` is
`https://mainnet.base.org`. That public endpoint is exactly what ops is seeing
429s from.

The secondary trap in that same `else` branch: if the project never replaced the
Alchemy key, `scaffoldConfig.alchemyApiKey` equals `DEFAULT_ALCHEMY_API_KEY` — the
shared demo key baked into the Scaffold-ETH 2 template — and the code deliberately
puts the **public** `http()` first in the fallback list, ahead of the (shared,
also-rate-limited) Alchemy URL. So the misconfigured path doesn't merely fall back
to public RPC, it *prefers* it.

## The one operational check that settles it

**Grep the deployed artifact for the literal.** After rebuilding with the variable
exported in the build environment:

```bash
grep -rl "base-mainnet.g.alchemy.com" out/        # your paid host — must hit
grep -rl "mainnet.base.org"          out/         # must not hit for chain 8453
```

Run it against the bytes the CDN is actually serving (`curl` the deployed chunk
URLs if you want zero doubt), not against a local build. This is decisive because
it tests the exact thing that failed — whether the substitution happened — rather
than a downstream symptom. Watching the 429 rate is not decisive: a low-traffic
window, client-side caching, or wagmi's fallback masking failures can all make a
broken build look healthy for a while. Browser DevTools → Network, filtered to
XHR, is the same check from the other end and a fine confirmation, but the grep is
the one that cannot lie to you.

(Fix itself: export `NEXT_PUBLIC_RPC_URL` in the CI/build step — repo secret →
build env — not in the hosting runtime config.)

## The second, transport-level trap

Fixing the env var is necessary but not sufficient, because of this line:

```ts
rpcFallbacks = [http(rpcOverrideUrl), http()];
```

The bare `http()` is still there as the second entry, and again it means
`https://mainnet.base.org`. `fallback()` is not "use the first one"; it is "use the
first one *that works*." viem's fallback transport rotates to the next transport
whenever the current one throws a retryable error — network blips, timeouts, 5xx,
and notably **HTTP 429 from your paid provider when you exceed its compute-unit
budget**. It also retries internally (`retryCount`, default 3, with exponential
backoff) before demoting. So in production you will see a residual stream of
requests arriving at the public endpoint any time the paid provider hiccups or
throttles — and if `rank: true` were enabled, viem would additionally sample all
transports periodically to score latency, sending traffic to the public RPC even
while the paid one is perfectly healthy.

Two consequences worth acting on:

- **It hides the failure.** A totally dead paid RPC still renders a working dApp,
  because every call silently lands on the public endpoint. That's why "the config
  looks right" survived so long: there was no loud error, only 429s on someone
  else's endpoint. If you want the failure to be visible, drop the bare `http()`
  and use `fallback([http(primary), http(secondarySelfHosted)])` — a second
  *paid/self-hosted* endpoint — or a single `http(primary)` with no fallback.
- **Chain 1 sneaks in.** `enabledChains` appends `mainnet` when it isn't already a
  target network, so ENS name and avatar resolution runs against chain id `1`.
  That chain has no entry in your `rpcOverrides` map, so it takes the `else` branch
  and resolves to viem's default mainnet RPC. Every ENS lookup your Base dApp does
  is a public-RPC request. Add an override for `chains.mainnet.id` too.
