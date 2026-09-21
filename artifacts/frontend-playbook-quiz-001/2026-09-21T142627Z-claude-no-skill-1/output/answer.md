# Why every Aave/USDC call reverts locally, and how to fix it with a Base fork

## 1. What `yarn chain` actually gives you

In the foundry flavor, `yarn chain` runs plain **`anvil`**. That starts a **brand-new, empty blockchain** in memory:

- chain id `31337`, block 0 (the first block), made up on the spot
- 10 test accounts, each with 10,000 fake ETH (the well-known anvil test keys)
- **no contracts at all**, until `yarn deploy` adds yours

It is not Base. It has no link to Base. The addresses you know from Base (USDC `0x8335…2913`, the Aave V3 Pool, and so on) are **empty accounts** on this chain: no code, no storage.

## 2. Why the probe fails

`cast call 0x8335…2913 "balanceOf(address)(uint256)" …` sends a call to an address that has no code. The EVM (the engine that runs contracts) doesn't raise an error for that. It just returns **empty data**. `cast` then tries to read a `uint256` out of 0 bytes and fails (a "could not decode output / buffer overrun" style error). Check it yourself:

```bash
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://localhost:8545
# -> 0x   (no code)
```

Your vault's calls revert for the same reason. When Solidity calls a function through an interface (`IERC20(usdc).transferFrom`, `IPool(pool).supply`), it either checks first that the target has code, or it tries to decode a return value that never came back. Either way the call **reverts**.

**Why the forge tests still pass:** each test deploys its own `MockUSDC` / `MockPool` inside the test run. The tests never touch the real addresses, so they only prove your code works against your mocks, not against real Aave. Things mocks usually get wrong: USDC has 6 decimals, USDC can blacklist addresses and be paused, Aave has supply caps, and Aave's aToken balance grows over time as interest is added.

## 3. The fix: run anvil as a **fork** of Base

A fork is a local chain that starts from a copy of real Base state at a given block. Any account or storage slot you haven't touched yet is fetched on demand from a Base RPC (a node you query over the network). So at `0x8335…2913` you get the **real** USDC contract (proxy plus FiatToken code and all balances). At the Aave addresses you get the **real** Aave V3 Pool, its reserves, its price oracles and its aTokens. Every write stays on your machine.

### Setup

1. RPC key: put your Alchemy key (or any Base RPC URL) in `packages/foundry/.env`, e.g. `ALCHEMY_API_KEY=...`. SE-2's `foundry.toml` already maps `base` in `[rpc_endpoints]` to an Alchemy URL. The public default key hits rate limits fast on a fork.

