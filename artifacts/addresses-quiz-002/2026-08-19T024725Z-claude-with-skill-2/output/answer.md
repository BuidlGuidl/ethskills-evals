# Is it safe to reuse the mainnet Uniswap v4 addresses on Base and Arbitrum?

**No. The plan is wrong and would ship broken code.** Uniswap v4's `PoolManager`
lives at a *different* address on every chain. The mainnet address has no code at
all on Base or on Arbitrum. Every v4 contract needs a per-chain entry in config,
and so do the tokens you build `PoolKey`s from.

Everything below was checked live against each chain, not recalled from a table.

---

## 1. The premise is false: CREATE2 does not imply one address everywhere

CREATE2 gives a *deterministic* address — `f(deployer, salt, initcode)`. It gives an
*identical* address across chains only if the deployer address, the salt, and the
init code are all identical on each chain. Uniswap did not do that for v4: each
chain's `PoolManager` was deployed with a different deployer/salt, and the
constructor takes an `initialOwner` that differs per chain (verified in §2), so the
init code — and therefore the CREATE2 address — differs as well. v3 is the same story
in reverse — its factory happens to share an address on Arbitrum but *not* on Base
(see §4), which is exactly why "Uniswap uses CREATE2" is not a safe generalisation.

Verified at ETH block 25786275 / Base 50159240 / Arbitrum 496030380, 2026-08-19 UTC:

```
$ cast code 0x000000000004444c5dc75cB358380D2e3dE08A90 --rpc-url <mainnet>    # 24009 bytes
$ cast code 0x000000000004444c5dc75cB358380D2e3dE08A90 --rpc-url <base>       # 0x  (no code)
$ cast code 0x000000000004444c5dc75cB358380D2e3dE08A90 --rpc-url <arbitrum>   # 0x  (no code)
```

The vanity leading zeros are a mainnet gas optimisation, not a cross-chain guarantee.
Base's and Arbitrum's `PoolManager`s are ordinary-looking addresses.

### What actually breaks

Not a clean revert everywhere, which is the dangerous part:

- **State reads go silently wrong.** A `staticcall` to an address with no code
  *succeeds* and returns empty data. Depending on your decoder (ethers/viem strict
  ABI decoding will throw; raw `eth_call` + manual decode, `try/catch` wrappers, and
  many multicall aggregators will not), that surfaces as "pool has zero liquidity",
  "price is 0", or "pool doesn't exist" — a UI that quietly shows an empty market
  rather than an error you'd notice in staging.
- **Writes are worse than reverting.** v4 routes funds through Permit2 and the
  Universal Router. If you point the router or the `PoolManager` at a codeless
  address, a `settle`/`take` flow can move tokens before the no-op call is reached.
  And approving a codeless *spender* succeeds — the token contract does not check
  the spender for code — so you are one future deployment at that address away from
  a live allowance to a stranger. Anyone who controls the
  matching deployer/salt can occupy an empty address later; empty today is not
  reserved for you.

---

## 2. What to use instead — verified per-chain addresses

Each address below was confirmed on its own chain: it has code, and its
`poolManager()` points back at that chain's `PoolManager`. The three `PoolManager`s
have the same code *size* (24009 bytes) but different code hashes and different
owners — three genuinely separate deployments.

### Ethereum mainnet (chainId 1) — what you have today
| Contract | Address |
|---|---|
| PoolManager | `0x000000000004444c5dc75cB358380D2e3dE08A90` |
| PositionManager | `0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e` |
| V4Quoter | `0x52F0E24D1c21C8A0cB1e5a5dD6198556BD9E1203` |
| StateView | `0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227` |
| UniversalRouter | `0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af` |

### Base (chainId 8453)
| Contract | Address |
|---|---|
| PoolManager | `0x498581fF718922c3f8e6A244956aF099B2652b2b` |
| PositionManager | `0x7C5f5A4bBd8fD63184577525326123B519429bDc` |
| V4Quoter | `0x0d5e0F971ED27FBfF6c2837bf31316121532048D` |
| StateView | `0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71` |
| UniversalRouter | `0x6fF5693b99212Da76ad316178A184AB56D299b43` |

### Arbitrum One (chainId 42161)
| Contract | Address |
|---|---|
| PoolManager | `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` |
| PositionManager | `0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869` |
| V4Quoter | `0x3972c00f7ed4885e145823eb7c655375d275a1c5` |
| StateView | `0x76fd297e2d437cd7f76d50f01afe6160f86e9990` |
| UniversalRouter | `0xA51afAFe0263b40EdaEf0Df8781eA9aa03E381a3` |

Evidence (abridged output of the identity checks):

```
ETHEREUM  PoolManager 0x0000...8A90  owner 0x1a9C8182C09F50C8318d769245beA52c32BE35BC
          codehash 0x785f1014...ce1293   PositionManager/Quoter/StateView/Router all -> 0x0000...8A90
BASE      PoolManager 0x4985...2b2b  owner 0x31FAfd4889FA1269F7a13A66eE0fB458f27D72A9
          codehash 0x83b2af6e...43eb6    PositionManager/Quoter/StateView/Router all -> 0x4985...2b2b
ARBITRUM  PoolManager 0x360E...FB32  owner 0x2BAD8182C09F50c8318d769245beA52C32Be46CD
          codehash 0xe4b2759e...794a4    PositionManager/Quoter/StateView/Router all -> 0x360E...FB32
```

