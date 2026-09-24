# Base USDC-WETH Yield Vault

First version of an onchain USDC vault for Base. Users deposit USDC into `YieldVault`; the vault pushes funds into `AerodromeUsdcWethStrategy`, which swaps half the USDC to WETH, adds USDC/WETH Aerodrome liquidity, and stakes the LP token in the matching Aerodrome gauge. A keeper calls `harvest()` to claim rewards, swap them back to USDC, and compound into more LP.

This is a focused v1 implementation and has not been audited.

## Build and Test

```bash
forge build
forge test
```

## Contracts

- `YieldVault`: USDC share vault with deposit, withdraw, redeem, and owner-configured strategy.
- `AerodromeUsdcWethStrategy`: Aerodrome router/gauge adapter for the USDC/WETH pool.
- `script/Deploy.s.sol`: environment-driven deployment script.
- `test/YieldVault.t.sol`: deterministic unit tests with local Aerodrome-style mocks.

## Deployment

Set the Base deployment inputs:

```bash
export OWNER=0x...
export KEEPER=0x...
export USDC=0x...
export WETH=0x...
export REWARD=0x...              # Aerodrome reward token, usually AERO
export AERODROME_ROUTER=0x...
export AERODROME_PAIR=0x...      # USDC/WETH pair
export AERODROME_GAUGE=0x...     # Gauge for that exact pair
export POOL_STABLE=false         # USDC/WETH should use the volatile pool
export REWARD_ROUTE_STABLE=false # direct reward->USDC route setting
```

Then deploy:

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast \
  --verify
```

Before funding the vault, confirm the pair, gauge, and route values from Aerodrome's current Base deployment sources. The strategy assumes a direct one-hop reward token to USDC swap route; add multi-hop routing before deployment if the selected reward market needs it.

## Keeper Operation

The keeper address or owner can call:

```solidity
strategy.harvest()
```

`harvest()` claims gauge rewards, swaps rewards to USDC through the Aerodrome router using `getAmountsOut` and the strategy slippage setting, then compounds idle USDC into USDC/WETH LP and deposits the LP back into the gauge.

Operational knobs:

- `setKeeper(address)`: rotate the keeper.
- `setMaxSlippageBps(uint256)`: cap swap/add-liquidity slippage, max 10%.
- `setMinDeployUsdc(uint256)`: avoid dust compounding.
- `setPaused(bool)`: stop new vault deposits from being deployed into the strategy.

## Integration Choices

Aerodrome was selected because it is the primary ve(3,3) liquidity and gauge system on Base, so the strategy can use native Base DEX liquidity and gauge rewards without bridging assets elsewhere. The strategy integrates only with the Aerodrome router, pair, and gauge interfaces to keep the first version small and easy to test.

The vault accepts native Base USDC because it is the user-facing accounting asset. WETH is the paired asset because it is the canonical ETH wrapper on Base and has deep liquidity against USDC.

