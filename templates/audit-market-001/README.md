# ArbiLend

Overcollateralised USDC lending market. Users deposit collateral into
`CollateralVault`, borrow USDC from `LendingMarket` against it, and are
liquidated when their position falls below the liquidation threshold.

Deployment target: **Arbitrum One**. Mainnet is not in scope for this release.

| Piece | Address / value |
| --- | --- |
| Debt asset | USDC `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| First listed collateral | wstETH `0x5979D7b546E38E414F7E9822514be443A4800529` |
| Feed set for wstETH | stETH / USD `0x07C5b924399cc23c24a95c8743DE4006a32b7f2a` |
| Feed set for USDC | USDC / USD `0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3` |
| Liquidation threshold | 8000 bps |
| Liquidation bonus | 500 bps |
| Borrow rate | 400 bps / year |

## Contracts

- `LendingMarket` — borrow / repay / liquidate, interest accrual, health
  factor. Sits behind `MarketProxy` so we can ship fixes without migrating
  positions. Storage layout is append-only; do not reorder.
- `CollateralVault` — custody and per-user accounting for collateral. Only the
  market can seize.
- `PriceOracle` — Chainlink price source, one feed per token, prices returned
  scaled to 1e18 USD.
- `MarketProxy` — ERC-1967 proxy the market is deployed behind.

## Collateral listing

wstETH is the only collateral at launch. Governance lists further tokens with
`LendingMarket.listCollateral`; the shortlist for the next round is weETH,
ezETH and USDT, and the DAO has asked for a path to yield-bearing and
rebasing collateral after that.

## Liquidity

There is no supply side in this release. The treasury seeds the market's USDC
balance with a direct transfer and takes the interest; lender deposits land in
v2.

## Interest

Debt is tracked with a global borrow index. `accrueInterest()` runs at the top
of every state-changing entry point and advances the index by the elapsed
time since the last accrual.

## Development

```bash
forge build
```

No dependencies and no test suite yet — the suite lands with the audit fixes.
