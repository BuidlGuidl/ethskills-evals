# Why the probe fails, and how to run the same calls against real Aave + real USDC

## 1. What `yarn chain` actually gives you

`yarn chain` starts a **fresh, empty Anvil instance** — chain ID 31337, genesis block 0, no
history. Its entire world state is:

- the 10 deterministic dev accounts, each prefunded with 10000 test ETH;
- whatever `yarn deploy` just put there (your vault, plus any mocks the deploy script deploys).

That is all. It is not a copy of Base. Every Base address — USDC, the Aave V3 `Pool`,
`PoolAddressesProvider`, aTokens, oracles — is, on this chain, an address with **no code and no
storage**. Same numbers, nothing behind them.

## 2. Why the `cast call` "fails outright"

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> \
  --rpc-url http://localhost:8545
```

`0x8335…2913` is USDC **on Base**. On your local chain that address is empty, so the EVM has
nothing to execute. `eth_call` against a codeless address does not revert — it succeeds and
returns **empty returndata** (`0x`). The failure is one layer up: `cast` is told to decode the
result as `uint256`, gets zero bytes, and errors out on the decode. So the message you see is a
decoding/ABI error, not a revert — which is exactly the tell that the address is empty rather
than misbehaving.

## 3. Why your integration calls revert

Solidity's high-level external calls (`IPool(pool).supply(...)`, `IERC20(usdc).transferFrom(...)`)
compile to an `EXTCODESIZE` check on the target before/after the call. Against a codeless address
that check fails and the compiler-inserted guard **reverts**. Hence: probe → decode error,
contract call → revert. Two symptoms, one cause.

(If you had used a low-level `.call` without a code check, it would be worse: the call would
"succeed" against nothing and you'd silently book a deposit that never happened.)

## 4. Why the forge tests pass anyway

`forge test` runs in its own in-memory EVM where your test deploys `MockERC20` / `MockPool` and
hands those addresses to the vault. Those tests prove your vault behaves correctly **against your
assumptions about Aave**, encoded by you. They cannot catch: USDC's proxy/upgrade behaviour and
6-decimal accounting, USDC blocklist and `transferFrom` return-value quirks, Aave's real
`supply`/`withdraw` semantics, aToken rebasing, reserve caps, frozen/paused reserves, actual
liquidity, oracle prices, or a wrong hardcoded address. Green mock tests plus a reverting
integration is the normal signature of that gap.

## 5. The setup you want: a fork

Fork the real chain instead of starting an empty one.

```bash
# terminal 1 — replaces `yarn chain`
yarn fork --network base
```

Anvil now serves a local chain that **lazily pulls real Base state over RPC** as it is touched:
you call USDC, Anvil fetches USDC's code and the storage slots you read, and caches them. From
then on `0x8335…2913` has real code, real total supply, real balances; the Aave `Pool` has its
real implementation, reserves and interest state. Your original probe starts working with no
change to the command.

Requirements and settings:

- **An archive-capable Base RPC URL** in `packages/foundry/.env` (e.g. `ALCHEMY_API_KEY=…`), since
  Anvil backfills historical state on demand. Pin a block with `--fork-block-number <n>` when you
  want reproducible runs and a warm cache.
- **Deploy your vault onto the fork**, not onto Base: `yarn deploy --network localhost`. It lands
  next to the real protocol.
- **Point the frontend at the local chain, not at Base.** In
  `packages/nextjs/scaffold.config.ts` set `targetNetworks: [chains.foundry]` (chain ID 31337).
  This is the step teams get wrong: the fork *contains* Base state but *is* chain 31337. Selecting
  `chains.base` sends your wallet to the real network. Switch to `chains.base` only for a real
  deployment.
- Your vault's deployment artifact must be under chain 31337 in `deployedContracts.ts`; add USDC
  and the Aave `Pool` to `externalContracts.ts` **keyed under 31337** so `useScaffoldReadContract`
  /`useScaffoldWriteContract` resolve them on the fork.
- Point your forge integration tests at the same state:
  `forge test --fork-url http://localhost:8545` (or `--fork-url $BASE_RPC_URL`). Keep the mock
  tests — they're your fast unit layer — and add fork tests as the layer that would have caught
  this.

Verify the addresses rather than trusting a copied constant. Base USDC is
`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`; derive the Aave V3 Pool from the
`PoolAddressesProvider` (`0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D` on Base) so it can't go
stale:

