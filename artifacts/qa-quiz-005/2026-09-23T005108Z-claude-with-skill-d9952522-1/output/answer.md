# Why production lands on `mainnet.base.org` while dev machines don't

## TL;DR

`NEXT_PUBLIC_RPC_URL` is inlined into the JS bundle **at build time**, not read at runtime. The
machine that ran `next build` for production didn't have it set, so the bundle literally contains
`undefined`. `rpcOverrides[8453]` is then falsy, `wagmiConfig` drops into its Alchemy branch, and —
because the app is also on SE-2's shared default Alchemy key — it deliberately puts the bare
`http()` transport **first**. Bare `http()` means viem's `chain.rpcUrls.default.http[0]`, which for
`base` is `https://mainnet.base.org`. That's the 429 source.

---

## The chain, step by step

### 1. `NEXT_PUBLIC_*` is a compile-time substitution, not a runtime lookup

Next.js does not hand the browser a `process` object. During `next build`, webpack's DefinePlugin
textually replaces every `process.env.NEXT_PUBLIC_FOO` occurrence in client-bundled code with the
string literal it had **in the build environment**. If the variable is absent at that moment, the
replacement is the literal `undefined` — baked in, permanently, for the life of that artifact.

So:

```ts
rpcOverrides: {
  [chains.base.id]: process.env.NEXT_PUBLIC_RPC_URL,
}
```

compiles to either `{ 8453: "https://paid-host/v2/KEY" }` or `{ 8453: undefined }`, decided once, on
the builder. Note the key is still *present* — only the value is gone. Nothing in TypeScript flags
this; `process.env.X` is typed `string | undefined` and `undefined` is assignable.

### 2. Why dev machines look fine

`packages/nextjs/.env.local` is gitignored and exists only on developer laptops. `next dev` (and a
local `next build`) loads it, so the substitution yields the paid URL. Every local run is a false
negative. The variable never travels with the repo.

### 3. Why the production build didn't get it

Three common shapes, all producing the same bundle:

- The var was set in the hosting provider's **runtime/environment** panel. For a static export
  (`output: "export"`, plain files on generic hosting) there is no server process at runtime —
  runtime env is meaningless. It must exist in the *build* shell.
- The var was added to the build config **after** the last build. `NEXT_PUBLIC_*` changes require a
  **rebuild and redeploy**; a restart or cache purge does nothing.
- The build happens on a laptop/CI step that doesn't source `.env.local` (e.g. `yarn build` run in a
  container, or a `vercel build`-style step scoped to a different environment than the deploy).

### 4. What `wagmiConfig.tsx` does with a missing override

`packages/nextjs/services/web3/wagmiConfig.tsx`, inside `createConfig({ client({ chain }) {...} })`:

```ts
let rpcFallbacks = [http()];

const rpcOverrideUrl = (scaffoldConfig.rpcOverrides as ChainAttributes)?.[chain.id];
if (rpcOverrideUrl) {
  rpcFallbacks = [http(rpcOverrideUrl), http()];
} else {
  const alchemyHttpUrl = getAlchemyHttpUrl(chain.id);
  if (alchemyHttpUrl) {
    const isUsingDefaultKey = scaffoldConfig.alchemyApiKey === DEFAULT_ALCHEMY_API_KEY;
    // If using default Scaffold-ETH 2 API key, we prioritize the default RPC
    rpcFallbacks = isUsingDefaultKey ? [http(), http(alchemyHttpUrl)] : [http(alchemyHttpUrl), http()];
  }
}

return createClient({ chain, transport: fallback(rpcFallbacks), ... });
```

- `if (rpcOverrideUrl)` — a **truthiness** check, so `{ 8453: undefined }` fails it exactly like a
  missing key. The override is skipped silently; no warning, no throw.
- Falls to the Alchemy branch. If `NEXT_PUBLIC_ALCHEMY_API_KEY` is *also* unset at build time,
  `scaffoldConfig.alchemyApiKey` falls back to `DEFAULT_ALCHEMY_API_KEY` — the demo key SE-2 ships
  and every fork shares. `isUsingDefaultKey` is `true`, so the array is `[http(), http(alchemy)]`:
  **public endpoint in primary position, by design** (SE-2 would rather burn public quota than the
  shared demo key).
