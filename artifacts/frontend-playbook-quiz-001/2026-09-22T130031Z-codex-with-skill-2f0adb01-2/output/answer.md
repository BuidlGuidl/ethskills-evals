# What is happening

`yarn chain` starts a plain local Anvil chain. It has the prefunded local
dev accounts and whatever your deploy script deploys into that Anvil
instance. It does not contain Base mainnet state.

So on that chain:

- there is no real Base USDC contract at
  `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`;
- there is no real Aave V3 Base pool;
- there are no Base token balances, reserves, or oracle/configuration
  contracts;
- your forge mocks only exist inside the forge test process, unless your
  local deploy script separately deploys equivalent mocks to Anvil.

That is why this probe fails:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> \
  --rpc-url http://localhost:8545
```

On the empty local chain, that address has no USDC bytecode. The call returns
empty data, so `cast` cannot decode a `uint256`. Integration calls revert for
the same reason: the vault is calling hardcoded real Base/Aave addresses, but
the local chain does not have the contracts or storage behind those addresses.

# Correct local setup

Run a fork of Base instead of an empty chain:

```bash
# Terminal 1
yarn fork --network base

# Terminal 2
yarn deploy

# Terminal 3
yarn start
```

If your Scaffold-ETH script is not available, the equivalent Foundry command is:

```bash
anvil --fork-url $BASE_RPC_URL --chain-id 31337
```

Keep the frontend pointed at the local Foundry network while using the fork:

```ts
// scaffold.config.ts
targetNetworks: [chains.foundry]
```

The fork is still a local Anvil chain at `http://localhost:8545`, usually with
chain id `31337`. But reads and writes against existing Base addresses now use
forked Base bytecode and storage. The same `cast call` to the USDC address will
hit the real Base USDC contract state copied into the fork. Calls to the Aave
V3 Base pool will hit the real Aave deployment too.

Useful addresses for this vault:

```text
Base USDC:       0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Aave V3 Pool:   0xA238Dd80C259a72e81d7e4664a9801593F98d1c5
Aave aBasUSDC:  0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB
```

# What stays local

No real funds are at risk. The fork reads real Base state from your RPC
provider, but transactions are mined only by your local Anvil process. When you
approve USDC, deposit into the vault, call Aave, impersonate an account, or
transfer tokens, those mutations happen only in the fork's local state. Nothing
is broadcast to Base unless you explicitly send a transaction to a real Base
RPC with a real signer.

# Giving a test account six figures of USDC

Because this is a fork, you can impersonate an address that already has lots of
USDC on Base, give that address local ETH for gas, and transfer forked USDC to
your test account.

Example using the Aave USDC aToken contract as a USDC-rich source on the local
fork:

```bash
export RPC=http://localhost:8545
export USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export USDC_WHALE=0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB
export TEST_ACCOUNT=<your local account address>

# Give the impersonated holder local ETH for gas.
cast rpc anvil_setBalance $USDC_WHALE 0x56BC75E2D63100000 --rpc-url $RPC

# Unlock/impersonate it in Anvil.
cast rpc anvil_impersonateAccount $USDC_WHALE --rpc-url $RPC

# Transfer 100,000 USDC. USDC has 6 decimals, so 100000 USDC = 100000000000.
cast send $USDC \
  "transfer(address,uint256)(bool)" \
  $TEST_ACCOUNT \
  100000000000 \
  --from $USDC_WHALE \
  --unlocked \
  --rpc-url $RPC

cast rpc anvil_stopImpersonatingAccount $USDC_WHALE --rpc-url $RPC
```

After that, your test account has `100,000` forked USDC on the local Base fork.
It can approve your locally deployed vault, and the vault can call the real
forked USDC and Aave contracts at their real Base addresses.

For timestamp-sensitive Aave or vault logic, also enable interval mining:

```bash
cast rpc anvil_setIntervalMining 1 --rpc-url http://localhost:8545
```
