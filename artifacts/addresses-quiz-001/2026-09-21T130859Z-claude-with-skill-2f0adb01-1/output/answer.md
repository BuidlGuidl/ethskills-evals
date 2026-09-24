# Swap venue for large USDC → WETH on Base

## Recommendation

**Route through an aggregator — 1inch Aggregation Router V6 — not a single DEX router.**

| Item | Base address |
|------|--------------|
| **1inch Aggregation Router V6 (put this in config)** | `0x111111125421cA6dc452d289314280a0f8842A65` |
| USDC (native, Circle) — sell token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH — buy token | `0x4200000000000000000000000000000000000006` |

Addresses from a verified address list (checked on-chain Mar 2026). Still run `cast code <addr> --rpc-url <base rpc>` and check Basescan before the first live trade.

## Reasoning

### 1. On Base, the deepest DEX is Aerodrome, not Uniswap
Aerodrome is the largest DEX on Base by TVL (~$500–600M) and holds most of the USDC/WETH liquidity. Uniswap v3/v4 on Base also has real depth. If you "just use Uniswap" (the default on mainnet), you skip the main pool on this chain.

### 2. Even so, one venue is wrong for trades of $100k+
At this size, a trade in a single pool moves the price a lot. The lowest slippage comes from **splitting the order** across several pools: Aerodrome Slipstream (concentrated liquidity), Aerodrome basic pools, Uniswap v3/v4, and others, plus multi-hop paths. An aggregator does this split and finds the best mix for each trade. A single DEX router can't.

### 3. Why not call the Aerodrome router directly?
The verified Aerodrome `Router` (`0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`) only routes through Aerodrome's **older basic pools** (volatile/stable, v2-style). Much of Aerodrome's deep USDC/WETH liquidity is in its **Slipstream concentrated-liquidity pools**, which use a separate swap router. That router is not in my verified list, and I won't guess an address. Hard-wiring the basic `Router` would miss the best Aerodrome pools **and** every other venue.

### 4. Why 1inch V6 in particular
- Deployed at the same address on every chain (`0x1111…2A65`), verified on Base.
- Routes across Aerodrome (basic + Slipstream), Uniswap v3/v4, and other Base AMMs, splitting the order between them.
- Mature and heavily used. Calldata comes from the 1inch API, and the router checks your `minReturn` on-chain.

## Execution notes for a treasury desk
- **Always set `minReturn`**, based on an independent price (e.g. Chainlink ETH/USD on Base `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70`), not only the aggregator's own quote. Keep the slippage limit tight, e.g. 10–30 bps.
- **MEV:** Base has a single sequencer and no public mempool like mainnet's, so sandwich risk is lower but not zero. Tight `minReturn` is the main defense.
- **Split by time too:** for very large sizes, run several smaller swaps over time (TWAP) or use an RFQ / intent-based venue. Compare against 1inch Fusion or CoW before each big trade.
- **Approvals:** approve the exact amount to the router (or use Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3`). Avoid unlimited approvals from a treasury wallet.
- **Fallback:** if policy forbids aggregators, go direct to Aerodrome **Slipstream** (get its SwapRouter address from the official `aerodrome-finance/slipstream` repo and verify on Basescan) plus Uniswap Universal Router on Base `0x6ff5693b99212da76ad316178a184ab56d299b43`. Quote both and send each trade to whichever gives more.

## Config value
```
SWAP_ROUTER_BASE=0x111111125421cA6dc452d289314280a0f8842A65   # 1inch Aggregation Router V6
```