- `http()` with **no argument** is the whole trap: viem resolves it to the chain object's own
  default — `base.rpcUrls.default.http[0]` === `https://mainnet.base.org`. The app is pointed at an
  unauthenticated, aggressively rate-limited endpoint, and every user of the dApp shares that one
  IP-based budget. Traffic scales, 429s appear, dev never sees it.

Net: **build env missing → inlined `undefined` → falsy override → default-Alchemy-key branch →
bare `http()` → `mainnet.base.org` → 429.**

---

## The one operational check that settles it

**Grep the deployed JavaScript for the paid RPC hostname.** Because the value is inlined, its
presence in the shipped artifact is the proof — and its absence is the bug, independent of any
dashboard that claims the variable is set.

```bash
# against the build output
grep -rF "your-paid-rpc-host" packages/nextjs/out/_next/static/ | head

# or against what's actually live
curl -s https://your-app.example/ \
  | grep -oE '/_next/static/[^"]+\.js' | sort -u \
  | while read -r p; do curl -s "https://your-app.example$p"; done \
  | grep -c "your-paid-rpc-host"
```

Non-zero hits = the variable made it into the build. Zero hits = it did not, no matter what the
host's env panel shows. (Confirm in the browser afterwards: DevTools → Network, filter `base.org`,
exercise the app — there should be no app-originated requests to it. But that's the symptom check;
the bundle grep is what settles cause.)

Do this against the **deployed** bundle, not a local `yarn build` — a local build will pick up
`.env.local` and pass while production still fails.

---

## The second, transport-level trap

Fixing the env var is necessary but not sufficient. Two things in the same `client()` factory keep
some traffic on public RPCs:

### a) The bare `http()` is still a sibling in the `fallback()` array

Even on the success path the transport is `fallback([http(rpcOverrideUrl), http()])`. viem's
`fallback` transport **silently rotates to the next transport on any error from the primary** —
timeout, 5xx, or the paid provider's own 429/quota rejection. So the moment the paid endpoint hiccups
or you exceed its plan, every subsequent call quietly lands on `mainnet.base.org` and starts
collecting 429s there instead. The failure is invisible: no error surfaces to the UI, requests just
get slower and flakier. You'll keep seeing public-endpoint traffic in production forever and conclude
the env fix "didn't take". If you want a hard guarantee, the override branch has to be
`[http(rpcOverrideUrl)]` (or a fallback of two *authenticated* providers), not paid-plus-public.

### b) `enabledChains` injects `mainnet`, and `rpcOverrides` has no entry for it

Just above `createConfig`:

```ts
export const enabledChains = targetNetworks.find((network: Chain) => network.id === 1)
  ? targetNetworks
  : ([...targetNetworks, mainnet] as const);
```

SE-2 always adds Ethereum mainnet so ENS works. `client()` runs **per chain**, and
`rpcOverrides` is keyed only on `chains.base.id`, so for `chain.id === 1` the lookup is `undefined`
→ same else-branch → `fallback([http(), http(alchemyMainnet)])` with the default key → public
mainnet RPC. Every `<Address/>`, `<AddressInput/>`, and avatar lookup — which are ENS reads on chain
1, and they're on nearly every page — goes to a public endpoint regardless of how correct your Base
config is. Fix by keying the override map for both chains:

```ts
rpcOverrides: {
  [chains.base.id]: process.env.NEXT_PUBLIC_RPC_URL,
  [chains.mainnet.id]: process.env.NEXT_PUBLIC_MAINNET_RPC_URL,
},
```

---

## Fix checklist

1. Set `NEXT_PUBLIC_RPC_URL` (and `NEXT_PUBLIC_ALCHEMY_API_KEY`, so the default-key branch can't
   prioritize public) in the **build** environment, then **rebuild and redeploy**.
2. Add a mainnet entry to `rpcOverrides` for ENS traffic.
3. Drop the bare `http()` from the override branch's `fallback()` array, or pair the paid provider
   with a second authenticated one.
4. Verify with the bundle grep above against the live deploy — not a local build.
5. Optional guard so this can't regress silently: throw (or `console.error` loudly) at module load
   in `scaffold.config.ts` when `NODE_ENV === "production"` and `NEXT_PUBLIC_RPC_URL` is undefined.
   A build that can't reach its paid RPC should fail the build, not degrade in front of users.