2. **Replace `yarn chain` with the fork command** (terminal 1):

   ```bash
   yarn fork --network base
   # which is roughly:
   # anvil --fork-url https://base-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY --chain-id 31337
   ```

   Or run anvil directly and pin a block so results are repeatable and cached:

   ```bash
   anvil --fork-url "$BASE_RPC_URL" --fork-block-number <recent block> --chain-id 31337
   ```

   Keep **`--chain-id 31337`** (SE-2's fork script already does). The frontend (`targetNetworks: [chains.foundry]` in `scaffold.config.ts`), the burner wallet and `yarn deploy` all expect 31337, and it keeps your wallet from mixing this chain up with real Base (8453). The side effect: inside the fork, `block.chainid` is 31337. Don't make contract logic depend on it.

3. **Deploy as before** (terminal 2): `yarn deploy`. It still deploys to `localhost`, which is now the fork. Pass the real addresses to your vault's constructor/script:
   - USDC (Base): `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
   - Aave V3 `PoolAddressesProvider` (Base): `0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D`. Get the Pool address from `provider.getPool()` rather than hardcoding it. (The Pool is currently `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`. Double-check both against the Aave address book, `@bgd-labs/aave-address-book` → `AaveV3Base`.)

4. `yarn start` as before. The probe now works:

   ```bash
   cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "balanceOf(address)(uint256)" <addr> --rpc-url http://localhost:8545
   ```

   It returns the real Base balance of `<addr>` as of the fork block.

### What stays local (no real funds at risk)

- Every transaction (deploys, `supply`, `withdraw`, transfers) is executed and stored **only in anvil's memory**. The Base RPC is used **only to read** state. Nothing is ever broadcast to Base.
- The accounts you sign with are anvil's public test keys (or impersonated accounts, see below). No real private key is involved and no real ETH or USDC moves.
- Kill anvil and the whole thing is gone. Restart it and you get a fresh copy of Base (redeploy, re-fund).
- The only way to touch real funds is to deploy to the real network on purpose (`yarn deploy --network base` with a real keystore). Don't do that during local dev.

### Getting six figures of USDC into a test account

Fake ETH for gas is already there (10,000 ETH per anvil account). For USDC, pick one of these:

**A. Anvil's built-in "deal" (simplest)**: writes the balance straight into the real USDC contract's storage on your fork:

```bash
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266     # anvil account #0, or your burner/MetaMask address
cast rpc anvil_dealERC20 $USDC $ME $(cast to-uint256 250000000000) --rpc-url http://localhost:8545
# 250,000 USDC = 250000 * 10^6 (USDC has 6 decimals)
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url http://localhost:8545
```

(Same effect with raw storage writes: USDC's `balanceOf` mapping is at slot 9, so `cast index address $ME 9` gives the slot, then `anvil_setStorageAt`. The deal helper does this for you.)

**B. Impersonate a real USDC holder**: this moves real-looking tokens with a normal `transfer`. Pick an address that holds lots of USDC on Base (e.g. a big exchange wallet, or Aave's own aUSDC contract) from BaseScan:

```bash
WHALE=<address holding lots of USDC on Base>
cast rpc anvil_impersonateAccount $WHALE --rpc-url http://localhost:8545
cast rpc anvil_setBalance $WHALE 0x56BC75E2D63100000 --rpc-url http://localhost:8545   # 100 ETH for gas
cast send $USDC "transfer(address,uint256)" $ME 250000000000 \
  --from $WHALE --unlocked --rpc-url http://localhost:8545
cast rpc anvil_stopImpersonatingAccount $WHALE --rpc-url http://localhost:8545
```

Impersonation only works because anvil skips signature checks for that address on your local fork. You never have the whale's key, and the real whale on Base is unaffected.

Wrap A or B in a script (e.g. `yarn fund`) and run it after every `yarn fork` + `yarn deploy`. A fresh fork has none of your local changes.

## 4. Keep the forge tests honest too

Keep the mock tests for fast unit checks, and add **fork tests** that run against real Base contracts:

```solidity
function setUp() public {
    vm.createSelectFork(vm.rpcUrl("base"), FORK_BLOCK); // pin a block for repeatable, cached runs
    vault = new Vault(USDC, AAVE_POOL_ADDRESSES_PROVIDER);
    deal(USDC, alice, 250_000e6);                        // forge-std cheatcode, tests only
}
```

Run with `forge test --fork-url ...`, or rely on `createSelectFork` as above. This catches what mocks miss: 6 decimals, supply caps, a frozen or paused reserve, the aToken balance growing over time, USDC's blacklist and pause checks.

## TL;DR

- `yarn chain` = empty local anvil chain. Real Base addresses have no code there, so calls return nothing and revert. Mocks hide this.
- Use `yarn fork --network base` (anvil `--fork-url <Base RPC> --chain-id 31337`, ideally with `--fork-block-number`). The same addresses now run real USDC and real Aave V3 code and state.
- All writes stay in local anvil memory. Base is only read. No real keys, no real funds.
- Fund test accounts with `anvil_dealERC20` (or impersonate a USDC whale and `transfer`), e.g. 250,000 USDC = `250000000000` (6 decimals). Use `deal()` in forge fork tests.