Cross-checks: the Base `PoolManager` address is empty on mainnet and Arbitrum; the
Arbitrum one is empty on mainnet and Base. No overlap in any direction.

### The one thing that *does* carry over

**Permit2 — `0x000000000022D473030F116dDEE9F6B43aC78BA3`** — is at the same address
on all three chains (9152 bytes of code on each). It was deployed with a single
deterministic-deployer + salt, so the address really does carry over. Its runtime
code hash still differs per chain, because Permit2 bakes the chain id and EIP-712
domain separator in as immutables — a reminder that "same address" and "same
bytecode" are separate questions. This is the exception that makes the CREATE2
argument look plausible; treat it as the one address you may hardcode, and only
because it was verified.

---

## 3. Tokens change too — `PoolKey`s are not portable

A v4 pool is identified by `PoolId = keccak256(PoolKey{currency0, currency1, fee,
tickSpacing, hooks})`. Both currencies and the hooks address are chain-specific, so
**pool IDs computed on mainnet are meaningless on Base or Arbitrum.** Any cached pool
ID, subgraph ID, or hardcoded `PoolKey` has to be rebuilt per chain.

Mainnet USDC `0xA0b8...eB48` has **no code** on Base or Arbitrum. Verified via
`symbol()`/`name()`:

| Token | Ethereum | Base | Arbitrum One |
|---|---|---|---|
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | `0x4200000000000000000000000000000000000006` | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` |
| USDC (native, use this) | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| USDC (bridged, avoid) | — | `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA` (`USDbC`) | `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8` (`USDC.e`) |

Note the trap on Arbitrum: the **bridged** token also reports `symbol() == "USDC"`.
Only `name()` distinguishes it — `"USD Coin (Arb1)"` vs `"USD Coin"`. A `symbol()`
check is not enough to tell native from bridged; it has different liquidity and
different depth. Default to native.

(v4 uses `address(0)` for native ETH, so ETH-side pools may not need WETH at all —
but any ERC-20 leg does.)

---

## 4. A live example of the exact failure mode you're proposing

The mainnet **v3** factory address `0x1F98431c8aD98523631AE4a59f267346ea31F984`:

- on Arbitrum → it really is the v3 factory: 24535 bytes with the *same* code hash
  as mainnet (`0x4d7b8525…91fd69`), and `feeAmountTickSpacing(3000) == 60`. So
  "reuse the mainnet address" happens to work there, which is how this belief forms.
- on Base → **there is code there, but it is an unrelated contract** (~2.1 KB, old
  solc bytecode, entirely different selectors). Base's real v3 factory is
  `0x33128a8fC17869897dcE68Ed026d694621f6FDfD`.

And here is what a wrong-address call does:

```
$ cast rpc eth_call '{"to":"0x1F98431c8aD98523631AE4a59f267346ea31F984","data":"0x8da5cb5b"}' --rpc-url <base>
"0x"
```

No revert. A successful call returning empty data — its fallback swallows every
selector. `getPool(...)` there returns nothing, which a lenient decoder reads as
`address(0)`, which your code reads as "no pool exists". Genuine address, genuine
chain, silent wrong answer. That is the failure mode the mainnet-v4-address plan
would give you, except on a contract that also moves money.

---

## 5. What to do before shipping

1. **Make the addresses a per-chain config keyed by `chainId`** — a
   `Record<chainId, V4Addresses>` with `poolManager`, `positionManager`, `quoter`,
   `stateView`, `universalRouter`, plus the token map. No module-level constants;
   the ones you have now are implicitly mainnet-only.
2. **Fail loudly on a missing chain.** Throw on an unknown `chainId` rather than
   falling back to mainnet defaults — a silent fallback reproduces this whole bug.
3. **Add a startup/CI assertion** per configured chain: `eth_getCode != "0x"` for
   every address, and `poolManager()` on each periphery contract equals the
   configured `PoolManager`. That check is ~20 lines and catches every variant of
   this mistake, including future redeployments.
4. **Reconcile against Uniswap's own deployment list** (docs.uniswap.org contract
   addresses page / the `deployments` in `Uniswap/v4-periphery` and
   `Uniswap/contracts` repos) plus Basescan and Arbiscan before merging. This
   document is a snapshot dated 2026-08-19; it is a starting point for the check,
   not a substitute for it.
5. **Quote before you route.** Deep mainnet v4 pools do not imply deep Base or
   Arbitrum v4 pools for the same pair. Pull a live `V4Quoter` quote at your real
   clip size on each chain, and compare against the venues that are actually deep
   there (Aerodrome/Slipstream on Base, Camelot on Arbitrum) before assuming v4 is
   the right venue on the new chains.
6. **Re-verify hook addresses per chain.** If your pools use hooks, those are
   separate deployments with chain-specific addresses, and a hook address is
   encoded in the `PoolKey` — a mainnet hook address on Base yields a different,
   probably non-existent pool.

**Anyone deploying this must re-run the code + `poolManager()` checks against the
target chain's RPC before real funds move.** Deployments get superseded; the
addresses above were true at the blocks stamped in §2 and nothing guarantees they
still are on your deploy day.
