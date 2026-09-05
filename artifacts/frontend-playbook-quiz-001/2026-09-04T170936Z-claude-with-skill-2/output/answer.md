# Why the probe fails, and how to make the same calls hit real Aave + real USDC

## 1. What `yarn chain` actually gives you

`yarn chain` starts a **fresh, empty Anvil node** — a brand-new chain whose state
is genesis plus whatever you deploy into it:

- chain ID `31337`
- ~10 dev accounts prefunded with ETH (the standard mnemonic)
- **no other contracts, no tokens, no protocols, no history**

The only bytecode on that chain is what `yarn deploy` put there — your vault, plus
any mocks your deploy script deploys. Base mainnet is not involved in any way.

So `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is a meaningful address on **Base
mainnet** (USDC). On your local chain it is just an address that has never been
touched: balance 0, **code size 0**.

Confirm it in one line:

```bash
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://localhost:8545
# 0x   <- no code
```

## 2. Why the probe "fails outright" instead of reverting

A `CALL` to an address with no code is **not** an error in the EVM. It succeeds
and returns empty return data (`0x`). Nothing reverts — there is no contract to
revert.

The failure you see comes from `cast`, one layer up: you told it the return type
is `(uint256)`, it got zero bytes back, and it cannot decode a `uint256` from an
empty buffer. That's why the message looks like a tooling/decoding error rather
than a clean `execution reverted`.

Your *vault* calls behave slightly differently and do revert, because Solidity
inserts an `extcodesize` check before high-level external calls to a typed
interface (`IERC20(usdc).balanceOf(...)`, `IPool(pool).supply(...)`). Code size is
zero → the call reverts with no reason string. Same root cause: **the address is
empty**.

## 3. Why the mock tests pass anyway

`forge test` never touches that address. Your tests deploy a `MockERC20` and a
`MockPool` at fresh addresses and wire them into the vault, so the tests prove
your vault is internally consistent with *your model* of Aave and USDC — not with
the real ones. Mocks routinely diverge on exactly the things that break
integrations:

- real USDC on Base is a **proxy** (FiatToken), **6 decimals**, blacklist-aware,
  and its `approve` / `transferFrom` semantics matter
- Aave V3 `supply()` requires a prior `approve` to the Pool, and checks reserve
  configuration: active / not paused / not frozen / **supply caps**
- you get back a rebasing **aToken** (scaled balances), not a 1:1 receipt
- real reserve state (liquidity index, rates) changes what the vault reads back

Green mock tests plus a reverting integration is the normal signature of "the
integration was never run against the real deployed contracts."

## 4. The setup where the same calls hit real Aave and real USDC: fork mode

Instead of an empty chain, run Anvil as a **fork of Base**. It serves a local
chain that lazily fetches any state it doesn't have from an upstream Base RPC. So
`0x8335...2913` has USDC's real code and real storage — real balances, real
Aave reserves, real pool state — while every write you make stays in local memory.

### Start it

```bash
# Terminal 1  (replaces `yarn chain`)
yarn fork --network base
```

Scaffold-ETH's foundry flavor reads the upstream RPC from `packages/foundry/.env`
(`ALCHEMY_API_KEY=...`, or set your own Base RPC URL). Under the hood it is:

```bash
anvil --fork-url <base-rpc> --chain-id 31337
```

Two details that matter:

- **Keep chain ID 31337.** If you set `--chain-id 8453`, the frontend and your
  wallet will think they're on Base and may route to Base's public RPC instead of
  your fork.
- **Pin a block for reproducibility** while debugging: `--fork-block-number
  <N>`. Pinned blocks also cache well, so restarts are fast and everyone on the
  team sees identical state.

Optionally add `--block-time 1` (or `cast rpc anvil_setIntervalMining 1`) — see §7.

### Deploy against it

```bash
# Terminal 2
yarn deploy --network localhost
```

It's still chain 31337, so `localhost` is correct.

**Check your deploy script.** Scaffold deploy scripts commonly branch on
`block.chainid == 31337` and deploy mocks. On a fork that's exactly wrong: 31337
now *is* Base. Change the script so the fork path passes the **real** Base
addresses into your vault constructor:

```solidity
address constant USDC          = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
address constant AAVE_PROVIDER = 0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D; // PoolAddressesProvider
```

Don't hardcode the Pool address — read it from the provider (`getPool()`) so you
pick up the real one; verify on the fork with:

```bash
cast call 0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D "getPool()(address)" \
  --rpc-url http://localhost:8545
```

Use a small env flag (e.g. `FORK=true`) or a config struct rather than the raw
chain-ID check, so `yarn chain` still gets mocks and `yarn fork` gets the real
protocol.

### Point the frontend at the fork, not at Base

In `packages/nextjs/scaffold.config.ts`:

```typescript
targetNetworks: [chains.foundry],   // 31337 — the local fork
```

Not `chains.base`. The fork *contains* Base state but is served at
`http://localhost:8545`; targeting `chains.base` would send your reads and
transactions to the real network. Switch to `chains.base` only for an actual
mainnet deployment.

For USDC/Aave — contracts you did not deploy — add them to
`packages/nextjs/contracts/externalContracts.ts` under **chain ID 31337** with
the Base addresses and ABIs, so `useScaffoldReadContract` / `useScaffoldWriteContract`
resolve them on the fork.

