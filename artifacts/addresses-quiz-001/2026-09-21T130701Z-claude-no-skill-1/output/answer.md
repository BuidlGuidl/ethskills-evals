# USDC → WETH swap venue on Base (treasury size: $100k–$1M per swap)

## Recommendation

**Main route: an aggregator that splits each order across Aerodrome Slipstream and Uniswap (v3 + v4).**
Use the 1inch Aggregation Router v6 on Base:

```
1inch AggregationRouterV6 (Base): 0x111111125421cA6dc452d289314280a0f8842A65
```

**Direct fallback (single venue, no aggregator API needed): Aerodrome Slipstream SwapRouter**

```
Aerodrome Slipstream SwapRouter (Base): 0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5
```

If you want only one address in config and no reliance on an off-chain quote API, use the Slipstream router. At your size, the aggregator gives better fills.

## Why

### 1. No single pool is clearly "deepest". Liquidity is split about evenly
Token balances I read on-chain (Base RPC, 2026-09-21):

| Pool | Venue | USDC | WETH |
|---|---|---|---|
| `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59` | Aerodrome Slipstream WETH/USDC | ~5.62M | ~912 |
| `0xd0b53D9277642d899DF5C87A3966A349A798F224` | Uniswap v3 WETH/USDC 0.05% | ~5.29M | ~1,507 |
| Uniswap v4 WETH/USDC pools (inside the v4 PoolManager) | Uniswap v4 | extra depth, not counted here | |

These are the two main USDC/WETH venues on Base, and they are about the same size. A $500k order sent to only one of them eats that pool's in-range liquidity. Splitting it across both (plus v4) cuts price impact noticeably. Splitting orders is exactly the job an aggregator does.

Note: token balance is not the same as *active* (in-range) liquidity. Concentrated-liquidity pools (pools where LPs pick a price range) can hold a lot of tokens that sit outside the current price. So compare real quotes at your actual trade size before you decide. Don't pick the venue from TVL.

### 2. Why 1inch over calling Uniswap/Aerodrome directly
- It routes across Aerodrome (Slipstream + v2), Uniswap v2/v3/v4, and smaller venues in a single transaction, with split routing.
- It's the same address on every chain, it's widely audited, and it has run on Base for a long time.
- Alternatives work equally well for this: 0x (Settler address changes between versions, so fetch it from their API) or CoW Swap (batch auctions with protection against MEV, meaning bots that front-run or sandwich your trade; good for large, non-urgent orders).

### 3. Why Aerodrome Slipstream as the direct fallback
- Its concentrated-liquidity WETH/USDC pool is at least as deep as Uniswap v3 on Base. Aerodrome is also the main liquidity hub on Base because of its reward incentives.
- I checked the router on-chain: `factory()` returns `0x5e7bb104d84c7cb9b682aac2f3d509f5f406809a`, the same factory as the WETH/USDC Slipstream pool above, so the router actually reaches that pool.

## Other Base addresses checked (all have deployed code)
- Uniswap v3 SwapRouter02: `0x2626664c2603336E57B271c5C0b26F421741e481` (its factory `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` matches the v3 pool above)
- Uniswap Universal Router (v4-capable): `0x6fF5693b99212Da76ad316178A184AB56D299b43`
- Aerodrome v2 Router (classic, non-concentrated pools): `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`
- Tokens: USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, WETH `0x4200000000000000000000000000000000000006`

## Execution notes for this size
- **Always set `minAmountOut`**, computed from a fresh quote and your slippage limit (e.g. 10–30 bps). Never set it to 0.
- **Large orders:** split into chunks (TWAP, meaning evenly spaced smaller trades) or use CoW / RFQ (quotes from market makers). Compare the aggregator quote against the direct Slipstream quote on every trade.
- **MEV:** Base has no public mempool (the sequencer orders transactions), so sandwich risk is lower than on L1, but not zero. A tight `minAmountOut` is your protection.
- **Approvals:** approve the exact amount per trade, or use Permit2, instead of unlimited approvals to the router.
- **Before production:** check each address against the protocol's official docs or BaseScan. Addresses from any single source (including this doc) can be wrong or can change with new router versions.
