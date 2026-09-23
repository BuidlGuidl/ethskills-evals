# Why production traffic lands on `mainnet.base.org`

## The chain, link by link

**1. `NEXT_PUBLIC_*` is a build-time substitution, not a runtime lookup.**

There is no `process` object in the browser. Next.js (webpack `DefinePlugin`) performs a
textual find-and-replace on `process.env.NEXT_PUBLIC_RPC_URL` during `next build`, baking
the value in as a string literal in the emitted chunk. Whatever the builder's environment
held at build time is what ships. Nothing reads an environment variable after the build.

**2. A static export removes the last place a runtime value could come from.**

With `output: "export"` (or `next build && next export`) the deploy is plain HTML/JS on
generic hosting — S3+CloudFront, nginx, GitHub Pages, Netlify's static tier. There is no
Node server, no `getServerSideProps`, no runtime config hydration. Setting `NEXT_PUBLIC_RPC_URL`
on the *host* does nothing; only the *build* environment matters.

**3. The build environment didn't have it, the dev machines did.**

The usual split: developers have `packages/nextjs/.env.local`, which is gitignored and never
reaches CI. The CI runner / Docker build stage / platform env scoped to "Production" only (or
scoped to Preview/Development only) lacks the variable. Next inlines it as `undefined` and
emits a build-time warning nobody reads. Same source tree, different builds.

**4. So the override key exists but its value is `undefined`.**

```ts
rpcOverrides: {
  [chains.base.id]: process.env.NEXT_PUBLIC_RPC_URL,  // → { 8453: undefined }
}
```

The object is not empty — the key is there with an `undefined` value. `rpcOverrides?.[chain.id]`
is therefore falsy, and the TypeScript type (`Record<number, string> | undefined`, or
`string | undefined` per entry) never complains. Reading `scaffold.config.ts` in the editor
tells you nothing about what production actually got.

**5. What the transport does when the override is missing.**

In `packages/nextjs/services/web3/wagmiConfig.tsx`, the wagmi `client({ chain })` factory does
roughly:

```ts
let rpcFallbacks = [http()];
const rpcOverrideUrl = scaffoldConfig.rpcOverrides?.[chain.id];
if (rpcOverrideUrl) {
  rpcFallbacks = [http(rpcOverrideUrl), http()];
} else {
  const alchemyHttpUrl = getAlchemyHttpUrl(chain.id);
  if (alchemyHttpUrl) {
    const isUsingDefaultKey = scaffoldConfig.alchemyApiKey === DEFAULT_ALCHEMY_API_KEY;
    rpcFallbacks = isUsingDefaultKey ? [http(), http(alchemyHttpUrl)] : [http(alchemyHttpUrl), http()];
  }
}
return createClient({ chain, transport: fallback(rpcFallbacks), pollingInterval: scaffoldConfig.pollingInterval });
```

The critical detail: **`http()` called with no argument is not a no-op — it resolves to
`chain.rpcUrls.default.http[0]`**, which for viem's `base` chain is `https://mainnet.base.org`.
So the "missing override" path doesn't fail loudly; it silently produces a working transport
pointed at Base's public endpoint.

The Alchemy branch makes it worse if you never set your own key: Scaffold-ETH ships a shared
demo `DEFAULT_ALCHEMY_API_KEY`, and when it detects that key it deliberately puts the **public
RPC first** (`[http(), http(alchemyHttpUrl)]`) so the shared demo key isn't burned. Production
therefore prefers `mainnet.base.org` by design.

**6. Scaffold-ETH's polling amplifies it into 429s.**

`scaffoldConfig.pollingInterval` (30s by default) plus `useScaffoldReadContract` /
`useScaffoldWatchContractEvent` / `useWatchBalance` means every open tab issues repeated
`eth_call` / `eth_getLogs` / `eth_blockNumber` on a timer. One developer against the public
endpoint is invisible; N concurrent production tabs × polling is exactly the shape that
trips public rate limits.

---

## The one operational check that settles it

**Grep the deployed JavaScript bundle for your paid RPC hostname.**

```bash
# against the actual deploy
curl -s https://your-app.example/ \
  | grep -o '/_next/static/chunks/[^"]*\.js' \
  | sort -u \
  | while read -r c; do curl -s "https://your-app.example$c"; done \
  | grep -o -E 'https://[a-z0-9.-]+(base[a-z0-9.-]*|rpc[a-z0-9.-]*)[^"]*' | sort -u

# or locally, on the build output
grep -r "your-paid-rpc-host.example" packages/nextjs/out/_next/static/ | head
```

Because the value is inlined at build time, the bundle *is* the ground truth. If your paid
hostname appears in the shipped chunks, the override reached production. If the only RPC host
you find is `mainnet.base.org`, it did not — regardless of what the hosting dashboard, the
`.env` file in the repo, or `scaffold.config.ts` says.

This is the check precisely because the tempting alternatives prove nothing: `echo $NEXT_PUBLIC_RPC_URL`
on the host is irrelevant (static build), and setting the variable in the platform UI is
irrelevant until you **trigger a fresh build and redeploy**, with cache-busted chunks. Verify
after the redeploy, not after the settings change.

(Secondary confirmation once you're in the browser: DevTools → Network → filter XHR/fetch and
confirm the JSON-RPC POSTs go to the paid host. Useful, but the bundle grep is the one that
tells you *why*.)

---

## The second trap: `fallback()` keeps a public RPC in the rotation

Even after `NEXT_PUBLIC_RPC_URL` is correctly baked in, the override branch builds:

```ts
rpcFallbacks = [http(rpcOverrideUrl), http()];   // ← bare http() is still there
```

The transport is `fallback([...])`. viem's `fallback` walks the array in order and, on a
transport error that isn't classified as "should throw" (network failure, timeout, 5xx, and
notably **429**), transparently moves to the next transport. That next transport is the bare
`http()` — `https://mainnet.base.org`.

Consequences you will actually observe:

- Any hiccup at the paid provider — a rate limit on *your* plan, a blip, a timeout on a heavy
  `eth_getLogs`, a request shape the provider rejects — silently reroutes that request to the
  public endpoint. No error surfaces to the app; the call just succeeds from somewhere else.
- Methods the paid provider doesn't support (wide-range `eth_getLogs`, tracing, archive reads
  behind a plan tier) fail over *every single time*, so a steady fraction of traffic is
  permanently on the public RPC.
- Failure at the paid provider correlates across all clients, so the failover is a synchronized
  stampede onto `mainnet.base.org` — the burst most likely to earn a 429 there.
- If `rank` is enabled, viem periodically probes every transport in the list for latency/stability,
  which generates background traffic to the public endpoint even when nothing is failing.

So the env fix removes the *baseline* public traffic; it does not remove the failover path. To
close it, edit the override branch in `packages/nextjs/services/web3/wagmiConfig.tsx` — either
drop the bare `http()` so the transport is your paid RPC alone (errors then surface instead of
being masked), or replace it with a second *authenticated* provider URL as the fallback:

```ts
if (rpcOverrideUrl) {
  rpcFallbacks = [http(rpcOverrideUrl)];                       // fail loudly, never fall to public
  // or: [http(rpcOverrideUrl), http(secondPaidUrl)]           // real redundancy
}
```

And treat the bare `http()` in that file as the thing to audit generally: in this codebase it
always means "the chain's public default endpoint," never "no transport."
