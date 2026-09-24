# Why the local integration reverts

`yarn chain` in a normal Scaffold-ETH 2 Foundry project starts a fresh local Anvil chain. It is not Base, and it is not a fork of Base unless you explicitly start it that way.

That fresh chain contains:

- Anvil's local chain state.
- The default funded development accounts.
- Whatever your `yarn deploy` script deployed locally, such as your vault.
- Any mocks your deploy script created on that local chain.

It does not contain Base mainnet state. In particular, it does not contain Circle's Base USDC contract at:

```text
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

and it does not contain Aave V3 Base contracts such as:

```text
Aave V3 Base Pool: 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5
Aave V3 Base PoolAddressesProvider: 0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D
```

So this probe fails:

```sh
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> \
  --rpc-url http://localhost:8545
```

because `localhost:8545` is answering from the fresh local chain. At that address there is no USDC bytecode, no proxy, and no storage. You are calling an address that only means "USDC on Base" when the RPC endpoint is actually Base, or a fork of Base. Mock-based Forge tests can still pass because they never exercise the real deployed USDC/Aave contracts; they exercise your mocks.

# Local setup that hits real Aave and real USDC

Run the local chain as a Base fork instead of an empty Anvil chain:

```sh
export BASE_RPC_URL=<your Base mainnet RPC URL>

yarn chain --fork-url "$BASE_RPC_URL" --fork-block-number <optional pinned block>
```

If your `yarn chain` script does not forward Anvil flags, run Anvil directly:

```sh
anvil --fork-url "$BASE_RPC_URL" --fork-block-number <optional pinned block>
```

Then deploy your vault to that local fork:

```sh
yarn deploy
```

Now `http://localhost:8545` is still local, but reads for existing Base addresses are served from the forked Base state. The exact same call to Base USDC works:

```sh
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> \
  --rpc-url http://localhost:8545
```

Your deployed vault is local, but its external integrations point at real Base bytecode and storage for USDC and Aave V3. That is the sweet spot for integration testing:

- Your vault deployment is local.
- Your transactions are local.
- Your state mutations are local to the Anvil process.
- No transaction is sent to Base.
- No real wallet funds are spent or moved.
- Restarting Anvil resets the fork unless you use persistence options.

# Giving a test account six figures of USDC

On a fork, you can impersonate an address that already has USDC in the forked Base state. A convenient source is Aave's Base USDC aToken contract, which normally holds the underlying USDC liquidity:

```text
USDC:       0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Aave aUSDC: 0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB
```

Example using Anvil's first default account as the recipient:

```sh
export RPC=http://localhost:8545
export USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export AAVE_USDC_ATOKEN=0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB
export DEV=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

cast rpc anvil_impersonateAccount $AAVE_USDC_ATOKEN --rpc-url $RPC
cast rpc anvil_setBalance $AAVE_USDC_ATOKEN 0x56BC75E2D63100000 --rpc-url $RPC

cast send $USDC \
  "transfer(address,uint256)(bool)" \
  $DEV \
  100000000000 \
  --from $AAVE_USDC_ATOKEN \
  --unlocked \
  --rpc-url $RPC

cast call $USDC "balanceOf(address)(uint256)" $DEV --rpc-url $RPC
```

`100000000000` is `100,000 USDC` because USDC has 6 decimals. The ETH balance set on the aToken address is also only fork-local gas money so the impersonated transfer transaction can be mined by Anvil.

After that, connect the app to the local fork, use the funded dev account, approve the vault to spend USDC, and call the integration paths. Those calls now reach real Base USDC and real Aave V3 contracts while all balances and writes remain trapped inside the local fork.

