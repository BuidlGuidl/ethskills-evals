# Why your integration calls revert locally — and the fork setup that fixes it

## TL;DR

`yarn chain` boots an **empty** local Anvil chain. It contains your freshly
deployed vault and ten prefunded dev accounts — and *nothing else*. There is no
USDC, no Aave, no Uniswap. Your `cast call` to the real USDC address fails
because **there is no contract code at that address on your chain**. Your forge
tests pass because they deploy mocks, not the real protocols.

The fix is **fork mode**: `yarn fork --network base` makes a local copy of real
Base mainnet, so the exact same addresses (`0x8335…2913` USDC, the Aave V3 Pool,
etc.) resolve to the real bytecode and state — while every transaction still
executes only against your local copy. You then hand a test account six figures
of USDC with an Anvil cheat (impersonate a whale, or overwrite the balance slot
directly). No real funds are ever touched.

---

## 1. What `yarn chain` actually gives you

`yarn chain` runs **Anvil** (Foundry's local node) as a brand-new, empty
blockchain:

- **Chain ID `31337`** (Anvil's default) — *not* Base's `8453`. Even the chain ID
  is different from the network you think you're targeting.
- **Genesis state is empty.** No token contracts, no DeFi protocols, no mainnet
  history. The world state starts at zero and only contains what you put there.
- **Ten prefunded dev accounts**, each holding 10,000 test ETH (deterministic
  mnemonic). This ETH is fake and only exists on this local chain.
- **Your contracts, after `yarn deploy`.** `yarn deploy` runs your Foundry
  deploy scripts against that empty chain, so the only application code present
  is *your vault* — deployed to some fresh local address and written into
  `deployedContracts.ts` for the frontend.

So the chain the app talks to is: your vault + a handful of rich EOAs, floating
in a void. Aave and USDC are simply not there.

## 2. Why the probe reverts

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> \
  --rpc-url http://localhost:8545
```

`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is the **real USDC contract on Base
mainnet**. But on your empty local chain, that address has **no bytecode** — it's
an unused address like any other.

When you `call` a function on an address with no code, the EVM has nothing to
execute. It returns empty data (`0x`), and `cast` — expecting to ABI-decode a
`uint256` — errors out / reports a revert. Nothing about `balanceOf` is wrong;
the contract you're calling doesn't exist on this chain. Every "integration"
call your vault makes into Aave or USDC fails for the same reason: it's calling
into empty addresses.

## 3. Why the forge tests still pass

Your `forge test` suite never touches those real addresses. It either:

- deploys **mock ERC-20 / mock Aave** contracts and wires the vault to *those*
  addresses, or
- uses cheatcodes (`vm.mockCall`, `deal`, a mock pool) to fake the responses.

The tests validate your vault's logic against stand-ins. They prove the vault is
internally correct — they say nothing about whether real USDC/Aave exist on the
chain your app connects to. That's the gap between "tests pass" and "every call
reverts in the app."

## 4. The fix: fork mode (real protocols, still local)

Instead of an empty chain, fork real Base:

```bash
# Terminal 1 — local fork of real Base mainnet
yarn fork --network base

# Terminal 2 — deploy your vault onto the fork
yarn deploy

# Terminal 3 — frontend
yarn start
```

`yarn fork --network base` starts Anvil in **forking mode**: it points at a Base
mainnet RPC and lazily pulls real state on demand. Your local node now behaves as
a full copy of Base at the fork block. That means:

- `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` now has the **real USDC bytecode
  and storage** — the probe returns a real balance.
- The **Aave V3 Pool** (`0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` on Base) and
  every other protocol your vault integrates with are present with real config.
- Your vault, deployed on top, can `supply`/`withdraw`/`borrow` against the real
  Aave contracts exactly as it would in production.

The same `cast call` now succeeds against `localhost:8545`, because the code is
finally there.

### Two configuration gotchas that bite people here

**a) Frontend target network must be `chains.foundry` (31337), NOT `chains.base`.**
The fork still runs on Anvil at chain ID `31337`, even though it mirrors Base. In
`scaffold.config.ts`:

```ts
// during fork-mode development
targetNetworks: [chains.foundry],   // ✅  the fork is 31337
// targetNetworks: [chains.base],   // ❌  only when deploying to REAL Base
```

Point the wallet at `localhost:8545` / chain `31337`. If you target `chains.base`
the frontend talks to real mainnet, not your fork.

**b) Turn on block mining for time-dependent logic.** Aave accrues interest over
time; a frozen `block.timestamp` makes that (and any deadline/vesting logic)
silently misbehave.

