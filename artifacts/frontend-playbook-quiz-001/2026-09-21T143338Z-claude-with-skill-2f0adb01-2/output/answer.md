# Why the Aave/USDC calls revert locally, and how to fix it

## What `yarn chain` gives you

In the foundry flavor, `yarn chain` starts a **new, empty Anvil chain** (chain ID 31337) that starts at block 0. It has:

- 10 test accounts, each funded with 10,000 fake ETH (the well-known Anvil keys)
- whatever `yarn deploy` puts on it (your vault)
- **nothing else**: no Aave, no USDC, no Uniswap, no token balances. It is not connected to Base at all.

## Why the probe fails

`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is USDC's address **on Base**. On your local chain nobody ever deployed anything there, so it's an empty account with no code. Calling it returns empty data (`0x`). cast can't read a `uint256` out of that, so it stops with an error like "contract … does not have any code". Your vault fails for the same reason: every call to USDC or to the Aave Pool goes to an address that has no code, gets back nothing (or fails Solidity's check that the target has code), and reverts.

The forge tests pass because they deploy **mock** USDC/Aave contracts inside the test's own in-memory chain. They only prove the vault works against your mocks. They say nothing about the real contracts, and they never touch the `yarn chain` node.

## The right setup: fork Base

A fork is still a local Anvil node, but it reads missing state from a real Base RPC, starting at a fixed block. Every contract, storage slot and balance on Base is visible at the same address. So the exact same `cast call` works without changes.

```bash
# packages/foundry/.env: set a real Base RPC key (e.g. ALCHEMY_API_KEY=...)
# public endpoints rate-limit hard; forks make many requests

yarn fork --network base      # Terminal 1: replaces `yarn chain`
yarn deploy                   # Terminal 2: deploys your vault onto the fork
yarn start                    # Terminal 3: frontend

# Required: without this, block.timestamp stays frozen between txs
# (Aave interest, oracle staleness checks, deadlines all break)
cast rpc anvil_setIntervalMining 1
# To make it permanent, add `--block-time 1` to the fork script in packages/foundry/package.json
```

**Chain ID gotcha:** the fork still runs as chain **31337**, not 8453. In `packages/nextjs/scaffold.config.ts` keep:

```ts
targetNetworks: [chains.foundry], // NOT chains.base while developing on the fork
```

Point the wallet (MetaMask etc.) at `http://localhost:8545` with chain ID 31337. Switch to `chains.base` only when you deploy to the real Base network.

Now the probe works:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> --rpc-url http://localhost:8545
# → that address's real Base USDC balance as of the fork block
```

Real addresses on Base that your vault uses:

| Contract | Address |
|---|---|
| USDC (native, Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Aave V3 PoolAddressesProvider | `0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D` |
| Aave V3 Pool | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` |

Best practice: get the Pool by calling `PoolAddressesProvider.getPool()` instead of hardcoding it. Check these addresses against Aave's address book before you rely on them.

## What stays local (no real funds at risk)

- Every transaction you send goes **only to your local Anvil node**. Nothing is ever sent to Base. Real Aave, real USDC and real users are never affected.
- The fork **reads** from Base via your RPC. Your local changes go into a local copy on top of that. Restart the fork and all of it is gone.
- Use only Anvil's default test accounts, or the SE2 burner wallet. They hold fake ETH. Never load a real private key into a local dev setup.
- The fork is fixed at the block where it started. It won't see new Base activity until you restart it.

## Getting six figures of USDC into a test account

Anvil lets you **act as any address without its private key** (called "impersonation"). So you pick an address that holds lots of USDC on Base and move some of its USDC to your test account. It happens only on your fork, so no real USDC moves.

```bash
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
WHALE=<any address with a large Base USDC balance: check the USDC holders tab on basescan>
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266   # Anvil account #0 (or your burner/wallet address)

cast rpc anvil_setBalance $WHALE 0x56BC75E2D63100000        # give the whale 100 ETH for gas
cast rpc anvil_impersonateAccount $WHALE
cast send $USDC "transfer(address,uint256)" $ME 250000000000 \
  --from $WHALE --unlocked --rpc-url http://localhost:8545  # 250,000 USDC (6 decimals)
cast rpc anvil_stopImpersonatingAccount $WHALE

cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url http://localhost:8545
# → 250000000000
```

Option without a whale: in a forge script or fork test, use `deal(USDC, me, 250_000e6)`. It writes the balance straight into USDC's storage.

Then the full real flow works from the UI or with cast: approve the vault → deposit → the vault calls `Pool.supply` on real Aave code → you get real aUSDC back, and interest grows as blocks are mined.

## Tests against the real contracts too

Keep the mock tests for unit logic. Add fork tests that run against real Aave and USDC:

```bash
forge test --fork-url $BASE_RPC_URL            # or vm.createSelectFork("base") in setUp
forge test --fork-url $BASE_RPC_URL --fork-block-number <N>   # fixed block = repeatable results + RPC cache
```
