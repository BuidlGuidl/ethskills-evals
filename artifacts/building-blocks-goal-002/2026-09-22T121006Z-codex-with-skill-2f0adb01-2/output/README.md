# Base USDC Aerodrome Vault

First-pass onchain yield vault for Base. Users deposit USDC into `BaseUsdcYieldVault` and receive `baUSDC` shares. The vault sends idle USDC into `BaseAerodromeStrategy`, which swaps half to WETH, adds volatile USDC/WETH liquidity through the Aerodrome-compatible router, and stakes the LP token in the pool gauge. A keeper calls `harvest()` to claim gauge rewards, swap rewards back to USDC, and compound them into more USDC/WETH LP.

## Contracts

- `src/BaseUsdcYieldVault.sol`: ERC-4626-style USDC share vault with deposit, withdraw, redeem, share accounting, owner-managed strategy replacement, and reentrancy protection.
- `src/BaseAerodromeStrategy.sol`: Aerodrome router/gauge strategy for a USDC/WETH volatile pool.
- `src/interfaces/IAerodrome.sol`: Minimal router, pair, and gauge interfaces used by the strategy.
- `test/mocks/*`: Local Aerodrome and token mocks for deterministic unit tests.

## Deployment

1. Deploy `BaseAerodromeStrategy` with Base addresses:
   - USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
   - WETH: `0x4200000000000000000000000000000000000006`
   - Aerodrome router: `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`
   - Aerodrome factory: `0x420DD381b31aEf6683db6B902084cB0FFECe40Da`
   - USDC/WETH volatile pair, its gauge, the reward token, owner, and keeper.
2. Deploy `BaseUsdcYieldVault` with USDC, the strategy, and the owner.
3. Call `strategy.setVault(vault)` from the owner. This can only be set once.
4. Set operational parameters if needed:
   - `strategy.setKeeper(newKeeper)`
   - `strategy.setMaxSlippageBps(bps)`, capped at 10%
   - `strategy.setMinCompoundUsdc(amount)`

Before mainnet use, verify the live pair and gauge from Aerodrome's voter/factory contracts or deployment registry. The strategy assumes the reward route is a direct volatile `rewardToken -> USDC` Aerodrome route; deploy a small route-aware variant if the selected gauge needs multi-hop routing.

## Keeper Operation

The keeper calls:

```solidity
strategy.harvest();
```

`harvest()` claims gauge rewards, swaps non-USDC rewards to USDC, swaps half of available USDC to WETH, adds USDC/WETH liquidity, and stakes the resulting LP. The owner can also call `harvest()` as a fallback. Keepers should skip harvests when expected rewards are too small for gas or when slippage/route checks indicate poor execution.

## Integration Rationale

Aerodrome is the native liquidity hub on Base and is the best fit for a Base USDC/WETH LP vault. Its ve(3,3) gauge system pays LP incentives separately from swap execution, so the strategy can keep user funds in a deep Base-native DEX pair while compounding gauge rewards through `harvest()`.

USDC is the vault asset because it gives users a stable deposit and accounting unit. WETH is paired with USDC because it is the canonical volatile pair for Base liquidity and typically has strong routing depth. The vault intentionally exposes shares as a standard ERC-4626-style interface so other apps can integrate deposits, redemptions, and share-price accounting without a custom adapter.

## Development

```bash
forge build
forge test
```

The current test suite covers deposit pairing/staking, keeper-only harvesting, reward compounding, withdrawal, and redeem flows.

