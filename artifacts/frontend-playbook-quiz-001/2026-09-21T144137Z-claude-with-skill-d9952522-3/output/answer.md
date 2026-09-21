# Why the probe fails, and how to test against real Aave and real USDC locally

## What `yarn chain` actually gives you

`yarn chain` starts **Anvil**, a local test chain, with **empty state**: block 0, chain ID 31337, and ten test accounts pre-loaded with ETH. The only contracts on it are the ones `yarn deploy` just put there (your vault and anything your deploy script adds). It has no link to Base or any other real network.

So `0x8335…2913` (USDC on Base) is just an **empty address** on this chain. It has no code and no storage. When `cast call` runs `balanceOf` against it, the call "succeeds" but returns zero bytes. Cast then can't decode zero bytes as a `uint256`, so the probe errors out. It isn't reporting a zero balance. For the same reason, every vault call that touches the Aave Pool or USDC reverts: calling a function that should return something, on an address with no code, fails in Solidity (either the code-existence check or the return-data decoding).

**Why the forge tests pass anyway:** they deploy their own `MockUSDC` / `MockPool` inside the test. They never touch the real addresses, so they only prove your logic works against your mocks. They don't prove it works against the real Aave V3 or real USDC (6 decimals, blacklist, pause, Aave supply caps, aToken rounding, etc.).

**Rule of thumb:** use `yarn chain` for isolated contracts and mocks. Use a **fork** whenever behavior depends on protocols, tokens or balances that already exist on a real chain.

## The right setup: fork Base locally

```bash
# terminal 1: local Anvil node that copies Base state on demand
yarn fork --network base
# optional, for a live demo (see "Time" below): add --block-time 1 to the fork script

# terminal 2
yarn deploy          # deploys your vault to the local fork (localhost:8545)
yarn start
```

`yarn fork` runs Anvil with `--fork-url <Base RPC>`. It pulls real Base state (code, storage, balances) at the fork block from the RPC and caches it. Use a proper RPC key (Alchemy/Infura/etc. in `packages/foundry/.env`); public endpoints get rate-limited fast.

Now the **exact same addresses** work unchanged:

- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Aave V3 Pool (Base): `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`. Better: read it from `PoolAddressesProvider.getPool()` rather than hardcoding it.

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> --rpc-url http://localhost:8545
# now returns that address's real Base balance as of the fork block
```

Your vault constructor or deploy script should take these real addresses (not deploy mocks) when the target is the fork.

**Frontend:** in `packages/nextjs/scaffold.config.ts` keep `targetNetworks: [chains.foundry]` (chain ID 31337, localhost:8545). Do **not** switch it to `chains.base`. That would send the UI to the real Base network. Switch to `chains.base` only for an actual production deployment.

## What stays local (no real funds at risk)

Everything. The fork is a local copy. Reads fall through to Base for state you haven't touched yet. Every write (deploys, supplies, transfers, impersonated sends) exists **only in your Anvil process** and is never broadcast to Base. You sign with Anvil's well-known test keys (or the SE-2 burner wallet), not real keys. Kill the node and all of it disappears. Restart and you get a fresh copy.

## Giving a test account six figures of USDC

Don't deploy a mock token. Move real USDC that already exists on the fork, using Anvil's **impersonation**: Anvil lets you send transactions as any address without its private key. This is local-only.

Pick an address that holds plenty of USDC at the fork block. A good choice is the Aave aUSDC token contract, which holds the underlying USDC supplied to Aave. Check the holder first:

```bash
RPC=http://localhost:8545
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
WHALE=<large USDC holder, e.g. Aave aBasUSDC token or a big exchange wallet>
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266   # Anvil account #0, or your burner address

cast call $USDC "balanceOf(address)(uint256)" $WHALE --rpc-url $RPC   # confirm it has enough

cast rpc anvil_impersonateAccount $WHALE --rpc-url $RPC
cast rpc anvil_setBalance $WHALE 0x56BC75E2D63100000 --rpc-url $RPC  # 100 ETH for gas (needed if whale is a contract)

# USDC has 6 decimals: 250,000 USDC = 250000 * 1e6
cast send $USDC "transfer(address,uint256)" $ME 250000000000 \
  --from $WHALE --unlocked --rpc-url $RPC

cast rpc anvil_stopImpersonatingAccount $WHALE --rpc-url $RPC
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC      # 250000000000
```

If no suitable holder exists, `anvil_setStorageAt` can write the balance directly into USDC's balance mapping slot. In Forge scripts and tests you can use `deal(USDC, me, amount)`, which does the same thing. Impersonating a real holder is the most realistic option because the total supply stays consistent.

Put these steps in a small script (e.g. `yarn fund`) so every teammate gets the same state after each `yarn fork` restart.

## Gotchas on a fork

- **Time freezes between transactions.** Anvil only mines a block when a transaction arrives, so `block.timestamp` stays frozen, then jumps. Aave interest and your vault's share price won't move smoothly in the UI. For a live demo, run `cast rpc anvil_setIntervalMining 1` (or add `--block-time 1` to the fork). Use `evm_increaseTime` + `evm_mine` only for controlled one-step tests, e.g. "fast-forward 30 days and watch interest accrue".
- **Pin the fork block** (`--fork-block-number`) for tests you want to repeat exactly. Otherwise each restart picks up newer Base state (caps, rates, whale balances change).
- **Keep both test layers:** mocks for fast unit tests, plus fork tests (`forge test --fork-url $BASE_RPC`) against the real Pool and USDC before anything goes live.
