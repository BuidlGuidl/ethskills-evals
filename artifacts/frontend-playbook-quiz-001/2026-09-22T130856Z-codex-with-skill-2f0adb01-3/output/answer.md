# Why `yarn chain` breaks Aave/USDC integration calls

`yarn chain` starts a fresh local Anvil chain. It has the standard pre-funded dev accounts and whatever contracts your deploy script puts there, but it does **not** contain Base mainnet state. There is no Circle USDC contract at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, no Aave V3 Pool, no Aave reserves, no aUSDC, and no real Base storage.

So this probe fails:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> \
  --rpc-url http://localhost:8545
```

On the empty local chain, that address has no bytecode. You are calling `balanceOf` on an empty account, not on USDC. The mock-based Forge tests still pass because they deploy mocks inside the test VM. Those tests prove your vault works against the mock contracts, but they do not prove the locally running app is talking to Aave or USDC.

# Local setup that hits real Base Aave and real Base USDC

Use an Anvil fork of Base, not an empty chain:

```bash
# Terminal 1
yarn fork --network base

# Terminal 2
yarn deploy

# Terminal 3
yarn start
```

If your fork command needs an RPC provider, set the Base RPC env var used by your Scaffold-ETH/Foundry config first, for example an Alchemy/Infura/private Base RPC URL, then run the same fork command.

Important frontend gotcha: even though the state is forked from Base, the wallet/app should still target the local Anvil chain, usually `chains.foundry` / chain ID `31337`, because transactions are being sent to `http://localhost:8545`. Do not point the local frontend at real `chains.base` unless you actually intend to use Base mainnet.

With the fork running, the exact same `cast call` now reaches the real Base USDC contract bytecode and forked storage. Your vault can also call the real Aave V3 Base deployment, for example:

- Aave V3 Base Pool: `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`
- Aave V3 Base PoolAddressesProvider: `0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D`
- Base native USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

# What stays local

The fork is a local simulation with a copy-on-write overlay:

- Your vault deployment is local.
- Your transactions are local.
- Any USDC transfers, approvals, Aave supplies, withdrawals, borrows, and reverts are local.
- The fork reads real Base contracts and storage at the fork block, but it does not submit transactions to Base.
- No real USDC or ETH moves, and no real funds are at risk.

# Seeding a test account with six figures of USDC

On a fork, you can impersonate an existing Base account that already has lots of USDC, fund that impersonated account with local ETH for gas, and transfer local-fork USDC to your dev wallet.

Example flow:

```bash
RPC=http://localhost:8545
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
DEV=<your-local-test-account>
USDC_WHALE=<base-address-with-more-than-100000-USDC>

# Unlock the existing Base holder inside Anvil only.
cast rpc anvil_impersonateAccount $USDC_WHALE --rpc-url $RPC

# Give that impersonated holder local-only ETH for gas.
cast rpc anvil_setBalance $USDC_WHALE 0x3635C9ADC5DEA00000 --rpc-url $RPC

# Transfer 100,000 USDC; USDC has 6 decimals.
cast send $USDC \
  "transfer(address,uint256)(bool)" \
  $DEV 100000000000 \
  --from $USDC_WHALE \
  --unlocked \
  --rpc-url $RPC

cast call $USDC "balanceOf(address)(uint256)" $DEV --rpc-url $RPC
```

That last balance is real USDC contract logic and real USDC storage layout, but modified only in your local fork. The whale did not sign anything, the real Base balance did not change, and your dev account now has 100,000 fork-USDC to approve into the vault and supply into Aave.

Sources for the addresses: Aave's `AaveV3Base.sol` address book entry (`https://github.com/aave-dao/aave-address-book/blob/main/src/AaveV3Base.sol`) and the Base native USDC address shown there, `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
