# Base USDC → WETH swap leg: venue + router recommendation

**Recommendation: Aerodrome Slipstream (concentrated-liquidity) — router
`0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5`**, routing the
WETH/USDC tickSpacing-100 pool `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59`.

I did not pick this from reputation — I enumerated every USDC/WETH venue on Base
from its canonical factory and quoted your actual trade size on-chain. Numbers below
are from Base mainnet at **block 50158595** (ETH ≈ $1,910). Reproduce before you ship.

---

## What I measured

All-in execution cost (fee + price impact) vs. the marginal price, exact-input USDC → WETH:

| Size (USDC) | Aerodrome Slipstream ts=100 | Uniswap v3 0.30% | Uniswap v3 0.05% |
|---|---|---|---|
| 250,000 | **130.8702 WETH — 2.8 bps** | 130.3387 WETH — 43.4 bps | 130.2483 WETH — 50.3 bps |
| 500,000 | **261.6652 WETH — 5.6 bps** | 260.6301 WETH — 45.2 bps | 259.1310 WETH — 102.4 bps |
| 1,000,000 | **523.0296 WETH — 11.4 bps** | 521.0711 WETH — 48.8 bps | 511.9520 WETH — 222.9 bps |

At your stated size (~$500k), Slipstream returns **+1.03 WETH ≈ +$1,975 per swap**
versus the best Uniswap route. That is ~40 bps of recurring edge.

Other venues I checked and rejected:

| Venue | 500k USDC → WETH | Verdict |
|---|---|---|
| Aerodrome Slipstream ts=100 | 261.67 WETH | **best** |
| Uniswap v3 0.30% (`0x6c561B446416E1A00E8E93E221854d6eA4171372`) | 260.63 | deep but the 0.30% fee dominates |
| Uniswap v3 0.05% (`0xd0b53D9277642d899DF5C87A3966A349A798F224`) | 259.13 | too thin at size |
| Uniswap v3 1% / 0.01% | 118.9 / 91.0 | vestigial |
| Aerodrome v2 volatile (`0xcDAC0d6c6C59727a65F871236188350531885C43`) | 230.59 | constant-product, −12%, unusable |
| Uniswap v4 0.30% ts=60 (no-hook) | 65.29 | not migrated on Base yet |
| Uniswap v4 0.05% ts=10 (no-hook) | 8.15 | negligible |

### The counterintuitive part

Raw TVL points the *other* way. The Uniswap v3 0.30% pool holds ~58.5M USDC + 28,392 WETH
(≈ $112M); the Slipstream pool holds ~3.98M USDC + 3,371 WETH (≈ $10M). Slipstream still
wins because:

1. **Fee.** The Slipstream pool's current `fee()` is **334 = 0.0334%**, ~9× cheaper than
   Uniswap's 0.30% tier. On $500k that fee gap alone is ~$1,330.
2. **In-range liquidity, not TVL, is what you trade against.** Active `liquidity()` is
   2.01e19 on Slipstream vs 3.24e19 on the v3 0.30% pool — same order of magnitude, so
   the fee advantage is not eaten by impact until far past your size.

"Deepest liquidity" and "best execution" are not the same question. You asked for the
second one.

### Splitting doesn't help you

I tested 100/90/80/…/0% splits between Slipstream and Uniswap v3 0.30% at both $500k and
$1M. **100% Slipstream was optimal at every point** — routing any flow into the 0.30% pool
strictly lost money, because its fee exceeds the impact you'd save. Skip the split-routing
complexity for now; revisit if your clip size grows past ~$2M.

---

## Config values (all verified to have bytecode and to self-identify on-chain)

```
SLIPSTREAM_ROUTER  = 0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5  # factory() -> 0x5e7BB104…
SLIPSTREAM_QUOTER  = 0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0  # factory() -> 0x5e7BB104…
SLIPSTREAM_FACTORY = 0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A
POOL_USDC_WETH     = 0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59  # tickSpacing 100
USDC               = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913  # native Base USDC
WETH               = 0x4200000000000000000000000000000000000006
TICK_SPACING       = 100                                          # NOT a fee tier
```

I verified each of these by calling it: the router's `factory()` and the quoter's
`factory()` both return the Slipstream factory, whose `voter()` is Aerodrome's
`0x16613524e02ad97eDfeF371bC883F2F5d6C480A5`; the pool's `token0`/`token1` are WETH/USDC.
Nothing here is recalled from memory.

## Integration gotchas

**The Slipstream router is a Uniswap-v3 fork with one breaking ABI change: the pool is
keyed by `int24 tickSpacing`, not `uint24 fee`.** If you copy a Uniswap v3 integration and
pass `3000` where `tickSpacing` belongs, you will silently address a nonexistent pool.

```solidity
// selector 0xa026383e — confirmed present in the deployed bytecode
struct ExactInputSingleParams {
    address tokenIn;      // USDC
    address tokenOut;     // WETH
    int24   tickSpacing;  // 100  <-- not 3000
    address recipient;
    uint256 deadline;
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint160 sqrtPriceLimitX96;
}
```

- Plain `ERC20.approve` to the router. **No Permit2** on this router — don't wire the
  Uniswap Permit2 flow into it.
- There is **no `multicall(uint256 deadline, bytes[])`**; `deadline` lives in the struct.
- `exactInput` (multi-hop) and `exactOutputSingle` are present if you need them.

## Risks you should price in before this goes to prod

1. **The fee is mutable.** Slipstream fees are not immutable like Uniswap v3's. The factory
   exposes a `swapFeeManager()` (`0xE6A41fE61E7a1996B59d508661e3f524d6A32075`) and a
   `swapFeeModule()` (`0x090b2A6bb475c00e2256e2095A60887cD710803b`). Today's 0.0334% is a
   governance parameter, not a constant. **Read `pool.fee()` in your pre-trade check and
   alert if it moves** — the entire thesis is the fee gap.
2. **Liquidity is incentive-driven.** Aerodrome depth follows AERO gauge emissions
   (this pool has gauge `0xF33a96b5932D9E9B9A0eDA447AbD8C9d48d2e0c8`). If emissions rotate
   away, depth can leave faster than it would from Uniswap. Uniswap v3 0.30% is the more
   inert venue and costs ~45 bps — that's your fallback, not your default.
3. **One block is one block.** These are block-50158595 quotes. Don't hardcode the venue
   choice: **quote both routers before each swap and take the better one.** Two `eth_call`s
   is cheap insurance against a 40 bps regime change. Make the router address a config
   value, not a constant — which is what you're doing, so keep the Uniswap alternative
   plumbed:
   `UNISWAP_UNIVERSAL_ROUTER = 0x6fF5693b99212Da76ad316178A184AB56D299b43`
   (verified: `poolManager()` → v4 PoolManager `0x498581fF718922c3f8e6A244956aF099B2652b2b`;
   this is the v4-capable Universal Router, not the older
   `0x198EF79F1F515F02dFE9e3115eD9fC07183f02fC`).
4. **Always set `amountOutMinimum` from a fresh quote**, never from a stale price or a
   naive `sqrtPriceLimitX96 = 0` with a loose bound. Base's sequencer is FCFS with no
   public mempool, so classic sandwiching is limited — but a stale limit still lets you
   eat an adverse move for free.
5. **At $1M+ per clip, reconsider.** Slipstream's cost roughly doubles from 5.6 to 11.4 bps
   between $500k and $1M. Above that, TWAP the order or revisit split routing.