```bash
cast call 0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D "getPool()(address)" \
  --rpc-url http://localhost:8545
# expect 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5

cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --rpc-url http://localhost:8545 | head -c 20   # non-empty => fork is live
```

## 6. What stays local — no real funds at risk

Everything. The fork is a **local copy**:

- Reads go out to your RPC provider; **writes never leave your machine**. No transaction from the
  fork is broadcast to Base, and nothing you do there exists on the real chain.
- You sign with Anvil's well-known dev keys, which hold no real assets. Never put a funded private
  key in `packages/foundry/.env` for this workflow.
- Impersonation, balance-setting and storage overrides (below) are Anvil RPC features that exist
  only in your local node. There is no counterpart on Base and no way for them to escape.
- The cost of a mistake is `Ctrl-C` and `yarn fork` again — state is thrown away on restart.

The one real-world resource you consume is RPC quota from your provider.

## 7. Getting a test account six figures of USDC

Do **not** deploy a mock USDC — that reintroduces exactly the gap that hid this bug. Move real
USDC that already exists in the forked state.

USDC has **6 decimals**, so 250,000 USDC is `250000000000`.

```bash
RPC=http://localhost:8545
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266   # anvil account #0
WHALE=<address that actually holds USDC on Base>

# 1. confirm the whale is fat enough at your fork block
cast call $USDC "balanceOf(address)(uint256)" $WHALE --rpc-url $RPC

# 2. make sure it can pay gas, then borrow its identity
cast rpc anvil_setBalance $WHALE 0xde0b6b3a7640000 --rpc-url $RPC   # 1 ETH
cast rpc anvil_impersonateAccount $WHALE --rpc-url $RPC

# 3. take 250,000 USDC
cast send $USDC "transfer(address,uint256)" $ME 250000000000 \
  --from $WHALE --unlocked --rpc-url $RPC

cast rpc anvil_stopImpersonatingAccount $WHALE --rpc-url $RPC

# 4. verify
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC   # 250000000000
```

Pick the whale at your fork block rather than from a hardcoded list — holdings move. Good
candidates on Base: the Base bridge / `L2StandardBridge`-adjacent balances, the Aave V3 aUSDC
reserve (the aToken contract holds the underlying), and large DEX pools. Screen candidates by just
running step 1 against each and taking the first with enough balance.

If no suitable holder exists, override storage directly instead:

```bash
SLOT=$(cast index address $ME 9)   # balances mapping slot — verify for this implementation
cast rpc anvil_setStorageAt $USDC $SLOT \
  0x000000000000000000000000000000000000000000000000000000003a35294400 --rpc-url $RPC
```

Note USDC is a proxy, so the balances mapping slot belongs to the *implementation's* layout;
confirm the slot index by reading a known holder's balance back before trusting it. Whale
impersonation is the more robust default precisely because it needs no layout knowledge.

For gas, give your test account ETH the same way: `cast rpc anvil_setBalance $ME 0x21e19e0c9bab2400000`.

## 8. One fork-specific trap: frozen time

Anvil mines only when a transaction arrives. Between transactions the latest block and
`block.timestamp` stand still, then jump in one step when the next transaction lands. Aave accrues
interest as a function of `block.timestamp`, so on an idle fork your aToken balance and any
"projected yield" panel will sit perfectly still and then leap — and any deadline, expiry or
vesting UI will read wrong. Mock tests using `vm.warp` will not show this.

For anything you interact with live, enable interval mining:

```bash
cast rpc anvil_setIntervalMining 1 --rpc-url $RPC
```

Or bake it in with `--block-time 1` on the fork script if the project should always run that way.
`evm_mine` restamps the timestamp once and freezes again immediately, and `evm_increaseTime` is a
controlled single-step tool — neither is a substitute for a running demo.

## 9. Checklist

1. `yarn fork --network base` running (archive-capable RPC configured).
2. `cast code <USDC>` returns non-empty; the original `balanceOf` probe decodes.
3. Aave Pool address derived from `PoolAddressesProvider`, not copy-pasted.
4. `yarn deploy --network localhost`; vault artifact under chain 31337.
5. `scaffold.config.ts` → `targetNetworks: [chains.foundry]`; USDC + Pool in `externalContracts.ts`
   under 31337.
6. Test account funded via whale impersonation; `balanceOf` confirms the amount.
7. `anvil_setIntervalMining 1` for live interaction.
8. Integration path re-run under `forge test --fork-url`, mocks retained as the unit layer.
