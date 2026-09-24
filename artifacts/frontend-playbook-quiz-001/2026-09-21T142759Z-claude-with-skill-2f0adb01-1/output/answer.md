# Why every integration call reverts locally, and the fix

## What `yarn chain` actually gives you

`yarn chain` starts **Anvil with a brand-new, empty chain** (chain ID 31337, block 0). All it has:

- 10 pre-funded test accounts, each with 10,000 fake ETH
- whatever `yarn deploy` puts there, which is only **your** contracts

It has **no Aave, no USDC, no Uniswap, no contract code or storage from Base.** It is not a copy of Base. It is an empty chain that happens to run on your machine.

## Why the probe fails

`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is USDC on **real Base**. On the empty local chain, nothing is deployed at that address. It has no code.

- `eth_call` to an address with no code "succeeds" but returns empty data (`0x`).
- `cast` then tries to decode that empty data as `(uint256)` and fails. That's why it "fails outright".
- Inside Solidity it's worse. A call like `IERC20(usdc).balanceOf(x)` or `IPool(aavePool).supply(...)` expects return data and gets none, so it **reverts**. Newer Solidity versions also check that the target has code before a call, and revert when it doesn't. So every vault → Aave/USDC call reverts.

## Why the mock-based forge tests still pass

Mocks deploy **their own** `MockUSDC` / `MockPool` code at new addresses inside the test run. Your vault gets pointed at those mocks. So the tests only show that the vault works with *your idea of* Aave and USDC. They never touch the real addresses, and they don't check real behavior: USDC has 6 decimals, a blacklist and a proxy; Aave has supply caps, reserve state, aToken rebasing and pausing. The mocks pass and the local chain fails for the same reason: neither one contains the real protocols.

---

## The fix: fork Base instead of starting an empty chain

```bash
# Terminal 1: local Anvil that lazily copies real Base state
yarn fork --network base
#   (runs roughly: anvil --fork-url <Base RPC> --chain-id 31337)
#   make it permanent + keep time moving:
#   add `--block-time 1` to the fork script in packages/foundry/package.json

# Terminal 2: deploy YOUR vault onto the fork
yarn deploy

# Terminal 3: frontend
yarn start
```

Put a proper Base RPC (Alchemy etc.) in `packages/foundry/.env`, not a public endpoint. Forking makes many state reads, and public RPCs rate-limit them.

A fork starts from the latest Base block (or a pinned `--fork-block-number` if you want runs you can repeat). When a contract or storage slot is first used, Anvil fetches it from real Base, then keeps it locally. So on the fork:

- `0x8335...2913` **is** real USDC: same proxy, same code, same balances.
- The Aave V3 `Pool` / `PoolAddressesProvider` at their Base addresses are the real contracts, with real reserves, caps and interest rates.
- Your vault, deployed by `yarn deploy`, sits next to them, so the **exact same calls** now reach the real code.

The same probe now works:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> --rpc-url http://localhost:8545
```

### Required config (chain ID gotcha)

The fork is still a **local** Anvil chain with chain ID **31337**, not Base's 8453. So in `packages/nextjs/scaffold.config.ts`:

```ts
targetNetworks: [chains.foundry],   // NOT chains.base during local dev
```

Switch to `chains.base` only when you deploy for real.

### Keep time moving

```bash
cast rpc anvil_setIntervalMining 1   # or --block-time 1 in the fork script
```

Without this, `block.timestamp` only moves when a transaction is mined. Aave interest (aToken balances, `liquidityIndex`) then looks frozen, and anything tied to a time limit behaves oddly. To jump ahead and watch yield build up, use `cast rpc evm_increaseTime 86400 && cast rpc evm_mine`.

---

## What stays local (no real funds at risk)

- **Every transaction runs only in your local Anvil process.** Nothing is broadcast to Base. The real chain is only *read* through the RPC.
- Deploys, deposits, Aave supplies and withdrawals change only your local copy. Restarting `yarn fork` throws all of it away.
- The accounts that sign are Anvil's test keys (and the SE2 burner wallet), with fake ETH.
- Impersonation (below) only works on the local node. It does **not** give you control of anyone's real funds.
- One caveat: the RPC provider sees your read requests (which addresses and slots you look up). That exposes no funds, but it does use API quota.

Watch out for two things that are **not** local:
- Don't point MetaMask at Base mainnet and sign there by mistake.
- `yarn deploy --network base` deploys for real.

For local work, stay on `localhost:8545` / chain 31337.

---

## Giving a test account six figures of USDC

On the fork you can't mint USDC, but you can use Anvil's cheat RPC methods.

### Option A: impersonate a whale (simplest, closest to real)

Pick a large **ordinary holder** of USDC on Base from the Basescan "Holders" tab. An exchange hot wallet works well. Avoid protocol contracts like Aave's aUSDC or pool contracts: draining them breaks their accounting on your fork. Then:

```bash
RPC=http://localhost:8545
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
WHALE=<large USDC holder from Basescan>
ME=<your test account / burner wallet address>

# let the node accept txs "from" the whale without its key (local only)
cast rpc anvil_impersonateAccount $WHALE --rpc-url $RPC
# make sure the whale has gas money on the fork
cast rpc anvil_setBalance $WHALE 0x56BC75E2D63100000 --rpc-url $RPC   # 100 ETH

# transfer 250,000 USDC (6 decimals!)
cast send $USDC "transfer(address,uint256)" $ME 250000000000 \
  --from $WHALE --unlocked --rpc-url $RPC

cast rpc anvil_stopImpersonatingAccount $WHALE --rpc-url $RPC

# check
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC   # 250000000000
```

Also give `$ME` ETH for gas if it isn't an Anvil default account: `cast rpc anvil_setBalance $ME 0x56BC75E2D63100000`.

### Option B: overwrite the balance directly (`deal`)

In a forge script or test run against the fork, `deal(USDC, me, 250_000e6)` from forge-std finds USDC's balance storage slot and writes it directly. This is handy to run as part of `yarn deploy` (in the deploy script, only on chain 31337). It doesn't update `totalSupply` unless you ask it to, which is fine for testing.

Either way, the account now holds real-contract USDC on the fork. `approve` → `vault.deposit` → `Pool.supply` all run against real USDC and real Aave code.

---

## Also: fork your forge tests

Keep the mock tests for fast unit checks, but add fork tests that use the real contracts:

```bash
forge test --fork-url $BASE_RPC_URL            # or vm.createSelectFork("base") in setUp
```

These catch what mocks can't: 6-decimal math, supply caps, reserve pausing, and how aToken balances grow.

## TL;DR

| | `yarn chain` | `yarn fork --network base` |
|---|---|---|
| State | empty chain, only your contracts | lazy copy of live Base |
| USDC / Aave at real addresses | no code, so calls revert / fail to decode | real contracts |
| Chain ID | 31337 | 31337 (use `chains.foundry`) |
| Txs broadcast to Base | no | no (local only) |
| Test USDC | none | impersonate a whale or `deal` |
