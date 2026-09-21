# Swap venue for large USDC → WETH on Base

## Recommendation

**Uniswap, via the Uniswap Universal Router on Base:**

```
0x6fF5693b99212Da76ad316178A184AB56D299b43
```

(Uniswap v3-only alternative, simpler ABI: SwapRouter02 `0x2626664c2603336E57B271c5C0b26F421741e481`.)

Tokens: USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, WETH `0x4200000000000000000000000000000000000006`.

## Why — measured on-chain, not from memory

Checked live on Base mainnet (2026-09-21) with `cast` against `https://mainnet.base.org`.

### 1. Addresses verified

| Contract | Address | Check |
|---|---|---|
| Uniswap Universal Router | `0x6fF5693b99212Da76ad316178A184AB56D299b43` | has code (19.5 KB) |
| Uniswap v3 SwapRouter02 | `0x2626664c2603336E57B271c5C0b26F421741e481` | `factory()` = `0x33128a8f…FDfD` (Uni v3 factory), `WETH9()` = `0x4200…0006` |
| Aerodrome Slipstream SwapRouter | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` | `factory()` = `0x5e7BB104…809A`, `WETH9()` = `0x4200…0006` |
| Aerodrome v2 Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` | `defaultFactory()` = `0x420DD381…40Da` |

### 2. Price for a real size: quote 500,000 USDC → WETH

Used each venue's on-chain quoter (Uni QuoterV2 `0x3d4e44Eb…B76a`, Slipstream Quoter `0x254cF9E1…15b0`):

| Venue / pool | WETH out | vs best |
|---|---|---|
| **Uniswap v3 USDC/WETH 0.30%** | **182.13** | — |
| Uniswap v3 USDC/WETH 0.05% | 180.42 | −0.94% |
| Aerodrome Slipstream tick-spacing 100 | 180.03 | −1.15% |
| Aerodrome Slipstream tick-spacing 1 | 48.09 | pool too thin |
| Aerodrome v2 (basic pools) | negligible liquidity | — |

The Uniswap v3 0.30% pool has by far the most active (in-range) liquidity (`liquidity()` ≈ 2.4e19 vs ≈ 9.0e18 on the main Slipstream pool and ≈ 7.9e17 on the Uni 0.05% pool). At this size, depth beats the lower fee tier: ~1% better fill (~$5k on a $500k trade) even after paying 0.30%.

### 3. Why Universal Router rather than one pool/router

- One contract reaches Uniswap v2, v3 **and v4** pools, so the order can be split across fee tiers/pool versions (the Uniswap routing API / SDK builds the split for you).
- Supports Permit2 approvals, so no repeated unlimited approvals to the router.
- Uniswap v4 pools weren't quoted here (need pool keys); Universal Router covers them anyway.

## Execution notes for this size

- **Always quote right before sending** and set `amountOutMinimum` from that quote (e.g. 0.3–0.5% tolerance). Rankings above are a snapshot; liquidity shifts. Aerodrome Slipstream is a close #2 — worth quoting both and splitting across Uni + Aerodrome, or using an aggregator (1inch/0x/CoW), if you want best-of-all-venues.
- **Use a private/protected submission path** (e.g. a private RPC) — large swaps with visible slippage room get sandwiched.
- **Chunk very large orders** (> ~$1M) over time, or use TWAP; price impact grows faster than linearly with size.
- Treat the address as config, but re-verify against Uniswap's official deployments page before going live.
