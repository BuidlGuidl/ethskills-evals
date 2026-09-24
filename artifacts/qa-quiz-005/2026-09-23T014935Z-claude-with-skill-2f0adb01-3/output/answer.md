# Why production hits `mainnet.base.org` while dev machines don't

## TL;DR

`NEXT_PUBLIC_RPC_URL` is **inlined at build time, not read at runtime**. The static
build on your generic host was produced by a CI/build step that did not have the
variable set, so `process.env.NEXT_PUBLIC_RPC_URL` was substituted with `undefined`
in the shipped JavaScript. `rpcOverrides[8453]` is therefore falsy, and SE-2's
wagmi client falls through to a bare `http()` transport — which resolves to
`chain.rpcUrls.default`, i.e. `https://mainnet.base.org`. Every user's browser
then rate-limits itself against the public endpoint.

Developers never see it because their `.env.local` is present when *they* build
and run, so the literal paid URL gets inlined into their local bundle.

---

## The exact chain, link by link

### 1. `NEXT_PUBLIC_*` is a compile-time substitution

In Next.js, `NEXT_PUBLIC_`-prefixed variables are not environment lookups in the
browser — there is no `process` in the browser. Webpack/Turbopack performs a
**literal text substitution** of `process.env.NEXT_PUBLIC_RPC_URL` during
`next build`, baking the value into the emitted JS chunks.

Consequences:

- The value is frozen at the moment `next build` ran, in the environment where it ran.
- Setting the variable on the *runtime* host (or in a container's env, or in a
  hosting dashboard *after* the build) changes nothing. The string is already
  compiled into `.next/static/chunks/*.js`.
- If the variable was absent at build time, the substitution produces `undefined`.
  Not an empty string, not a throw — the expression is replaced and dead-code
  elimination happily keeps going.

This is exactly why "the config looks right" is a false signal: the source is
correct, the artifact is not. The source file is not what production runs.

### 2. The "static build on generic hosting" detail is the whole tell

A static export / prerendered build is served as plain files. There is no Node
process on the host reading `process.env` when a user loads the page. Whatever
build machine produced the artifact — a CI runner, a Docker build stage, a
developer's laptop, a `yarn build` in a pipeline without the secret injected —
is the *only* place the variable could have been read.

Common concrete causes, all of which look identical from the outside:

- The env var is configured on the hosting platform as a **runtime** variable, but the
  build step runs in a different context that doesn't receive it.
- The value lives in `.env.local`, which is `.gitignore`d and therefore never
  present in CI.
- The var is set in the platform UI *after* the last build; no rebuild was
  triggered, so the old artifact (with `undefined` inlined) is still being served.
- The build runs in a Docker stage where the secret is passed only to the runtime
  stage, not as a build arg.

### 3. `rpcOverrides: { [base.id]: undefined }`

`scaffold.config.ts` becomes, in the built bundle:

```js
rpcOverrides: { 8453: undefined }
```

The key exists. The value is falsy. SE-2 checks the *value*, not the key
presence, so this is indistinguishable from "no override configured."

### 4. What the transport does when the override is missing

`packages/nextjs/services/web3/wagmiConfig.tsx` builds a per-chain viem client
roughly like this (stock SE-2):

```ts
client({ chain }) {
  let rpcFallbacks = [http()];                       // <-- bare http(), no URL

  const rpcOverrideUrl = (scaffoldConfig.rpcOverrides as ChainsRpcOverrides)?.[chain.id];
  if (rpcOverrideUrl) {
    rpcFallbacks = [http(rpcOverrideUrl), http()];
  } else {
    const alchemyHttpUrl = getAlchemyHttpUrl(chain.id);
    if (alchemyHttpUrl) {
      const isUsingDefaultKey = scaffoldConfig.alchemyApiKey === DEFAULT_ALCHEMY_API_KEY;
      rpcFallbacks = isUsingDefaultKey
        ? [http(), http(alchemyHttpUrl)]             // public FIRST on the shared demo key
        : [http(alchemyHttpUrl), http()];
    }
  }

  return createClient({ chain, transport: fallback(rpcFallbacks), pollingInterval: ... });
}
```

The critical semantics: **`http()` called with no argument is not a no-op and not
an error.** viem resolves it to `chain.rpcUrls.default.http[0]` — for Base, that
is `https://mainnet.base.org`. A bare `http()` *is* the public RPC.

So with `rpcOverrideUrl === undefined`, the `if` is skipped and the client ends up
on `fallback([http()])` — or, if the project is still on SE-2's shared demo Alchemy
key, on `fallback([http(), http(alchemyDemo)])`, where the **public endpoint is
ranked first**. Either way, 100% of reads from every visitor's browser land on
`mainnet.base.org`. With `pollingInterval` firing block-watchers on every mounted
hook, across every concurrent user, you hit the public rate limit quickly — hence
the 429s.

