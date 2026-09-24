# Swap venue for large USDC → WETH on Base

## Recommendation

**Route through an aggregator: 1inch Aggregation Router V6.**

| Item | Base address |
|------|--------------|
| **1inch Aggregation Router V6 (config value)** | `0x111111125421cA6dc452d289314280a0f8842A65` |
| USDC (native, Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |

Bytecode confirmed present on Base (`cast code ... --rpc-url https://mainnet.base.org`, 2026-09-21). Same address on every chain (CREATE2). Double-check it on basescan before funding anyway.

## Why

1. **Aerodrome has the most liquidity on Base, not Uniswap.** Aerodrome is the largest DEX on Base by TVL. Uniswap v3/v4 on Base still hold a lot of USDC/WETH liquidity though. So the real depth is **split** between Aerodrome's two pool types (classic + Slipstream concentrated liquidity) and Uniswap v3/v4 pools at several fee levels.
2. **Hundreds of thousands of USDC is enough to move one pool's price.** Sending the whole order into one pool pushes it along that pool's price curve. An aggregator splits the order across Aerodrome, Uniswap v3/v4 and other pools so each piece moves the price less. That gives a better total fill than any single pool. This matters most at your trade size.
3. **The Aerodrome router has a catch.** Aerodrome's verified `Router` (`0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`) only trades through the **classic** (v2-style volatile/stable) pools. Much of Aerodrome's USDC/WETH depth sits in **Slipstream** (concentrated-liquidity) pools, and those use a separate swap router. If you hardcode the classic router, you skip most of the depth you picked Aerodrome for.
4. **One integration covers everything.** New pools and new venues get picked up without config changes.

## If you must use a single venue (no aggregator)

- Pick **Aerodrome**, but use the **Slipstream swap router** for the concentrated-liquidity USDC/WETH pools. Its address isn't in my verified list. Take it from the official `aerodrome-finance/slipstream` repo and confirm it on basescan. Don't copy it from memory or a blog.
- Otherwise use the Uniswap Universal Router on Base, `0x6ff5693b99212da76ad316178a184ab56d299b43` (v4 version, bytecode checked). It reaches Uniswap v3 and v4 pools only.
- Don't use the Aerodrome classic router `0xcF77…4E43` by itself for this pair (see point 3).

## Execution safeguards (these matter as much as the venue)

- **Always set `minReturn`.** Base it on an independent price, e.g. the Chainlink ETH/USD feed on Base, `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70`. Don't base it only on the aggregator's own quote.
- **Split big orders into chunks over time** (TWAP) if the quoted price impact goes above your limit (e.g. >10–20 bps). Pools refill between chunks.
- **Compare quotes before each trade.** Check 1inch against a direct Aerodrome Slipstream quote and a Uniswap quote. Log the realized slippage.
- **Keep token approvals tight.** Approve the exact amount, or use Permit2 (`0x000000000022D473030F116dDEE9F6B43aC78BA3`). Don't give a treasury wallet an unlimited allowance.
- Use a short `deadline` on every swap.

## Open questions
- Is an aggregator OK under your counterparty/contract-risk policy, or does it have to be direct-to-DEX?
- What's the per-trade price-impact limit that should trigger chunking?
