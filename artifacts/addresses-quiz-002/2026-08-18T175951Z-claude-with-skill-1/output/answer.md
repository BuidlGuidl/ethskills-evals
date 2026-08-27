# Is it safe to reuse the mainnet Uniswap v4 addresses on Base and Arbitrum?

**No. Do not ship this plan.** The premise is false for Uniswap v4 specifically, and the
failure mode is quiet: the addresses do not revert in a way that says "wrong chain." Most
of them have no code at all on the target chain, and at least two of them *do* have code —
wired to a PoolManager that does not exist there.

Uniswap's own deployment docs now carry this line verbatim:

> Integrators should **no longer assume that they are deployed to the same addresses across
> chains** and be extremely careful to confirm mappings below.

Everything below was measured live on 2026-08-18 (Ethereum block 25783651, Base 50143479,
Arbitrum 495905675) against public RPCs, and cross-checked on a second independent RPC for
every surprising result.

---

## 1. Why the CREATE2 reasoning is wrong

The plan says "Uniswap ships with CREATE2, so the contracts live at the same address on
every chain." CREATE2 does not promise that. It computes:

```
address = keccak256(0xff ++ deployer ++ salt ++ keccak256(initcode))[12:]
```

Same address requires **all three** inputs to be identical: deployer, salt, *and the hash of
the init code*. Init code includes the constructor arguments.

v4-core's PoolManager takes a constructor argument:

```solidity
// Uniswap/v4-core, src/PoolManager.sol:101
constructor(address initialOwner) ProtocolFees(initialOwner) {}
```

And `initialOwner` is a different governance address on each chain:

| Chain | `PoolManager.owner()` |
|---|---|
| Ethereum | `0x1a9C8182C09F50C8318d769245beA52c32BE35BC` |
| Base | `0x31FAfd4889FA1269F7a13A66eE0fB458f27D72A9` |
| Arbitrum One | `0x2BAD8182C09F50c8318d769245beA52C32Be46CD` |

Different constructor arg → different init code → different init-code hash → **a different
CREATE2 address by arithmetic necessity**, even if Uniswap had used one deployer and one salt
everywhere. The same reasoning cascades to PositionManager, Quoter, StateView and the
Universal Router, all of which take the chain's PoolManager (and Permit2, WETH, descriptor)
as constructor arguments.

This is also the difference from v3, which is probably where the belief came from: the v3
factory took no such per-chain arguments and did land on `0x1F98431c8aD98523631AE4a59f267346ea31F984`
on many chains. v4 is not v3.

## 2. What is actually at the mainnet addresses on Base and Arbitrum

`cast code` at each mainnet v4 address, probed on all three chains (byte length of runtime code):

| Contract (mainnet address) | Ethereum | Base | Arbitrum |
|---|---|---|---|
| PoolManager `0x0000…8A90` | 24010 | **empty** | **empty** |
| PositionManager `0xbD21…ee9e` | 23878 | **empty** | ⚠️ 23878 — see §3 |
| StateView `0x7fFE…7227` | 3532 | **empty** | **empty** |
| Quoter `0x52F0…1203` | 5821 | **empty** | **empty** |
| Universal Router `0x66a9…a8Af` | 19500 | ⚠️ 19500 | ⚠️ 19500 — see §3 |

The "empty" cells are the ordinary case, and they are not as safe as they look. A call to an
address with no code **does not revert at the EVM level** — it succeeds and returns zero bytes:

```
$ cast rpc eth_call '{"to":"0x52f0…1203","data":"0xdc4c90d3"}' latest --rpc-url <base>
"0x"
```

`cast` is courteous enough to warn ("does not have any code"), but a Solidity low-level
`staticcall` sees `success == true`, and plenty of JS/viem/ethers paths decode empty
returndata into `0`, `undefined`, or a silently-empty array. So a reused address on Base
gives you: quotes of zero, balances of zero, "no liquidity" states, and — for the write path —
transactions that appear to succeed while moving nothing, or that send value to an address
nobody controls. Nothing in your build or your test suite necessarily goes red.

## 3. Two live landmines, not just absences

