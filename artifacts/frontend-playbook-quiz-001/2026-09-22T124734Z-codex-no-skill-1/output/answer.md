`yarn chain` is only a fresh local Anvil chain. It is not Base, and it is
not a fork of Base unless you start it with a fork URL.

So the chain behind `http://localhost:8545` currently contains:

- Anvil's local funded test accounts.
- Whatever your `yarn deploy` script deployed into that local chain.
- Any mocks your deploy/test setup created.
- No Base mainnet state, unless you explicitly forked Base.
- No contract code at Base mainnet addresses unless you deployed code there yourself.

That is why this probe fails:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> \
  --rpc-url http://localhost:8545
```

`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is native USDC on Base. On
your fresh local chain it is just an address with no USDC bytecode. The call
returns empty data, or gets decoded as a failed ABI call, because there is no
ERC20 contract there. This is different from "the address has 0 USDC"; the
token contract itself is missing on that chain.

The mock-based Forge tests pass because they are testing against mock
contracts deployed in the test VM, not against the real Base USDC contract or
the real Aave V3 Base pool.

For local integration testing, run Anvil as a Base fork:

```bash
export BASE_RPC_URL=https://mainnet.base.org

# If your Scaffold-ETH script forwards args to Anvil:
yarn chain --fork-url $BASE_RPC_URL --chain-id 31337

# Or run Anvil directly:
anvil --fork-url $BASE_RPC_URL --chain-id 31337 --host 127.0.0.1 --port 8545
```

Then deploy your vault to that local fork:

```bash
yarn deploy
```

Now calls to Base addresses through `http://localhost:8545` hit the real
forked contracts and forked storage:

```bash
export LOCAL_RPC=http://127.0.0.1:8545
export USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export AAVE_POOL=0xA238Dd80C259a72e81d7e4664a9801593F98d1c5
export AAVE_PROVIDER=0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D

cast call $USDC "decimals()(uint8)" --rpc-url $LOCAL_RPC
cast call $AAVE_PROVIDER "getPool()(address)" --rpc-url $LOCAL_RPC
```

The important bit: this is still local. Your vault deployment is local. Your
transactions are local. Account balances, approvals, deposits, withdrawals,
and any state changes happen only inside Anvil's fork overlay. Nothing is
sent to Base mainnet, and no real funds are at risk as long as your app,
scripts, and wallet are pointed at `http://localhost:8545`.

To give a local test account six figures of USDC, impersonate an address that
has USDC in the forked Base state and transfer from it on the local fork. One
convenient source is Aave's Base USDC aToken address, which holds the reserve
USDC on Base:

```bash
export LOCAL_RPC=http://127.0.0.1:8545
export USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export USDC_SOURCE=0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB
export USER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# Give the impersonated address local ETH for gas.
cast rpc anvil_setBalance $USDC_SOURCE 0x56BC75E2D63100000 --rpc-url $LOCAL_RPC

# Impersonate it only inside Anvil.
cast rpc anvil_impersonateAccount $USDC_SOURCE --rpc-url $LOCAL_RPC

# USDC has 6 decimals, so 100,000 USDC = 100000 * 1e6 = 100000000000.
cast send $USDC \
  "transfer(address,uint256)(bool)" \
  $USER \
  100000000000 \
  --from $USDC_SOURCE \
  --unlocked \
  --rpc-url $LOCAL_RPC

cast rpc anvil_stopImpersonatingAccount $USDC_SOURCE --rpc-url $LOCAL_RPC

cast call $USDC "balanceOf(address)(uint256)" $USER --rpc-url $LOCAL_RPC
```

That final balance should be `100000000000`, meaning `100,000 USDC` with 6
decimals. The USDC contract is the real Base USDC bytecode from the fork; the
balance transfer is local-only fork state.
