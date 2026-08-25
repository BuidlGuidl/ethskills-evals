# Is it safe to reuse the mainnet Uniswap v4 addresses on Base and Arbitrum?

**No. Do not ship this.** The v4 core and periphery contracts are at *different* addresses on
every chain. Reusing the mainnet addresses on Base and Arbitrum points your app at addresses
with **no code on those chains** — and, critically, that does not throw a loud error. It reads
empty.

Uniswap's own deployment docs say this outright:

> "Integrators should **no longer assume that they are deployed to the same addresses across
> chains** and be extremely careful to confirm mappings below."
> — [Uniswap v4 deployments](https://docs.uniswap.org/contracts/v4/deployments)

The CREATE2 reasoning is a real mechanism applied to the wrong conclusion. CREATE2 makes an
address a deterministic function of `(deployer, salt, initcode)`. It gives you address equality
across chains only if all three are held constant. For v4 they were not: Uniswap ran a public
salt-mining competition (`UniswapV4DeployerCompetition`) for the PoolManager, and mined a
*separate* vanity salt per chain — that's why mainnet gets `0x000000000004444c...` and Unichain
gets `0x1f98400...0004`. Different salt ⇒ different address, by design. Constructor args (the
owner) differ per chain too, which changes the initcode hash and moves the address again.

## What I verified (live, 2026-08-19 UTC)

`cast code` for each chain's PoolManager, queried against all three chains. `code=3` is the
string `0x\n` — i.e. **no contract at all**.

| address | on Ethereum | on Base | on Arbitrum |
|---|---|---|---|
| `0x000000000004444c5dc75cB358380D2e3dE08A90` (mainnet PM) | 48021 bytes ✅ | **empty** ❌ | **empty** ❌ |
| `0x498581fF718922c3f8e6A244956aF099B2652b2b` (Base PM) | **empty** ❌ | 48021 bytes ✅ | **empty** ❌ |
| `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` (Arbitrum PM) | **empty** ❌ | **empty** ❌ | 48021 bytes ✅ |

Same bytecode length on each chain (identical contract), three different addresses, and each
one is a dead address on the other two. `owner()` also differs per chain
(`0x1a9C8182…` mainnet, `0x31FAfd48…` Base, `0x2BAD8182…` Arbitrum), confirming these are
independent deployments rather than one address replayed.

### The failure mode is silent — this is the part that should decide the call

A raw `eth_call` to the mainnet PoolManager address **on Base**:

```
$ curl -s -X POST https://mainnet.base.org -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0x000000000004444c5dc75cB358380D2e3dE08A90","data":"0x1e2eaeaf00..00"},"latest"]}'
{"jsonrpc":"2.0","result":"0x","id":1}          # <-- SUCCESS. Empty data. No revert.

# the same call on Ethereum:
{"jsonrpc":"2.0","result":"0x000000000000000000000000 1a9c8182c09f50c8318d769245bea52c32be35bc"}
```

The EVM does not revert on a call to an address with no code — it returns success with zero
bytes. So on Base your app would report every pool as uninitialized, every liquidity position
as zero, and every quote as empty. Nothing in CI fails. And a **write** path is worse: a
`swap`/`unlock` call into that dead address succeeds as a no-op, so any `approve` + transfer
sequence that doesn't strictly depend on a return value can move tokens with nothing on the
other end to give them back. There is no "it'll blow up in staging" safety net here.

There's a nastier variant one layer over. Uniswap **v3**'s mainnet factory
`0x1F98431c8aD98523631AE4a59f267346ea31F984` *is* also the v3 factory on Arbitrum — but on Base
that address holds 4221 bytes of an **unrelated contract**, while the real Base v3 factory is
`0x33128a8fC17869897dcE68Ed026d694621f6FDfD`. So "same address across chains" is not even
reliably wrong; it's right on some chains and wrong on others, and when it's wrong it can be
occupied by something else entirely. That's exactly the pattern that makes a per-chain config
non-negotiable rather than a nicety.

## What to actually use

From Uniswap's deployment list, each entry re-verified on-chain. Every periphery contract below
self-reports its `poolManager()` as its own chain's PoolManager — that's the cross-check that
proves these are a coherent per-chain set, not a copied table.

### Base (chain id 8453)
| Contract | Address |
|---|---|
| PoolManager | `0x498581fF718922c3f8e6A244956aF099B2652b2b` |
| PositionManager | `0x7C5f5A4bBd8fD63184577525326123B519429bDc` |
| Quoter (V4Quoter) | `0x0d5e0F971ED27FBfF6c2837bf31316121532048D` |
| StateView | `0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71` |
| PositionDescriptor | `0x25d093633990dc94bedeed76c8f3cdaa75f3e7d5` |
| Universal Router | `0x6fF5693b99212Da76ad316178A184AB56D299b43` |
| Universal Router 2.1.1 | `0xfdf682f51fe81aa4898f0ae2163d8a55c127fbc7` |

### Arbitrum One (chain id 42161)
| Contract | Address |
|---|---|
| PoolManager | `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` |
| PositionManager | `0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869` |
| Quoter (V4Quoter) | `0x3972c00f7ed4885e145823eb7c655375d275a1c5` |
| StateView | `0x76Fd297e2D437cd7f76d50F01AfE6160f86e9990` |
| PositionDescriptor | `0xe2023f3fa515cf070e07fd9d51c1d236e07843f4` |
| Universal Router | `0xA51afAFe0263b40EdaEf0Df8781eA9aa03E381a3` |
| Universal Router 2.1.1 | `0x8b844f885672f333bc0042cb669255f93a4c1e6b` |

### Ethereum (chain id 1) — for reference, what you have today
| Contract | Address |
|---|---|
| PoolManager | `0x000000000004444c5dc75cB358380D2e3dE08A90` |
| PositionManager | `0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e` |
| Quoter (V4Quoter) | `0x52F0E24D1c21C8A0cB1e5a5dD6198556BD9E1203` |
| StateView | `0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227` |
| Universal Router | `0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af` |
| Universal Router 2.1.1 | `0x4c82d1fbfe28c977cbb58d8c7ff8fcf9f70a2cca` |

### The two that genuinely *are* the same everywhere
| Contract | All three chains |
|---|---|
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| ReservesLens | `0x0000001b173C3bbF3984D417d8614E3eed34865B` |

Verified: identical code on all three (18307 and 28287 bytes respectively). These are probably
where the team's intuition came from — and they're real. But they're the exception, and the
exception is what makes the rule dangerous: a config that's correct for Permit2 and wrong for
PoolManager looks half-working, which is the hardest kind of bug to spot.

## Four other things that break with "no per-chain config"

1. **Your hooks.** If you deployed hook contracts against mainnet's PoolManager, those addresses
   do not exist on Base or Arbitrum. Worse, v4 encodes a hook's permissions in its *address
   bits*, so hooks must be salt-mined per chain to land on an address with the right flags —
   and they must be mined against that chain's PoolManager. This is real redeployment work,
   not a config edit. Budget for it in the "next week" plan.

2. **Token addresses.** Same trap, one layer down. WETH is a different address on all three
   chains. And Base carries **two** USDCs — native `USDC` `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
   and bridged `USDbC` `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA` (I confirmed both `symbol()`
   calls) — different addresses, different liquidity, and most UIs render both as "USDC".
   Default to native USDC unless you have a specific reason not to.

3. **Universal Router versioning.** Each chain has both an original and a 2.1.1 Universal Router
   live. Pick one deliberately and record which; the old one keeps working, so picking the
   stale one gives you no signal that you did.

4. **Liquidity is not portable.** A pool id that trades well on mainnet may be thin or
   nonexistent on Base/Arbitrum, and the deepest venue for a given pair on an L2 is often not
   Uniswap. Before routing size, quote the actual clip against the target chain's pools rather
   than assuming mainnet's routing carries over.

## Recommendation

Add a per-chain address map keyed by chain id, with **no fallback default** — an unknown chain
id should throw at startup, not silently inherit mainnet's values. Then add a boot-time
assertion that costs nothing and would have caught this entire class of bug:

```ts
// for each configured chain: contract must have code, and must agree about its own PoolManager
const code = await client.getCode({ address: cfg.poolManager });
if (!code || code === "0x") throw new Error(`no PoolManager at ${cfg.poolManager} on chain ${id}`);

for (const a of [cfg.positionManager, cfg.stateView, cfg.quoter, cfg.universalRouter]) {
  const pm = await client.readContract({ address: a, abi: IMMUTABLE_STATE_ABI, functionName: "poolManager" });
  if (pm.toLowerCase() !== cfg.poolManager.toLowerCase())
    throw new Error(`${a} on chain ${id} points at ${pm}, expected ${cfg.poolManager}`);
}
```

That `poolManager()` cross-check is the strong one: it's the contracts themselves confirming
they belong to the same deployment, so a copy-paste slip between two chains' tables fails at
boot instead of in production.

---

**Before real funds move on Base or Arbitrum, re-verify every address above** against
<https://docs.uniswap.org/contracts/v4/deployments> and the target chain's explorer. My checks
were run 2026-08-19 UTC; deployment tables go stale, this document included, and whoever runs
the deploy did not watch me run `cast code`.