```bash
cast rpc anvil_setIntervalMining 1
```

Make it permanent by adding `--block-time 1` to the fork script in
`packages/foundry/package.json`.

## 5. What stays local — why no real funds are at risk

Forking is **read-through, write-local**:

- **Reads** are pulled from the upstream Base RPC and cached, so you see real
  balances, real pool liquidity, real config.
- **Writes** (your transactions) mutate **only your local Anvil state**. They are
  *never* broadcast to Base mainnet. No mempool, no gas paid in real ETH, no
  onchain footprint.
- The whole thing runs on `http://localhost:8545` at chain ID `31337`. You can
  blow away and re-fork at will.

You get real protocol behavior with zero real-money risk. Nothing you do on the
fork can move mainnet funds, because your signed transactions never leave your
machine.

## 6. Giving a test account six figures of USDC

Your dev accounts start with fake ETH but **zero USDC** — the fork copies
mainnet, and mainnet doesn't owe your test key anything. Use an Anvil cheat to
fund it. Two clean options:

### Option A — Impersonate a whale and transfer (simplest, most realistic)

Pick an address that already holds a lot of USDC on Base (an exchange or bridge
hot wallet, a large Aave aToken reserve, etc.), impersonate it, and send:

```bash
WHALE=0x<address_holding_lots_of_usdc>
ME=0x<your_test_account>
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# let the fork sign as the whale without its private key
cast rpc anvil_impersonateAccount $WHALE

# make sure the whale has ETH for gas on the fork
cast rpc anvil_setBalance $WHALE 0xDE0B6B3A7640000   # 1 ETH

# 250,000 USDC (6 decimals) -> 250000 * 1e6
cast send $USDC "transfer(address,uint256)(bool)" $ME 250000000000 \
  --from $WHALE --unlocked --rpc-url http://localhost:8545

cast rpc anvil_stopImpersonatingAccount $WHALE
```

Because this is a local fork, "stealing" the whale's USDC affects only your copy.

### Option B — Overwrite the balance storage slot directly (deterministic)

No whale needed — just write the balance into USDC's storage. USDC on Base is a
FiatToken proxy whose balances live in a `mapping(address => uint256)`. Compute
the slot for your account and set it:

```bash
ME=0x<your_test_account>
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# balances mapping slot index (FiatTokenV2 => slot 9); verify for the deployment
SLOT=$(cast index address $ME 9)

# 250,000 USDC = 0x3A35294400
cast rpc anvil_setStorageAt $USDC $SLOT \
  0x0000000000000000000000000000000000000000000000000000003a35294400

# confirm
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url http://localhost:8545
```

`cast index address $ME 9` computes `keccak256(abi.encode(ME, 9))`, the storage
slot for that account's balance. (If the balance doesn't show up, the mapping
slot differs for that proxy/implementation — dump storage or check the verified
source to find it. Slot `9` is correct for the standard FiatTokenV2_x layout.)

Either way, the account now has six figures of spendable USDC on the fork and can
exercise your vault's deposit/withdraw/Aave flows end to end — against the *real*
USDC and *real* Aave, with no real money in play.

---

## Checklist to go from "everything reverts" to "everything works"

1. Stop `yarn chain`. Run `yarn fork --network base` instead.
2. `yarn deploy` onto the fork; `yarn start` the frontend.
3. Set `targetNetworks: [chains.foundry]` and point the wallet at `31337`.
4. `cast rpc anvil_setIntervalMining 1` (or `--block-time 1` in the fork script).
5. Fund a test account with USDC via impersonation or `anvil_setStorageAt`.
6. Re-run the probe — `balanceOf` now returns a real number, and integration
   calls hit real Aave and real USDC entirely on your local machine.
