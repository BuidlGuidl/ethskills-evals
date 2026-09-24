# Swap venue for large USDC → WETH on Base

## Short answer

**Venue: Aerodrome, the biggest DEX on Base. Use its Slipstream (concentrated-liquidity) pools, not its classic pools.**
**Recommended setup for this trade size: get prices from an aggregator (or a split router) that covers Aerodrome Slipstream and Uniswap V3/V4. Don't hard-wire a single pool.**

Config values:

| Role | Contract | Base address | Verification |
|---|---|---|---|
| **Primary: aggregated routing** | 1inch Aggregation Router V6 | `0x111111125421cA6dc452d289314280a0f8842A65` | In skill's verified list; bytecode on Base confirmed |
| **Direct venue: Aerodrome CL pools** | Aerodrome Slipstream SwapRouter | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` | ⚠️ NOT in skill's verified list. I checked it on Base: bytecode is there, and `factory()` returns `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A` (Slipstream CLFactory). **Check it against the Aerodrome repo/docs and Basescan before putting funds through it.** |
| Aerodrome classic (v2-style) Router | Aerodrome Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` | Verified. **Only reaches volatile/stable pools, not Slipstream.** Don't use it for this trade. |
| Fallback / comparison | Uniswap V3 SwapRouter02 (Base) | `0x2626664c2603336E57B271c5C0b26F421741e481` | Verified |
| Tokens | USDC (native) / WETH | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` / `0x4200000000000000000000000000000000000006` | Verified |

Do **not** use the Uniswap V3 mainnet/Arbitrum router `0x68b3…Fc45` on Base. The Base address is different. Uniswap V4 addresses also differ from chain to chain.

## Reasoning

1. **Uniswap is not the default on Base.** Aerodrome is Base's biggest DEX by TVL and has the most USDC/WETH liquidity. That makes it the obvious main venue.
2. **Which Aerodrome router you call matters.** Aerodrome runs two kinds of pools:
   - Classic pools (v2-style, liquidity spread across the full price range), reached through `Router 0xcF77…4E43`.
   - Slipstream pools (concentrated liquidity near the current price), reached through a **separate** SwapRouter.
   For USDC/WETH, most usable depth near the current price sits in the Slipstream pools. If you send a $100k+ order to the classic router, it goes through the classic pool only. You'd get worse prices than necessary and ignore the deepest pools.
3. **At this size, one pool is rarely best.** A few hundred thousand USDC will move the price of any single Base USDC/WETH pool. The next-best depth sits in Uniswap V3/V4 USDC/WETH pools and in other Slipstream fee tiers. Splitting the order across them cuts price impact. An aggregator (1inch V6, same address on all chains via CREATE2, verified on Base) does this split automatically, and its quotes include Aerodrome Slipstream.
4. **So:** send orders through the aggregator by default. Keep the direct Slipstream router as a fallback for when the aggregator API is down, or for simple one-pool orders where you control the path and fee tier.

## Execution guardrails (matter more than the venue at this size)

- **Always set `minAmountOut`** from a fresh quote plus a tight slippage limit (e.g. 10–30 bps). Never 0.
- **Check the quote against an independent price** before sending, e.g. the Chainlink ETH/USD feed on Base, `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70`. Reject if price impact is over your limit.
- **Protect against front-running** (bots trading just before and after you, called MEV/sandwich attacks): use a short `deadline`, keep slippage tight, and cut big tickets into pieces spread over time (TWAP-style chunks, e.g. $50–100k each).
- **Approvals:** give each router only the amount it needs, or use Permit2 (`0x000000000022D473030F116dDEE9F6B43aC78BA3`). Don't give unlimited approval to the aggregator.
- **Before going live:** simulate a full-size swap on a Base mainnet fork. Compare the direct Slipstream route, Uniswap V3 and the aggregator route on real output.

## Open questions

- Is calling the off-chain 1inch API acceptable for your desk, or does routing need to be fully on-chain? If fully on-chain, use the Slipstream router with fixed pools, and split orders yourself across Slipstream and Uniswap V3.
- Please confirm the Slipstream router address with Aerodrome's official deployment list before it goes into prod config.
