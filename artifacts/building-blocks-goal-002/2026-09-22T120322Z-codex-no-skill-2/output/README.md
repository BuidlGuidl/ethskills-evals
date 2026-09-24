# Base USDC/WETH Yield Vault

First-version Foundry implementation of an onchain USDC vault for Base. Users deposit native Base USDC and receive vault shares. A keeper calls `harvest()` on the strategy to collect Uniswap v3 position fees, swap any WETH fees back to USDC, split available USDC into USDC/WETH, and compound it into the LP NFT.

## Build and Test

```sh
forge build
forge test
```

## Deployment

The deployment script targets Base mainnet only:

```sh
export BASE_RPC_URL=...
export PRIVATE_KEY=...
export OWNER=0x...
export KEEPER=0x...
forge script script/DeployBase.s.sol:DeployBase \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast \
  --verify
```

The script uses native Base USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, WETH at `0x4200000000000000000000000000000000000006`, the Uniswap v3 swap router at `0x2626664c2603336E57B271c5C0b26F421741e481`, and the Uniswap v3 nonfungible position manager at `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1`.

## Keeper Operation

Deposits move USDC directly into the strategy as idle capital. The keeper periodically calls:

```solidity
strategy.harvest(
    minWethFromUsdc,
    minUsdcFromWeth,
    minLiquidityUsdc,
    minLiquidityWeth,
    deadline
);
```

Use conservative slippage bounds from an offchain quote, and a short deadline. On the first harvest the strategy mints the Uniswap v3 LP NFT; later harvests collect fees and increase liquidity. Withdrawals can remove liquidity and swap WETH back to USDC when idle USDC is insufficient.

## Integration Choices

Circle-issued native USDC is used because it is the canonical USDC asset on Base. Uniswap v3 is used because Base has official v3 periphery deployments, strong USDC/WETH liquidity, and a position-manager interface that lets the strategy own one LP NFT and compound fees without introducing a custom AMM integration.

This MVP accounts vault assets using USDC cost basis plus realized harvested fees. That keeps deposits, withdrawals, and compounding simple for a first version. Before production, add oracle-based NAV checks, range rebalancing policy, protocol fee controls, emergency NFT withdrawal handling, and an external audit.
