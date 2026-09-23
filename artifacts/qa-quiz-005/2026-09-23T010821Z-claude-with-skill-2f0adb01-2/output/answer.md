# Why production hits `mainnet.base.org` while dev machines don't

The config *is* right. The value it reads is not there at the moment it matters.

## The chain, link by link

**1. `NEXT_PUBLIC_*` is a build-time substitution, not a runtime lookup.**
Next.js does not read `process.env` in the browser — there is no `process` there.
At `next build`, webpack's DefinePlugin does a literal text substitution on every
`process.env.NEXT_PUBLIC_FOO` occurrence in client code, replacing it with the
string value present *in the shell that ran the build*. The value is frozen into
the JS bundle. Nothing re-reads it afterwards.

**2. A static export makes that permanent.**
`output: "export"` / a static build on generic hosting ships plain `.html` + `.js`
files. There is no Node server, so there is no runtime env at all. Setting
`NEXT_PUBLIC_RPC_URL` on the host, in a dashboard, in a `.env` next to the served
files, or in a container at start time changes nothing — those inputs arrive
*after* the only moment the variable could have been read.

**3. Dev machines have the variable; the build environment didn't.**
Locally, `packages/nextjs/.env.local` is on disk and gitignored. `yarn start`
(and a local `yarn build`) pick it up, so `rpcOverrides[8453]` is the paid URL and
everything looks correct. The CI/host build ran without `.env.local` and without
the variable exported in the build step, so the substitution produced:

```js
rpcOverrides: { 8453: undefined }
```

Note the failure mode: it does not throw. It silently becomes `undefined`.

**4. The transport falls back to the chain's public default.**
SE-2's `wagmiConfig.tsx` builds the client roughly like this:

```ts
let rpcFallbacks = [http()];                       // <-- bare http(), no URL
const rpcOverrideUrl = scaffoldConfig.rpcOverrides?.[chain.id];
if (rpcOverrideUrl) {
  rpcFallbacks = [http(rpcOverrideUrl), http()];
} else {
  const alchemyHttpUrl = getAlchemyHttpUrl(chain.id);
  if (alchemyHttpUrl) {
    const isUsingDefaultKey = scaffoldConfig.alchemyApiKey === DEFAULT_ALCHEMY_API_KEY;
    rpcFallbacks = isUsingDefaultKey
      ? [http(), http(alchemyHttpUrl)]             // public FIRST, on purpose
      : [http(alchemyHttpUrl), http()];
  }
}
return createClient({ chain, transport: fallback(rpcFallbacks), pollingInterval });
```

`undefined` is falsy, so the override branch is skipped. **`http()` with no
argument is not a no-op** — viem resolves it to `chain.rpcUrls.default.http[0]`,
which for Base is `https://mainnet.base.org`. And if the project still carries the
template's default Alchemy key, SE-2 *deliberately ranks the public endpoint
first* to avoid burning the shared demo key. Every user then multiplies that by
`pollingInterval` (every block-ish, per mounted hook, per tab) — hence 429s at
production traffic levels and nothing on a single dev machine.

So: missing build-time env → `rpcOverrides[8453] === undefined` → falsy check →
bare `http()` → viem's chain default → `mainnet.base.org` → rate limit.

## The one operational check that settles it

**Look at what the deployed bundle actually contains — not at the config, not at
the hosting dashboard.**

```bash
# against the built output, or curl the deployed JS chunks
grep -ro "mainnet\.base\.org" packages/nextjs/out/_next/static/ | head
grep -ro "<your-paid-rpc-host>"  packages/nextjs/out/_next/static/ | head
```

Equivalently, on the live site: DevTools → Network → filter XHR, watch the
`eth_call`/`eth_getBlockByNumber` traffic and confirm the request host.

The paid host string must be *present in the shipped JS* and the public host must
not be receiving traffic. This is the check that settles it because it is the only
one downstream of the substitution. "The variable is set in the hosting
dashboard" proves nothing for a static export, and a green checkmark on the
config file proves nothing either. Corollary: after setting the variable you must
**rebuild and redeploy** — restarting or re-serving the existing artifact cannot
change a string that was compiled in.

## The second, transport-level trap

Fixing the env var still leaves this in `wagmiConfig.tsx`:

```ts
rpcFallbacks = [http(rpcOverrideUrl), http()];
//                                    ^^^^^^ still the public Base RPC
```

`fallback()` does not mean "use the first one." The bare `http()` remains a live
member of the fallback set, and viem will route to it whenever the paid endpoint
returns an error, times out, or 5xx/429s — so a brief hiccup on the paid provider
silently migrates traffic to `mainnet.base.org`, where it gets rate-limited, which
looks like the original bug returning. If ranking is enabled, viem additionally
*probes* every transport in the list on an interval, sending background traffic to
the public endpoint even during normal operation. Requests that leak this way are
invisible in the config and only show up in the Network tab.

**Fix:** drop the bare fallback so only intended transports remain.

```ts
const rpcOverrideUrl = scaffoldConfig.rpcOverrides?.[chain.id];
if (!rpcOverrideUrl) throw new Error(`No RPC override configured for chain ${chain.id}`);
const rpcFallbacks = [http(rpcOverrideUrl)];   // add a second *paid* provider if you want redundancy
```

Throwing on a missing override also converts link 4 above from a silent
downgrade into a loud build/boot failure — which is what should have happened the
first time.

## Summary

- `NEXT_PUBLIC_*` is inlined at build time; a static export has no runtime env.
- The build environment lacked the variable, so `rpcOverrides[8453]` compiled to `undefined`.
- Bare `http()` resolves to viem's chain default → `mainnet.base.org`; with the template Alchemy key it's even ranked first.
- Settling check: grep the deployed bundle / watch the live Network tab for the RPC host — then rebuild and redeploy, since the value is compiled in.
- Remaining trap: the bare `http()` inside `fallback([...])` keeps the public RPC as a live failover and ranking probe target. Remove it and fail loudly when no override is set.
