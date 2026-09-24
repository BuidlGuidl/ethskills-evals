# Base USDC/WETH Yield Vault

First version of an onchain USDC vault for Base. Users deposit native Base USDC into `YieldVault`; the vault forwards assets to `UniswapV3CompoundStrategy`, which swaps part of each deposit to WETH, opens or increases one Uniswap v3 LP NFT, and lets an approved keeper call `harvest()` to collect LP fees and add them back to the position.

## Project

```sh
forge build
forge test
```

Key files:

- `src/YieldVault.sol` - receipt-share vault and user deposit/redeem entrypoint.
- `src/UniswapV3CompoundStrategy.sol` - Uniswap v3 position strategy.
- `test/YieldVault.t.sol` - deterministic unit tests with ERC20, router, and position-manager mocks.

## Base Deployment

Verified on 2026-09-22 against Base mainnet RPC and protocol docs.

- Base chain ID: `8453`.
- Native Base USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` from Circle's native Base USDC announcement.
- WETH: `0x4200000000000000000000000000000000000006` from Uniswap's Base deployment docs.
- Uniswap v3 factory: `0x33128a8fC17869897dcE68Ed026d694621f6FDfD`.
- Uniswap v3 `NonfungiblePositionManager`: `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1`.
- Uniswap `SwapRouter02`: `0x2626664c2603336E57B271c5C0b26F421741e481`.

Deployment order:

1. Deploy `YieldVault` with native Base USDC, a name, and a symbol.
2. Deploy `UniswapV3CompoundStrategy` with the vault, USDC, WETH, router, position manager, fee tier, tick range, and keeper address.
3. Call `YieldVault.setStrategy(strategy)`.
4. Transfer vault and strategy ownership to the protocol multisig.

The strategy constructor takes a `StrategyParams` tuple. For the first production candidate, use the USDC/WETH Uniswap v3 pool chosen by current liquidity and execution monitoring. A live `getPool(USDC, WETH, fee)` check on 2026-09-22 returned existing pools for fee units `100` (0.01%), `500` (0.05%), and `3000` (0.30%); active liquidity was highest in the `3000` tier at that moment, so `poolFee = 3000` is the conservative initial pick unless a fresh check favors `500`.

## Keeper Operation

The keeper calls:

```solidity
strategy.harvest(minLiquidity);
```

`harvest()` collects all fees owed to the LP NFT and immediately calls `increaseLiquidity` with the collected USDC/WETH balances. Use `minLiquidity` as the keeper's slippage guard. The owner can rotate the keeper with `setKeeper(address)`.

Deposits and withdrawals also take minimum-output arguments:

- `deposit(assets, receiver, minWethOut, minLiquidity)` protects the initial USDC-to-WETH swap and LP mint/increase.
- `redeem(shares, receiver, owner, minAssetsOut)` protects the withdrawal unwind and WETH-to-USDC swap.

## Integration Rationale

Uniswap v3 was selected for v1 because it has official Base deployments, a canonical NFT position manager for programmatic LP ownership, and no extra reward-token gauge plumbing. The strategy compounds the position's native trading fees only, which keeps the asset flow small: USDC deposits, USDC/WETH LP balances, collected USDC/WETH fees, then compounded liquidity.

Native Circle USDC is used instead of bridged USDbC so deposits target the issuer-supported Base dollar asset. WETH is the wrapped native asset documented for Uniswap v3 on Base and is the deepest common pair asset for USDC liquidity.

This version is not an audited production vault. Accounting is debt-based and intentionally simple: `totalAssets()` reports deposited USDC principal, not a full oracle-priced LP valuation. Partial redeems can realize idle collected fees for the withdrawing user. Before mainnet deposits, add fork tests, oracle-based share pricing, tighter slippage quoting, emergency exits, and an audit.

Sources:

- Uniswap Base deployments: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-base-deployments
- Uniswap liquidity management guide: https://developers.uniswap.org/docs/protocols/v3/guides/managing-liquidity/getting-started
- Circle native USDC on Base: https://www.circle.com/blog/usdc-now-available-natively-on-base
- Base chain ID docs: https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId
