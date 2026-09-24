# Why the localhost probe fails

`yarn chain` starts a fresh local Anvil chain. It has the deterministic
Foundry/Scaffold-ETH test accounts, local ETH balances, and only the contracts
that your deploy script sends to that local chain. It is not Base, and it does
not contain Base's deployed contract code or storage.

So on that chain, this address:

```bash
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

is just an address with no USDC contract code unless you explicitly deployed
something there. A `cast call` to an address with no code returns empty data;
because `cast` is trying to decode that empty data as a `uint256`, the probe
fails outright. The same underlying problem makes Aave/USDC integration calls
revert: the vault is calling real Base addresses, but localhost has no Aave V3
Pool, no USDC token, no aTokens, no oracle state, and no reserve configuration
at those addresses.

The mock-based Forge tests can still pass because they are proving a different
world: the test harness deploys mocks and points the vault at those mocks. That
does not prove that a blank `yarn chain` has real Base USDC or real Aave.

# The local setup that uses real Base state

Run a Base fork instead of a blank local chain:

```bash
# terminal 1
yarn fork --network base
```

Use a Base-capable RPC if your Scaffold-ETH setup requires one in `.env`, for
example `BASE_RPC_URL` or the RPC variable used by your Foundry config. The
important part is that Anvil is forked from Base while still listening locally
at `http://localhost:8545`.

Then deploy your vault to that fork:

```bash
# terminal 2
yarn deploy
```

Keep the frontend pointed at the local Foundry chain, usually `chains.foundry`
with chain id `31337`. Do not point the local app at live Base just because the
fork is copying Base. The fork is still the chain you are transacting against.

On this fork, the same calls now hit real Base bytecode and forked Base storage:

```bash
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
AAVE_POOL=0xA238Dd80C259a72e81d7e4664a9801593F98d1c5

cast code $USDC --rpc-url http://localhost:8545
cast call $USDC "balanceOf(address)(uint256)" <address> \
  --rpc-url http://localhost:8545
```

The USDC address is native USDC on Base. The Aave V3 Base Pool is:

```bash
0xA238Dd80C259a72e81d7e4664a9801593F98d1c5
```

Aave's Base PoolAddressesProvider is:

```bash
0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D
```

# What stays local

All transactions stay local. The fork reads Base state from your upstream RPC,
but your deploys, approvals, deposits, withdrawals, time travel, impersonation,
and balance edits are applied only to the Anvil process on `localhost:8545`.
No transaction is broadcast to Base, and no real funds are at risk.

That also means you can use fork-only powers that Base itself does not give
you: impersonating existing accounts, setting ETH balances for gas, or directly
overriding storage. Those mutations vanish when the fork process is reset.

# Giving a test account six figures of USDC

Use an account that already holds real USDC in the forked Base state, impersonate
it locally, and transfer USDC to your dev account. One convenient holder to use
on an Aave integration fork is the Aave Base USDC aToken contract, which holds
the underlying liquidity for supplied USDC:

```bash
RPC=http://localhost:8545
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
AAVE_USDC_ATOKEN=0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB
DEV=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# Give the impersonated holder local ETH for gas on the fork.
cast rpc anvil_setBalance $AAVE_USDC_ATOKEN 0x56BC75E2D63100000 \
  --rpc-url $RPC

# Locally unlock/impersonate that holder.
cast rpc anvil_impersonateAccount $AAVE_USDC_ATOKEN --rpc-url $RPC

# 100,000 USDC, because USDC has 6 decimals.
cast send $USDC "transfer(address,uint256)(bool)" $DEV 100000000000 \
  --from $AAVE_USDC_ATOKEN \
  --unlocked \
  --rpc-url $RPC

cast rpc anvil_stopImpersonatingAccount $AAVE_USDC_ATOKEN --rpc-url $RPC

cast call $USDC "balanceOf(address)(uint256)" $DEV --rpc-url $RPC
```

After that, `$DEV` has `100000000000` base units, i.e. `100,000 USDC`, on the
local fork. Your vault can approve and supply that USDC to the real forked Aave
V3 Pool, and those integration calls exercise the real Base USDC contract and
real Aave V3 contracts while still being a disposable local simulation.

# References

- Aave Base address book:
  https://github.com/aave-dao/aave-address-book/blob/main/src/AaveV3Base.sol
- Scaffold-ETH 2:
  https://github.com/scaffold-eth/scaffold-eth-2
