# WETH/USDC borrowing market

Lock WETH, borrow USDC against it at up to 70% LTV. Positions past 85% debt-to-collateral are
liquidatable for a 5% bonus. Interest accrues at a flat annual rate via a global borrow index.

```bash
forge build
forge test
```

- `src/WethUsdcMarket.sol` — the market
- `src/interfaces/IAggregatorV3.sol` — Chainlink feed surface
- `script/Deploy.s.sol` — mainnet deployment
- **[NOTES.md](./NOTES.md)** — health math, liquidator guide, and the mainnet deployment checklist

Not audited.
