# Why production hits `mainnet.base.org` while dev machines don't

## The chain, link by link

**1. `NEXT_PUBLIC_*` is a build-time substitution, not a runtime lookup.**
Next.js does not hand `process.env` to browser code. At build time it
statically replaces every literal `process.env.NEXT_PUBLIC_RPC_URL` occurrence
in client bundles with the value present *in the build process's environment*.
The emitted JS contains a string literal — or, if the variable was unset when
the build ran, the literal `undefined`. There is no later opportunity to supply
it: the bundle is frozen.

**2. The deploy is a static build on generic hosting.**
That removes the last escape hatch. With a static export there is no Node
server at request time, so nothing re-reads the environment. Setting
`NEXT_PUBLIC_RPC_URL` in the host's runtime/env panel — or in the container that
serves the files — changes nothing whatsoever. Only the *build* environment
matters, and only for the build that produced the currently deployed artifact.
Corollary: setting the variable correctly but not triggering a fresh build
leaves the old, baked-in `undefined` in place.

**3. Dev machines have `.env.local`; CI almost certainly does not.**
`.env.local` is gitignored by design in Scaffold-ETH 2. Every developer has one
with the paid RPC URL, so `yarn start` inlines the real URL and no 429s appear.
The CI/host build container has no such file, and unless the variable was
explicitly added to the *build* step's environment, step 1 inlines `undefined`.
This is precisely the dev/prod split reported.

**4. `scaffold.config.ts` then registers an override that isn't one.**
```ts
rpcOverrides: {
  [chains.base.id]: process.env.NEXT_PUBLIC_RPC_URL,  // -> undefined in prod
},
```
The key exists; the value does not. Everything downstream does a truthiness
check on the value, and an entry mapping to `undefined` fails it exactly like a
missing entry would. The config "looks right" in source because the bug lives in
the substitution, not the syntax.

**5. `wagmiConfig.tsx` falls through to the bare `http()` transport.**
The per-chain transport is assembled roughly as:
```ts
const rpcFallbacks = [http()];                       // <- note: index 0
const rpcOverrideUrl = (scaffoldConfig.rpcOverrides as Record<number, string>)?.[chain.id];
if (rpcOverrideUrl) {
  rpcFallbacks.push(http(rpcOverrideUrl));
} else {
  const alchemyHttpUrl = getAlchemyHttpUrl(chain.id);
  if (alchemyHttpUrl) rpcFallbacks.push(http(alchemyHttpUrl));
}
return fallback(rpcFallbacks);
```
With `rpcOverrideUrl` undefined, the paid transport is never appended. What
remains is `http()` called with **no URL** — and viem's `http()` with no
argument resolves to `chain.rpcUrls.default.http[0]`, which for Base is
`https://mainnet.base.org`. That is the public endpoint returning the 429s.

The `else` branch is not a rescue either: if `alchemyApiKey` is left at SE-2's
shipped default, it is a shared demo key that is itself rate-limited, and the
cast `as Record<number, string>` is what lets an `undefined` value pass the type
checker silently in the first place.

**Net:** unset build-time env → `undefined` override → truthiness check fails →
bare `http()` → viem chain default → `mainnet.base.org` → 429 under production
traffic.

## The one operational check that settles it

**Grep the deployed JavaScript bundle for the RPC hostname.**

```bash
# against the live site, not the repo
curl -s https://<your-app>/ \
  | grep -o '/_next/static/chunks/[^"]*\.js' \
  | sort -u \
  | while read -r p; do curl -s "https://<your-app>$p"; done \
  | grep -o -E 'mainnet\.base\.org|<your-paid-rpc-host>' | sort | uniq -c
```

If the paid host does not appear in the served bundles, the variable was not
present at build time — full stop. If it does appear, the env var is fine and
the remaining 429s are the transport trap below.

This is the decisive check because it inspects the artifact actually served.
Reading `scaffold.config.ts`, the host's env-var UI, or a local `.env.local`
each tests a different thing than what shipped; the bundle is the only place the
substitution's outcome is observable. (Equivalent, lower-friction variant: open
DevTools → Network on production, filter XHR, and read the request hosts.)

Secondary confirmation: after fixing, the variable must be added to the **build**
environment and a **fresh deploy** triggered — re-run the same grep against the
new deploy, since an env-var change without a rebuild is a no-op.

## The second, transport-level trap

Even with `NEXT_PUBLIC_RPC_URL` correctly baked in, some requests keep going to
public RPCs — because of the **ordering inside `fallback()`**:

```ts
const rpcFallbacks = [http()];          // public default sits at index 0
...
rpcFallbacks.push(http(rpcOverrideUrl)); // paid RPC is appended *after* it
return fallback(rpcFallbacks);
```

viem's `fallback` tries transports **in array order**, and with default settings
(`rank: false`) that order is static — it does not learn or re-sort by latency
or error rate. So `http()` → `mainnet.base.org` is tried *first* for every
request, and the paid RPC is only reached after the public one errors. Under
load that means you are still fully dependent on the rate-limited endpoint: it
absorbs 100% of first attempts, and the paid provider serves only the retry
tail. Requests that the public endpoint answers successfully never touch the
paid RPC at all — which is why the fix can look partially applied.

**Fix:** put the override first, and only include the bare default as a genuine
last resort (or drop it entirely for production chains):

```ts
const rpcOverrideUrl = (scaffoldConfig.rpcOverrides as Record<number, string | undefined>)?.[chain.id];
const alchemyHttpUrl = getAlchemyHttpUrl(chain.id);

const rpcFallbacks = [
  ...(rpcOverrideUrl ? [http(rpcOverrideUrl)] : []),
  ...(alchemyHttpUrl && !rpcOverrideUrl ? [http(alchemyHttpUrl)] : []),
  http(), // public default, last
];
return fallback(rpcFallbacks);
```

Two supporting hardening steps worth taking at the same time:

- **Fail the build on a missing override** for production chains rather than
  degrading silently. Widen the type to `string | undefined` (removing the
  misleading `as Record<number, string>` cast) and throw at config load if a
  non-local `targetNetwork` has no override. A loud build failure is strictly
  better than a quiet public-RPC deploy.
- **Check `pollingInterval`** in `scaffold.config.ts`. On an L2 people tune it
  down for responsiveness, which multiplies request volume — it is what turns a
  misrouted transport from unnoticeable into a 429 storm.
