# Why local Aave/USDC calls revert, and how to fix it with a Base fork

## 1. What `yarn chain` actually gives you

In the foundry version of SE-2, `yarn chain` runs a bare **anvil** node:

- chain id `31337`, starting at block 0 with **empty state**
- 10 test accounts from the well-known `test test … junk` mnemonic, each holding 10,000 fake ETH
- nothing else. The only contracts on it are the ones `yarn deploy` put there: your vault, plus any mocks your deploy script creates.

It is a new, empty chain. It doesn't copy Base, and it has no link to Base. The address
`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is USDC on **Base mainnet**. On your
anvil node nothing lives at that address (`cast code 0x8335… --rpc-url localhost:8545` → `0x`). The same goes for the Aave V3 Pool,
PoolAddressesProvider, aTokens and oracles.

## 2. Why the probe fails

`cast call` sends an `eth_call` to an address that has no code. The EVM treats that as
calling an ordinary account: the call "succeeds" but returns **empty data** (`0x`).
You asked cast to decode a `uint256` from it, so cast fails with something like
`could not decode output; did you specify the wrong function return data?`.

Your vault hits the same wall. A Solidity call such as `IERC20(usdc).balanceOf(...)` or
`pool.supply(...)` first checks that the target has code, or fails to decode the empty
return value, so **it reverts**.

Why the forge tests pass: they deploy `MockUSDC` / `MockPool` at fresh addresses and
test against those. They prove your logic works against *your own copy* of the interfaces. They say
nothing about real Aave (real rates, supply caps, reserve settings, rounding, how the
aToken works, USDC's proxy/blacklist rules). `yarn deploy` also uses mocks or addresses that don't exist on the local chain.

## 3. The fix: run anvil as a fork of Base

A **fork** is a local anvil node that *reads* Base's state on demand through an RPC URL.
It keeps every write in its own memory. The real USDC and Aave contracts, storage and
liquidity all appear at their real addresses, so the exact same calls work.

### 3.1 Start the fork (replaces `yarn chain`)

```bash
# terminal 1
anvil \
  --fork-url https://base-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY \
  --chain-id 31337 \
  --fork-block-number <recent Base block>   # optional: pin it for repeatable runs + RPC caching
```

SE-2 foundry also has a shortcut, `yarn fork`, which runs `anvil --fork-url … --chain-id 31337`.
Point it at a Base RPC. `packages/foundry/foundry.toml` already has an `[rpc_endpoints]` section; add
`base = "https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}"` there. Any Base
archive-capable RPC works. The public `https://mainnet.base.org` works too, but it's rate-limited and slow.

Notes:
- **Keep `--chain-id 31337`.** SE-2's `scaffold.config.ts` (`targetNetworks: [chains.foundry]`),
  the burner wallet, and `deployedContracts.ts` all expect 31337. Local wallets also expect it. The contracts don't
  care. With the default id the frontend, deploy and debug pages work unchanged.
- The node still listens on `http://localhost:8545`, and the 10 default test accounts are still
  funded with ETH.

### 3.2 Deploy against real addresses (`yarn deploy`, unchanged)

`yarn deploy` still targets `localhost`, which is now the fork. Change the deploy script
so it **stops deploying mocks** and passes the real Base addresses to the vault:

| Contract | Base address |
|---|---|
| USDC (native, Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Aave V3 PoolAddressesProvider | `0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D` |
| Aave V3 Pool (proxy) | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` |

(Check these against the `@bgd-labs/aave-address-book` `AaveV3Base` library, or the Aave
docs. Better still, fetch the Pool at runtime with `IPoolAddressesProvider.getPool()`.) A simple
pattern: `if (block.chainid == 31337 && usdc.code.length == 0) deployMocks();`, otherwise use the real addresses.

To have the SE-2 frontend and Debug page read USDC and the Aave Pool directly, add them to
`packages/nextjs/contracts/externalContracts.ts` under chain id `31337`.

### 3.3 Your probe now works

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> --rpc-url http://localhost:8545
# → that address's real Base USDC balance as of the fork block
```

## 4. Giving a test account six figures of USDC

The fork gives you the real USDC contract, but your anvil test accounts hold 0 USDC. You can't mint
it (only Circle's minters can), so use anvil's cheat RPC methods. These only exist locally.

**Option A: impersonate a large holder (uses the token's real `transfer` logic)**

```bash
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266     # anvil account #0
WHALE=<an address holding lots of USDC on Base; pick one from Basescan's "Holders" tab.
       Avoid Aave's aUSDC contract, or you drain the reserve you're testing against>

cast rpc anvil_impersonateAccount $WHALE
cast rpc anvil_setBalance $WHALE 0x56BC75E2D63100000          # 100 ETH for gas
cast send $USDC "transfer(address,uint256)" $ME 250000000000 \
  --from $WHALE --unlocked --rpc-url http://localhost:8545     # 250,000 USDC (6 decimals)
cast rpc anvil_stopImpersonatingAccount $WHALE
```

**Option B: write the balance directly (no whale needed)**

```bash
# recent anvil builds
cast rpc anvil_dealERC20 $USDC $ME 0x3a35294400      # 250,000e6

# works on any anvil: USDC (FiatToken) keeps balances in the mapping at storage slot 9
SLOT=$(cast index address $ME 9)
cast rpc anvil_setStorageAt $USDC $SLOT $(cast to-uint256 250000000000)
```

(Option B changes one account's balance but doesn't update `totalSupply`. That's fine for testing.)

Check it:
`cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url localhost:8545` → `250000000000`.
Then approve the vault and deposit. The vault's `pool.supply()` goes into the real Aave V3
Pool code and mints real aBasUSDC accounting, all inside your fork.

Put these steps in a small `yarn fund` script (or a forge script run against localhost) so
every teammate gets the same setup after each fresh `anvil` restart.

## 5. What stays local, and why no real funds are at risk

- **Reads** go to Base: the fork fetches contract code and storage on demand from the RPC.
  That's the only traffic that leaves your machine. It is read-only.
- **Every write stays in anvil's memory**: your deployments, the USDC "transfer" from a whale you
  can't actually control, the storage edits, Aave deposits and borrows. None of it is broadcast to
  Base. Stop anvil and it's gone.
- Impersonating works only because anvil skips signature checks. You never hold the whale's
  key, and nothing happens on the real chain.
- The test accounts use a **publicly known** mnemonic. Never use them, or `--broadcast`
  with a Base `--rpc-url`, or `yarn deploy --network base`, unless you really mean to go live.
  Only `http://localhost:8545` is the sandbox.

## 6. Tests against the real contracts too

Keep the mock tests for fast unit coverage. Add fork tests that hit the same real contracts:

```bash
forge test --fork-url base --fork-block-number <block>   # uses [rpc_endpoints] base
```

or `vm.createSelectFork("base", <block>)` in `setUp()`. Inside tests, `deal(USDC, user, 250_000e6)`
funds accounts. Note that `deal` is a forge cheatcode: it works in `forge test`, but it does **not** change
a running anvil node. For that, use the `cast rpc` steps above.

## TL;DR

`yarn chain` = empty local chain, so no USDC or Aave code exists at those addresses. Calls return empty data, so decoding fails and the vault reverts.
Run `anvil --fork-url <Base RPC> --chain-id 31337` instead. Deploy with real addresses and
fund a test account through `anvil_impersonateAccount` + `transfer` (or `anvil_dealERC20` / `anvil_setStorageAt`).
You get real Aave and real USDC behavior, and every change stays in local memory.