### Verify the fix with the original probe

```bash
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://localhost:8545 | head -c 20
# 0x60806040...  <- real code now

cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "symbol()(string)" \
  --rpc-url http://localhost:8545          # USDC
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "decimals()(uint8)" \
  --rpc-url http://localhost:8545          # 6
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "balanceOf(address)(uint256)" \
  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --rpc-url http://localhost:8545
```

The `balanceOf` probe now returns `0` — a real zero decoded from real return
data, not a decode failure.

## 5. What stays local (no real funds at risk)

- **All writes are local.** Anvil applies your transactions to its own in-memory
  state. Nothing is broadcast to Base. The upstream RPC only ever sees *read*
  requests for state you touch.
- **The keys are throwaway.** You sign with Anvil's public dev accounts, which
  hold nothing on real Base. Never put a funded private key in
  `packages/foundry/.env`.
- **The impersonation and state-override cheats below are Anvil RPC methods.**
  They don't exist on real networks; there is no path by which they affect
  mainnet.
- The one thing that leaves your machine is the RPC read traffic (which addresses
  and slots you look at) going to your Alchemy/RPC provider.
- Fork state is discarded on restart. Snapshot with `evm_snapshot` /
  `evm_revert` if you want to re-run a scenario.

## 6. Getting a test account six figures of USDC

Remember USDC is **6 decimals**: 250,000 USDC = `250000000000`.

### Preferred: impersonate a real holder and transfer

Find an address that actually holds USDC on Base (a bridge, an exchange hot
wallet, or Aave's own aUSDC aToken, which custodies the underlying), then:

```bash
RPC=http://localhost:8545
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
WHALE=<address-with-large-USDC-balance-on-base>
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266   # anvil account #0

# sanity check the whale really has the funds at your fork block
cast call $USDC "balanceOf(address)(uint256)" $WHALE --rpc-url $RPC

# make sure it can pay gas, then unlock it
cast rpc anvil_setBalance $WHALE 0xDE0B6B3A7640000 --rpc-url $RPC   # 1 ETH
cast rpc anvil_impersonateAccount $WHALE --rpc-url $RPC

cast send $USDC "transfer(address,uint256)" $ME 250000000000 \
  --from $WHALE --unlocked --rpc-url $RPC

cast rpc anvil_stopImpersonatingAccount $WHALE --rpc-url $RPC

cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC   # 250000000000
```

This is preferred because the tokens come from state that already exists —
total supply and every invariant stay consistent, so Aave behaves normally.

### Fallback: write the balance slot directly

If you'd rather not depend on a specific holder, overwrite storage. Base USDC is
a FiatToken proxy whose balance mapping lives at **slot 9** of the implementation
(the proxy shares the storage), so:

```bash
SLOT=$(cast index address $ME 9)
cast rpc anvil_setStorageAt $USDC $SLOT \
  $(cast to-uint256 250000000000) --rpc-url $RPC

cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC
```

Always re-read `balanceOf` afterwards — if it comes back `0`, the slot index is
wrong for this token version and you should use the whale route instead. (In
`forge` tests against a fork, `deal(USDC, ME, 250_000e6)` does the same thing.)

Also give the account gas if needed: `cast rpc anvil_setBalance $ME 0xDE0B6B3A7640000`.

### Then approve and supply, for real

```bash
POOL=$(cast call 0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D "getPool()(address)" --rpc-url $RPC)
cast send $USDC "approve(address,uint256)" $POOL 250000000000 \
  --rpc-url $RPC --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Now your vault's `supply` path exercises the actual Aave V3 Pool: real reserve
config, real supply caps, real aToken minting.

## 7. One fork gotcha that will bite this specific app

Anvil mines **only when a transaction arrives**. Between transactions the latest
block and `block.timestamp` are frozen, and the next transaction jumps time
forward all at once.

For an Aave vault this is visible and confusing: **accrued interest doesn't move**
while you watch the UI, because the aToken's scaled balance is multiplied by a
liquidity index that only updates as time advances. Your `vm.warp` unit tests pass
and the live app looks broken or stuck at exactly the deposit amount.

Turn on interval mining so time actually flows:

```bash
cast rpc anvil_setIntervalMining 1 --rpc-url http://localhost:8545
```

Or bake it in: add `--block-time 1` to the fork script if the project should
always run that way. `evm_mine` only restamps once and then freezes again, and
`evm_increaseTime` is for controlled single-step tests — neither is right for a
running app or demo.

## Summary

| | `yarn chain` | `yarn fork --network base` |
|---|---|---|
| Chain state | empty genesis + your deploys | full copy-on-read of Base mainnet |
| `0x8335...2913` | no code → decode error / silent revert | real USDC, 6 decimals |
| Aave V3 Pool | doesn't exist | real, with real reserve config |
| Good for | unit tests, mocks, isolated contract work | integration, demos, anything touching deployed protocols |
| Chain ID | 31337 | 31337 (keep it) |
| Funding | prefunded dev ETH | impersonate a holder / `anvil_setStorageAt` |

Keep both: mocks for fast unit tests, the fork for every call that has to meet
real Aave and real USDC.