Two of the reused addresses are occupied, which is far more dangerous than being empty.

**(a) A stray, bricked PositionManager sits at the mainnet address on Arbitrum.**
`0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e` has 23878 bytes of code on Arbitrum and answers
`symbol()` with `"UNI-V4-POSM"` — it passes a naive "is this the right contract?" check. But:

```
poolManager()  -> 0x000000000004444c5dc75cB358380D2e3dE08A90   (the MAINNET PoolManager)
code at that address on Arbitrum -> empty
nextTokenId()  -> 1        # no position has ever been minted here
```

Compare Arbitrum's real PositionManager `0xd88F…dD869`, whose `poolManager()` correctly returns
Arbitrum's `0x360E…FB32` and whose `nextTokenId()` is **196069**. The stray one is a dead
deployment pointed at a nonexistent core contract; its code hash differs from mainnet's, so it
is not even the same build. A mint through it would burn gas and strand whatever it touched.
This is exactly the trap the "verified contract, correct symbol" heuristic cannot catch.

**(b) The mainnet Universal Router address is live on all three chains — and all three copies
point at the mainnet PoolManager.** `0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af` has an
*identical code hash* (`0x6a5f46971b50c6e1…`) on Ethereum, Base, and Arbitrum, and on every one
of them `poolManager()` returns `0x0000…8A90`. That address is empty on Base and Arbitrum, so
the v4 swap path through this router is inert there. The routers you are supposed to use return
the local core contract:

```
Base    0x6fF5…9b43  poolManager() -> 0x498581fF718922c3f8e6A244956aF099B2652b2b  ✓
Arbitrum 0xA51a…81a3  poolManager() -> 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32  ✓
```

This is the single most likely way the plan ships and looks fine in review: the address has
code, it is a real Uniswap Universal Router, and it is wrong.

## 4. What to use instead

Per-chain config is mandatory. Current v4 deployments, from Uniswap's deployments page and
confirmed on-chain — each periphery contract's `poolManager()` was checked to return its own
chain's PoolManager:

### Ethereum (chainId 1) — what you have today
| Contract | Address |
|---|---|
| PoolManager | `0x000000000004444c5dc75cB358380D2e3dE08A90` |
| PositionManager | `0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e` |
| Quoter | `0x52F0E24D1c21C8A0cB1e5a5dD6198556BD9E1203` |
| StateView | `0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227` |
| PositionDescriptor | `0xD1428ba554F4C8450B763a0B2040A4935C63F06c` |
| Universal Router | `0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af` |

### Base (chainId 8453)
| Contract | Address |
|---|---|
| PoolManager | `0x498581fF718922c3f8e6A244956aF099B2652b2b` |
| PositionManager | `0x7C5f5A4bBd8fD63184577525326123B519429bDc` |
| Quoter | `0x0d5e0F971ED27FBfF6c2837bf31316121532048D` |
| StateView | `0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71` |
| PositionDescriptor | `0x25D093633990DC94BeDEeD76C8F3CdAa75f3E7D5` |
| Universal Router | `0x6fF5693b99212Da76ad316178A184AB56D299b43` |

### Arbitrum One (chainId 42161)
| Contract | Address |
|---|---|
| PoolManager | `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` |
| PositionManager | `0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869` |
| Quoter | `0x3972c00f7Ed4885e145823Eb7c655375D275A1c5` |
| StateView | `0x76Fd297e2D437cd7f76d50F01AfE6160f86e9990` |
| PositionDescriptor | `0xe2023F3FA515CF070E07fd9D51c1D236e07843F4` |
| Universal Router | `0xA51afAFe0263b40EdaEf0Df8781eA9aa03E381a3` |

Uniswap also publishes a "Universal Router 2.1.1" per chain (mainnet `0x4c82…2cca`, Base
`0xfdf6…fbc7`, Arbitrum `0x8b84…1e6b`). Pick one router version deliberately and pin it per
chain rather than mixing.

**Re-verify these before real funds move.** This table is a starting point, not a warrant —
it is dated 2026-08-18, deployments get superseded, and whoever runs your code did not watch
me check. The two commands are:

