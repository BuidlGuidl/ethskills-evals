# Base USDC LP Vault

First-version Foundry implementation of a Base-native USDC yield vault. Users deposit USDC and receive vault shares. A keeper calls `harvest()` on the strategy to collect DEX position earnings and compound idle USDC/WETH back into Uniswap V3-style USDC/WETH liquidity.

## Contracts

- `BaseUsdcVault`: ERC4626-style USDC share vault with deposit, withdraw, redeem, and strategy accounting.
- `UniswapV3UsdcWethStrategy`: keeper-operated strategy that swaps part of idle USDC to WETH, mints or increases a Uniswap V3 LP NFT, collects fees, and compounds them.
- `IPositionValueOracle`: valuation adapter used by the vault accounting path and conservative withdrawal math.
- `test/mocks/*`: deterministic router, position manager, token, and oracle mocks used by the local test suite.

## Build And Test

```bash
forge build
forge test
```

## Base Deployment

Deploy on Base mainnet (`chainId = 8453`) with:

- Native USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- WETH: `0x4200000000000000000000000000000000000006`
- Uniswap V3 NonfungiblePositionManager: `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1`
- Uniswap V3 SwapRouter02: `0x2626664c2603336E57B271c5C0b26F421741e481`
- Suggested pool fee: `500` for the 0.05% USDC/WETH pool, subject to liquidity checks before deployment.
- Suggested full-range ticks for 0.05% fee tier: `-887220` and `887220`.

Deployment order:

1. Deploy the production `IPositionValueOracle` implementation for USDC-denominated values.
2. Deploy `BaseUsdcVault(asset = USDC, owner = multisig)`.
3. Deploy `UniswapV3UsdcWethStrategy(vault, USDC, WETH, SwapRouter02, NonfungiblePositionManager, oracle, fee, tickLower, tickUpper, owner)`.
4. Call `vault.setStrategy(strategy)` from the owner.
5. Call `strategy.setKeeper(keeper, true)` for each keeper address.
6. Optionally tune `strategy.setWithdrawalSlippageBps(bps)`. The default is `50` bps and the contract caps this at `1000` bps.

The oracle is intentionally an adapter interface rather than hardcoded math in the strategy. For production, use an audited oracle implementation that values the current NFT liquidity and uncollected fees in USDC, using Uniswap pool state plus a manipulation-resistant price source.

## Keeper Operation

Deposits are transferred into the strategy as idle USDC. A keeper compounds by calling:

```solidity
strategy.harvest(
    UniswapV3UsdcWethStrategy.HarvestParams({
        minWethOut: minExpectedWeth,
        amount0Min: minToken0Used,
        amount1Min: minToken1Used,
        minLiquidity: minExpectedLiquidity,
        deadline: block.timestamp + 5 minutes
    })
);
```

The keeper should compute the minimums immediately before submission from current pool quotes and the expected mint/increase-liquidity result. `harvest()` reverts for non-keeper callers, expired deadlines, insufficient swap output, or insufficient liquidity minted.

Withdrawals are user-driven through the vault. If idle USDC is insufficient, the strategy burns enough LP liquidity, collects the withdrawn tokens, swaps WETH back to USDC with oracle-based slippage protection, and returns USDC to the vault.

## Integration Choices

Native USDC is used instead of bridged USDbC because it is Circle-issued on Base. WETH is the canonical wrapped native token on Base. Uniswap V3 periphery was selected for this first version because Base has official Uniswap V3 deployments, the NFT position manager gives explicit fee collection, and SwapRouter02 keeps the strategy integration narrow and easy to test. The strategy accepts constructor addresses rather than hardcoding them, so the same contract can be used on Base Sepolia or replaced with audited router/oracle adapters later.

Primary address references:

- Circle announcement for native USDC on Base: https://www.circle.com/blog/usdc-now-available-natively-on-base
- Uniswap V3 Base deployment list: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-base-deployments

## Notes

This is a first version and has not been audited. Before mainnet deposits, add a production oracle implementation, run fork tests against the live USDC/WETH pool, review LP range and slippage policy, and complete an external security review.

