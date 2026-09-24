# Why the Base USDC probe fails on `yarn chain`

`yarn chain` starts a fresh local Anvil chain. In Scaffold-ETH 2 this is the isolated Foundry/localhost network, normally chain ID `31337`. It contains the deterministic Anvil accounts, ETH balances for those accounts, and whatever contracts your local deploy script put there with `yarn deploy`.

It does not contain Base mainnet state.

So on that chain, Base's native USDC address:

```text
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

is just an arbitrary address. There is no USDC bytecode there, no USDC balances mapping, no Circle proxy/admin setup, and no Aave V3 deployment at the real Base Aave addresses. A call such as:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> \
  --rpc-url http://localhost:8545
```

therefore asks the blank local chain to ABI-call an address with no contract code. The result is empty data, so `cast` cannot decode a `uint256`. The same root cause explains the integration reverts: mock-based Forge tests pass because they deploy mocks into the local test VM, but the app/integration path is pointing at real Base contract addresses on a chain that does not have those contracts.

# Local setup that hits real Base USDC and Aave

Use a local fork of Base instead of a blank local chain:

```bash
# Terminal 1
yarn fork --network base
```

If the project script is not available, the raw Foundry equivalent is:

```bash
anvil --fork-url "$BASE_RPC_URL" --chain-id 31337
```

Then deploy your vault to that fork:

```bash
# Terminal 2
yarn deploy
```

And run the app against the local Foundry/localhost network, not Base mainnet:

```bash
# Terminal 3
yarn start
```

The important detail is that the frontend wallet/network should remain on the local Anvil network, usually chain ID `31337`. The RPC endpoint is still `http://localhost:8545`, but Anvil serves code and storage from a forked copy of Base. Your vault contract is local; Base USDC and Aave V3 are the real deployed contracts and state as of the forked block.

On that fork, the same probe should now work:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <address> \
  --rpc-url http://localhost:8545
```

Useful Base addresses:

```text
Base native USDC:              0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Aave V3 Base PoolAddressesProvider: 0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D
Aave V3 Base Pool:            0xA238Dd80C259a72e81d7e4664a9801593F98d1c5
```

For production-style contract code, prefer resolving the Pool from Aave's `PoolAddressesProvider` instead of hard-coding the Pool address forever.

# What stays local

Even though the fork reads real Base bytecode and storage, your transactions are not broadcast to Base. They mutate only the local Anvil fork. That means:

- no real USDC moves;
- no real Aave position is opened;
- no real funds are at risk;
- impersonation and balance-setting RPC calls are local Anvil powers, not Base features;
- restarting the fork resets the local changes unless you configured persistent fork state.

Think of it as a local copy of Base with write access for testing.

# Funding a test account with six figures of forked USDC

Pick a USDC-rich address on Base from the current holder list, then impersonate it on the fork and transfer test USDC to your local account. For example, if your local deployer/browser account is the first Anvil account:

```bash
export RPC=http://localhost:8545
export USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export TEST_ACCOUNT=0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
export USDC_WHALE=<base-usdc-rich-holder>

# Optional but handy: give the impersonated account local ETH for gas.
cast rpc anvil_setBalance $USDC_WHALE 0x56BC75E2D63100000 --rpc-url $RPC

# Unlock that Base holder locally.
cast rpc anvil_impersonateAccount $USDC_WHALE --rpc-url $RPC

# USDC has 6 decimals, so 100,000 USDC is 100000000000 base units.
cast send $USDC \
  "transfer(address,uint256)(bool)" \
  $TEST_ACCOUNT \
  100000000000 \
  --from $USDC_WHALE \
  --unlocked \
  --rpc-url $RPC

cast rpc anvil_stopImpersonatingAccount $USDC_WHALE --rpc-url $RPC

cast call $USDC \
  "balanceOf(address)(uint256)" \
  $TEST_ACCOUNT \
  --rpc-url $RPC
```

Now the test account has 100,000 fork-local USDC. From there, the app can approve the local vault, the vault can call the real Base USDC contract, and the vault can integrate with the real Aave V3 Base Pool, all while every write remains confined to localhost.

Sources:

- Circle's Base USDC announcement lists native Base USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`: https://www.circle.com/blog/usdc-now-available-natively-on-base
- Aave's address book lists Aave V3 Base addresses, including USDC, PoolAddressesProvider, and Pool: https://github.com/aave-dao/aave-address-book/blob/main/src/AaveV3Base.sol
- Aave docs describe `PoolAddressesProvider` as the registry to use when locating the current Pool: https://docs-aave.vercel.app/docs/aave-v3/smart-contracts/pool-addresses-provider