```bash
cast code <addr> --rpc-url <TARGET CHAIN RPC>                    # code exists on THAT chain
cast call <addr> 'poolManager()(address)' --rpc-url <same rpc>   # and it points at THAT chain's core
```

That second call is the one that matters for v4 — it is what distinguishes the real Base
router from the mainnet router that also happens to exist on Base.

## 5. The genuinely same-address contracts (why the myth survives)

Some of the stack really is identical everywhere, which is what makes the wrong intuition
plausible:

| Contract | Address | Same address on all 3? |
|---|---|---|
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | yes |
| ReservesLens | `0x0000001b173C3bbF3984D417d8614E3eed34865B` | yes |

Permit2 has a no-argument constructor, so its init code is byte-identical on every chain, and
the deterministic deployer + fixed salt land it on the same address. (Amusingly its *runtime*
code hash still differs per chain — it caches `block.chainid` in an immutable for its EIP-712
domain separator — which is a neat reminder that "same address" and "same bytecode" are
independent properties.) ReservesLens is identical in both address and code hash.

So the rule is not "Uniswap is same-address" or "Uniswap is not." It is: **contracts with no
chain-specific constructor arguments can be same-address; anything constructed with a
per-chain dependency cannot be.** All of v4 core and periphery is in the second group.

## 6. Other things "no per-chain config" would break

The address problem is not confined to the v4 contracts. If the config is being collapsed,
these go with it:

**Token addresses.** WETH is `0xC02a…6Cc2` on mainnet, `0x4200000000000000000000000000000000000006`
on Base, `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` on Arbitrum. Mainnet WETH and mainnet
USDC are both empty addresses on Base and Arbitrum.

**Native vs bridged, and `symbol()` will not save you.** Arbitrum carries two USDCs, and they
report the *same* symbol:

```
0xaf88d065e77c8cC2239327C5EDb3A432268e5831  symbol="USDC"  name="USD Coin"        supply 2.59e15  <- native, use this
0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8  symbol="USDC"  name="USD Coin (Arb1)" supply 5.02e13  <- bridged USDC.e
```

Only `name()` and the supply distinguish them. Base has the same split (native USDC
`0x8335…2913` vs USDbC `0xd9aA…b6CA`). Default to native; choose it explicitly, not by ticker
match.

**Hooks and pools.** A v4 hook is a separately deployed contract per chain, and its address
encodes its permission flags — a mainnet hook address is not reusable and may not even be a
valid flag pattern for what you intend elsewhere. PoolKeys are chain-independent as *structs*,
but a pool must be initialized on each chain, and the liquid fee tier differs. Concretely, on
Base right now, quoting 1 ETH → USDC through the correct Base Quoter:

```
fee=500,  tickSpacing=10  ->  1908.47 USDC   <- the real pool
fee=3000, tickSpacing=60  ->  1907.63 USDC
fee=100,  tickSpacing=1   ->     99.93 USDC   <- ~-95%, essentially empty pool, and it does NOT revert
```

Same protocol, same chain, correct addresses, three genuine pools — and one of them would
have taken a 95% haircut without erroring. Quote each candidate at your real clip size before
routing.

**Venue assumptions.** If any routing logic assumes mainnet's deepest venue is also the
deepest on the L2, re-check that per chain and per pair with live quotes. Aerodrome on Base
and Camelot on Arbitrum are real contenders for specific pairs; the ranking moves and
aggregate chain TVL is not the metric — routed depth for the pair you are swapping is.

---

## Bottom line

The plan is unsafe as written. Of the five mainnet v4 addresses, three are empty on both
target chains (silent zero reads), one is empty on Base but occupied on Arbitrum by a bricked
never-used PositionManager, and one — the Universal Router — is live on all three chains while
pointing at a PoolManager that only exists on mainnet. None of these fail loudly.

Ship a per-chain address map keyed by `chainId`, populate it from §4, and add a startup
assertion that for each configured chain the periphery contracts' `poolManager()` equals that
chain's configured PoolManager **and** that the PoolManager has non-empty code. That one
assertion would have caught every problem in this document.
