# Why `yarn chain` breaks this integration

`yarn chain` starts a fresh local Anvil chain. It has the deterministic
Anvil accounts, local ETH balances, and whatever your `yarn deploy` script
deploys into that empty chain. It does not contain Base mainnet state.

So on that chain:

- Base USDC is not deployed at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- Aave V3 Base contracts are not deployed at their Base addresses.
- No real Base token balances, reserves, or oracle state exist.
- Your locally deployed Vault may exist, but the external contracts it points
  at are just empty addresses unless you deployed mocks at those same addresses.

That is why this probe fails:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> \
  --rpc-url http://localhost:8545
```

On the plain local chain, there is no ERC20 bytecode at the Base USDC address.
The EVM call returns empty data, and `cast` cannot decode empty returndata as a
`uint256`. Your integration calls revert for the same reason: the Vault is
calling Aave/USDC addresses that only make sense on Base, not on an empty local
chain.

The mock-based Forge tests pass because they are exercising mocks inside the
test VM. They prove your code works against the mocked interfaces; they do not
prove that `localhost:8545` contains real Base USDC or real Aave V3.

# Local setup that hits real Base Aave and real Base USDC

Run a Base fork instead of a blank chain:

```bash
# Terminal 1
yarn fork --network base

# Optional but useful if your logic depends on time passing
cast rpc anvil_setIntervalMining 1 --rpc-url http://localhost:8545

# Terminal 2
yarn deploy

# Terminal 3
yarn start
```

In the frontend config, keep the development target as the local Foundry chain:

```ts
targetNetworks: [chains.foundry]
```

Even though the forked state is copied from Base, the RPC you connect to is
still local Anvil, normally chain ID `31337`. Do not point the local frontend at
`chains.base` unless you are intentionally using the real Base network.

Now the same probe should hit the forked Base USDC contract:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> \
  --rpc-url http://localhost:8545
```

And your Vault can call the real forked Aave V3 Base Pool:

```text
Aave V3 Base Pool: 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5
Base USDC:          0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

The important nuance: you are not deploying Aave or USDC locally. Anvil is
forking Base, so those contracts already exist with their real code and storage
as of the fork block. You only deploy your own Vault locally on top of that
forked state.

# What stays local and why no real funds are at risk

All transactions sent to `http://localhost:8545` are local fork transactions.
They mutate Anvil's local copy of Base state only. They are not broadcast to
Base, they do not spend real ETH, and they do not move real USDC.

What is real:

- The bytecode at the Base USDC address.
- The bytecode and configuration of the Aave V3 Base Pool.
- Forked storage such as reserve configuration, token balances, and oracle data.

What is local:

- Your deployed Vault.
- Your test wallet's ETH on chain ID `31337`.
- Any approvals, deposits, withdrawals, liquidations, or token transfers you do
  while connected to `localhost:8545`.
- Any USDC you transfer to yourself by impersonating a rich holder on the fork.

# Giving a test account six figures of forked USDC

Default Anvil accounts have local ETH, but they do not magically have USDC.
Because this is a fork, you can impersonate a USDC-rich Base address and
transfer forked USDC to your test account.

Example using the default first Anvil account and the Aave Base USDC aToken
address as a USDC-rich holder:

```bash
RPC=http://localhost:8545
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
RICH_USDC_HOLDER=0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB
TEST_ACCOUNT=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# Let the rich holder pay local fork gas.
cast rpc anvil_setBalance $RICH_USDC_HOLDER 0x56BC75E2D63100000 --rpc-url $RPC

# Unlock/impersonate it on the local fork.
cast rpc anvil_impersonateAccount $RICH_USDC_HOLDER --rpc-url $RPC

# Transfer 100,000 USDC. USDC has 6 decimals, so this is 100_000 * 1e6.
cast send $USDC "transfer(address,uint256)" \
  $TEST_ACCOUNT 100000000000 \
  --from $RICH_USDC_HOLDER \
  --unlocked \
  --rpc-url $RPC

cast rpc anvil_stopImpersonatingAccount $RICH_USDC_HOLDER --rpc-url $RPC

# Confirm the local forked balance.
cast call $USDC "balanceOf(address)(uint256)" $TEST_ACCOUNT --rpc-url $RPC
```

That `100000000000` result is `100,000 USDC` because USDC uses 6 decimals.
From there the test account can approve your Vault, deposit into your Vault,
and have the Vault supply to Aave against real forked Aave/USDC contracts.

Source for the Base addresses: the official Aave address book lists the Base
Pool, USDC underlying, and USDC aToken addresses:
https://github.com/aave-dao/aave-address-book/blob/main/src/AaveV3Base.sol