### 5. Why dev machines are clean

`.env.local` is loaded by `next dev` and by a local `next build`. The paid URL is
inlined, `rpcOverrides[8453]` is truthy, the override branch is taken, and the paid
RPC is the primary transport. Developers are testing a *different artifact* than
the one in production. No amount of local reproduction will ever surface this.

---

## The one operational check that settles it

**Grep the deployed JavaScript bundle for the RPC hostname.**

```bash
# against the live deployment
curl -s https://your-app.example/ \
  | grep -o '/_next/static/chunks/[^"]*\.js' \
  | sort -u \
  | while read -r p; do curl -s "https://your-app.example$p"; done \
  | grep -o 'https://[a-z0-9.-]*\(base\|alchemy\|infura\|quicknode\|drpc\)[a-z0-9./-]*' \
  | sort -u

# or, on the build artifact before deploying
grep -r "your-paid-rpc-host" packages/nextjs/.next/static/ | head
```

This is the settling check because it inspects the **artifact**, which is the only
thing that matters. It gives a binary answer:

- The paid host string appears → the variable was present at build time, inlining
  worked, the fix is real.
- Only `mainnet.base.org` (or `undefined` next to the override) appears → the
  variable was not set **in the build environment**, regardless of what the hosting
  dashboard or `scaffold.config.ts` says.

Everything else is a proxy that can lie. Checking the dashboard shows intent, not
inlining. Checking `scaffold.config.ts` shows source, not artifact. Checking the
Network tab in devtools is a decent live confirmation (you'd see `mainnet.base.org`
in the request list), but it tells you the symptom rather than proving the cause —
and after a partial fix it can look clean while the fallback trap below still
leaks. The bundle grep is the one that cannot be fooled.

Corollary: because this is build-time, the remediation is **set the variable in the
build/CI environment and trigger a fresh build**. Setting it at runtime and
restarting the host changes nothing.

---

## The second trap: the bare `http()` fallback in `wagmiConfig.tsx`

Even after `NEXT_PUBLIC_RPC_URL` is correctly inlined, the override branch produces:

```ts
rpcFallbacks = [http(rpcOverrideUrl), http()];
//                                    ^^^^^^ still mainnet.base.org
```

`fallback()` is not "use the first one." It is a failover list. viem's fallback
transport will silently promote the second transport whenever the first one errors,
times out, or returns a retryable status — including transient 5xx, network blips,
and the paid provider's own rate limiting. When that happens the request is
transparently re-issued against `mainnet.base.org`. The call succeeds, nothing is
logged, no error surfaces in the UI, and your provider dashboard shows a *drop* in
traffic while public 429s continue.

Two aggravating details:

- If `fallback` is configured with `rank: true` (viem's latency-ranking mode), it
  actively sends probe requests to **every** transport in the list on an interval
  in order to rank them — so the public endpoint receives steady traffic even when
  the paid RPC is perfectly healthy and nothing has failed.
- The failure mode is self-amplifying: a brief paid-RPC hiccup shifts load to the
  public endpoint, which rate-limits, which produces exactly the 429 signature ops
  is reporting — while the config "looks right."

**Fix:** delete the bare `http()` from the fallback array so only intended,
configured transports remain.

```ts
client({ chain }) {
  const rpcOverrideUrl = (scaffoldConfig.rpcOverrides as ChainsRpcOverrides)?.[chain.id];
  if (!rpcOverrideUrl) {
    // fail loudly at build/boot rather than silently degrading to a public RPC
    throw new Error(`No RPC override configured for chain ${chain.id}`);
  }
  return createClient({
    chain,
    transport: http(rpcOverrideUrl),      // or fallback([http(primary), http(secondaryPaid)])
    pollingInterval: scaffoldConfig.pollingInterval,
  });
}
```

If you want redundancy, make the second entry a *second paid/private endpoint*, not
`http()`. And make the missing-override case throw: a loud build failure is
strictly better than a silent downgrade to an endpoint that will rate-limit you in
production and nowhere else.

---

## Summary of the causal chain

1. `next build` runs in an environment without `NEXT_PUBLIC_RPC_URL`.
2. Webpack inlines `process.env.NEXT_PUBLIC_RPC_URL` → `undefined` into the static chunks.
3. `rpcOverrides[8453]` is falsy in the shipped bundle.
4. `wagmiConfig.tsx` skips the override branch and builds `fallback([http()])`.
5. Bare `http()` resolves to `chain.rpcUrls.default` = `https://mainnet.base.org`.
6. Every visitor's browser polls the public endpoint → 429s.
7. Dev machines have `.env.local`, so their bundle contains the paid URL → invisible locally.

**Settling check:** grep the deployed JS chunks for the paid RPC hostname.
**Second trap:** the bare `http()` left in the `fallback([...])` array, which silently
(or, under `rank: true`, continuously) routes traffic to the public RPC even once the
env var is fixed.
