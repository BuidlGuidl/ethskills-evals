# Base USDC-WETH Yield Vault

This is a first Foundry version of a Base USDC vault. Users deposit native Base USDC, the strategy swaps half into WETH, adds WETH/USDC liquidity on Aerodrome, stakes the LP token in the pool gauge, and lets an authorized keeper call `harvest()` to claim AERO emissions and compound them back into the LP position.

## Integration Choice

The v1 strategy uses Aerodrome classic WETH/USDC liquidity because it is Base-native, has a live WETH/USDC volatile pool, and exposes a straightforward LP-token plus gauge flow. Aerodrome's own docs describe the router as the swap/add/remove-liquidity entrypoint and gauges as the reward contracts for staked LP tokens. Their deployment table lists the Base router (`0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`), pool factory (`0x420DD381b31aEf6683db6B902084cB0FFECe40Da`), voter (`0x16613524e02ad97eDfeF371bC883F2F5d6C480A5`), and AERO token (`0x940181a94A35A4569E4529A3CDfB74e38FD98631`).

Sources: [Aerodrome contracts README](https://github.com/aerodrome-finance/contracts/blob/main/README.md), [Aerodrome specification](https://github.com/aerodrome-finance/contracts/blob/main/SPECIFICATION.md), [Aerodrome liquidity page](https://aerodrome-finance.app/liquidity/), [Circle USDC on Base](https://www.circle.com/multi-chain-usdc/base), and [Uniswap Base deployments for WETH on Base](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-base-deployments).

Checks performed on September 22, 2026 against `https://mainnet.base.org`:

- Circle lists Base USDC as ERC-20 native USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`; the token reports 6 decimals onchain.
- Aerodrome `PoolFactory.getPool(WETH, USDC, false)` returns the volatile pool `0xcDAC0d6c6C59727a65F871236188350531885C43`.
- Aerodrome `Voter.gauges(pool)` returns gauge `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025`; `Voter.isAlive(gauge)` returned `true`.
- The gauge reports AERO as `rewardToken()` and the WETH/USDC pool as `stakingToken()`.

## Deployment

Deploy `AerodromeUsdcWethStrategy` first, then `UsdcYieldVault`, then call `strategy.setVault(vault)`.

Base mainnet constructor values:

- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- WETH: `0x4200000000000000000000000000000000000006`
- AERO: `0x940181a94A35A4569E4529A3CDfB74e38FD98631`
- LP token: `0xcDAC0d6c6C59727a65F871236188350531885C43`
- Router: `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`
- Gauge: `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025`
- Factory: `0x420DD381b31aEf6683db6B902084cB0FFECe40Da`
- `stablePool`: `false`

Deposits and withdrawals include minimum output parameters and deadlines. Production callers should quote these values immediately before submitting transactions.

## Keeper Operation

The owner sets the keeper with `setKeeper`. The keeper calls `harvest(HarvestParams)` after AERO rewards accrue:

1. `gauge.getReward(address(strategy))` claims AERO.
2. AERO swaps to USDC through Aerodrome.
3. Half the resulting USDC swaps to WETH.
4. WETH and USDC are added back to the Aerodrome WETH/USDC pool.
5. New LP tokens are staked back into the gauge.

The keeper must pass conservative slippage minimums for AERO->USDC, USDC->WETH, and LP minted. Harvesting with zero rewards is allowed only when the relevant minimums are zero.

## Development

```sh
forge build
forge test
```

The tests use local mocks for the Aerodrome router and gauge so the default suite is deterministic. Add a Base fork test before production deployment to validate the exact router routes, pool approvals, gauge reward behavior, and slippage assumptions at a fixed block.
