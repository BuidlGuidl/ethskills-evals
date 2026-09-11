# Why your local chain has no USDC, and how to get a local chain that does

## 1. What `yarn chain` actually gives you

In the Foundry flavour of Scaffold-ETH 2, `yarn chain` runs **`anvil`** with no fork
flags. That is a *brand-new, empty* EVM:

- chain id `31337`, block number starts at `0`
- exactly one thing is pre-populated: the 10 well-known dev accounts
  (`0xf39Fd6e5...92266` and friends), each with 10000 ETH
- **zero deployed bytecode.** No USDC, no Aave `Pool`, no `PoolAddressesProvider`,
  no aTokens, no oracles, no Uniswap, nothing.

`yarn deploy` then adds *only your own* contracts (whatever `Deploy.s.sol` runs) on
top of that emptiness. The app starts fine because the frontend only needs your
contracts' ABIs and addresses from `deployedContracts.ts` — it never checks that the
external protocol addresses your contracts point at exist.

So the mental model to correct: **"local chain" ≠ "a local copy of Base."** By
default it is a blank chain that happens to speak the same protocol.

## 2. Why the `cast call` probe fails

```
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <addr> --rpc-url http://localhost:8545
```

`0x8335...2913` is USDC **on Base mainnet**. On your local anvil that address is an
empty account. The EVM has a specific behaviour here that explains the exact failure
mode:

- A `CALL` to an address with no code **succeeds** and returns **empty return data**.
  It does not revert.
- `cast` was told to decode the output as `uint256`, i.e. read 32 bytes. It got 0
  bytes, so it errors while decoding — something like
  `Error: buffer overrun while deserializing` / "failed to decode output". That's a
  *client-side decode* failure, not a chain-side revert. The distinction is why the
  error looks so unlike a normal revert message.

Confirm it in one command:

```bash
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://localhost:8545
# -> 0x        (no contract there)

cast chain-id     --rpc-url http://localhost:8545   # -> 31337, not 8453
cast block-number --rpc-url http://localhost:8545   # -> a tiny number
```

### Why your *contract* calls revert instead of silently no-op'ing

When Solidity makes a high-level external call through a typed interface
(`IPool(pool).supply(...)`, `IERC20(usdc).transfer(...)`), the compiler emits an
`extcodesize(target) > 0` check and reverts — with **no revert reason** — if the
target has no code. That's your "every integration call reverts", and the empty
reason string is the tell. If you had used a low-level `.call()` instead, it would
have returned `success = true` with empty data, which is worse.

Same story for Aave: the `Pool` / `PoolAddressesProvider` addresses in your config
are Base addresses and are empty accounts locally.

### Why the mock tests pass anyway

Your `forge test` suite deploys `MockERC20` and `MockAavePool` *inside the test EVM*,
so the code is genuinely there and the calls work. Mocks prove your contract's
internal logic and arithmetic. They cannot prove integration, because they don't
model any of the things that actually break vaults against real Base:

- **USDC is 6 decimals**, not 18. A mock defaulting to 18 hides every unit bug.
- **USDC is an upgradeable proxy** (`FiatTokenV2_2` behind a proxy) with a
  blocklist, pausability, and EIP-2612 `permit`. Its balance slot even packs the
  blocklist flag into the high bit (see §5).
- **Aave has state you don't control**: supply caps, borrow caps, frozen/paused
  reserves, isolation & e-mode, a live interest rate curve, and `aToken` balances
  that are *scaled* and rebase upward. Rounding at the aToken boundary routinely
  costs 1 wei and breaks naive `assertEq` accounting.
- Real `supply()` reverts on cap breach; your mock happily accepts anything.

Keep the mock tests — they're your fast unit layer. They just aren't integration
tests. Add a fork layer beside them.

## 3. The fix: run anvil as a fork of Base

A **fork** is a local anvil that lazily fetches state (`eth_getCode`,
`eth_getStorageAt`, accounts, blocks) from a real Base RPC on first touch, caches it
under `~/.foundry/cache/rpc`, and keeps every *write* in a local in-memory overlay.
The identical `cast call` then hits real USDC bytecode and real Aave.

### Get an RPC URL

`https://mainnet.base.org` works but rate-limits hard and will make forking painful.
Use a keyed endpoint (Alchemy / QuickNode / Infura / Ankr). A read-only RPC key
cannot move funds — see §6.

```bash
# packages/foundry/.env
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
```

### Start the forked chain

Check `packages/foundry/package.json` first — recent Scaffold-ETH 2 ships a
`yarn fork` script that does exactly this. If yours doesn't, add it:

```jsonc
// packages/foundry/package.json
"fork": "anvil --fork-url ${BASE_RPC_URL} --fork-block-number 22000000 --chain-id 31337 --config-out localhost.json"
```

Run `yarn fork` instead of `yarn chain`, then `yarn deploy` as usual.

Flags that matter:

| Flag | Why |
| --- | --- |
| `--fork-url` | the Base endpoint to pull state from |
| `--fork-block-number <n>` | **pin it.** Deterministic tests, warm cache, and whale balances that don't drift under you. Needs an archive-capable RPC if the block is old; a recent block works on any provider. |
| `--chain-id 31337` | keeps the SE-2 dev loop intact (see below) |
| `--config-out localhost.json` | what SE-2 tooling reads |
| `--auto-impersonate` | optional; lets you `--from <anyone>` without an explicit impersonate call |

### The chain-id decision (this bites people)

`anvil --fork-url` **inherits the forked chain's id (8453) by default.** Scaffold-ETH 2
special-cases `31337` for the burner wallet, the local faucet, and "don't link to a
block explorer". Two workable setups:

- **Recommended for day-to-day dev — override to `31337`.** Keep
  `targetNetworks: [chains.foundry]` in `packages/nextjs/scaffold.config.ts`.
  Everything in SE-2 behaves exactly as it does today, and MetaMask won't tell you
  you're on real Base.
- **Keep `8453`** if you need chain-id fidelity — specifically **EIP-2612 `permit`
  signatures**, which bind the chain id in the EIP-712 domain separator. Then set
  `targetNetworks: [chains.base]` and point it at localhost via `rpcOverrides` in
  `scaffold.config.ts`:

  ```ts
  const scaffoldConfig = {
    targetNetworks: [chains.base],
    rpcOverrides: {
      [chains.base.id]: "http://127.0.0.1:8545",
    },
    onlyLocalBurnerWallet: false,
    // ...
  } as const satisfies ScaffoldConfig;
  ```

  Trade-off: the frontend now *looks* like real Base, and it's easier to
  fat-finger a transaction at mainnet. Start with `31337`; switch only if you're
  actually signing permits.

### Point your deploy script at the real addresses

Your `Deploy.s.sol` currently deploys mocks for local. On a fork it must use the real
Base addresses. Key them off `block.chainid` rather than a `--network` flag so a fork
and real Base take the same branch:

```solidity
address usdc;
address pool;
if (block.chainid == 8453 || _isBaseFork()) {
    usdc = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    pool = AAVE_V3_BASE_POOL;
} else {
    usdc = address(new MockERC20("USDC", "USDC", 6));
    pool = address(new MockAavePool(usdc));
}
```

**Don't hardcode Aave addresses from memory — resolve them.** Either use
[`aave-address-book`](https://github.com/bgd-labs/aave-address-book):

```bash
forge install bgd-labs/aave-address-book
```
```solidity
import {AaveV3Base} from "aave-address-book/AaveV3Base.sol";

AaveV3Base.POOL                       // the Pool
AaveV3Base.ASSETS.USDC.UNDERLYING     // 0x8335...2913
AaveV3Base.ASSETS.USDC.A_TOKEN        // aBasUSDC
```

…or derive them on-chain at runtime, which is the most robust thing you can do:

```bash
# Aave V3 Base PoolAddressesProvider (verify before trusting):
PROVIDER=0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D
cast call $PROVIDER "getPool()(address)" --rpc-url http://localhost:8545
# -> the Pool (expected: 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5)

cast call $POOL "getReserveData(address)" $USDC --rpc-url http://localhost:8545
# aTokenAddress is one of the fields -> aBasUSDC
```

Verify these against the current Aave deployment registry before committing them;
addresses in a chat answer are the one thing you should never take on faith.

### Sanity check — the original probe now works

```bash
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://localhost:8545
# -> 0x60806040... (real proxy bytecode)

cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "symbol()(string)" --rpc-url http://localhost:8545
# -> "USDC"

cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "decimals()(uint8)" --rpc-url http://localhost:8545
# -> 6
```

## 4. Fork tests in Foundry (the CI half)

`foundry.toml`:

```toml
[rpc_endpoints]
base = "${BASE_RPC_URL}"

[etherscan]
base = { key = "${BASESCAN_API_KEY}", chain = 8453 }
```

```solidity
// packages/foundry/test/VaultFork.t.sol
contract VaultForkTest is Test {
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address user = makeAddr("user");

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("base"), 22_000_000); // pinned
        vault = new Vault(USDC, AaveV3Base.POOL);
        deal(USDC, user, 250_000e6);   // 250,000 USDC, 6 decimals
    }
}
```

Run only the fast layer by default and the fork layer explicitly:

```bash
forge test --no-match-path "test/*Fork*"   # unit, no network
forge test --match-path  "test/*Fork*"     # integration, needs BASE_RPC_URL
```

## 5. Getting a test account six figures of USDC

You cannot mint USDC — only Circle's masterMinter can. Three ways to cheat locally,
best first.

### (a) Impersonate a whale — most faithful

Anvil lets you send transactions *as any address*, no private key needed. The
transfer is a genuine USDC `transfer`, so it exercises the real blocklist checks,
events, and 6-decimal math.

```bash
RPC=http://localhost:8545
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266     # anvil account #0
WHALE=<an address holding >=200k USDC at your pinned block>

# whale needs gas
cast rpc anvil_setBalance $WHALE 0xDE0B6B3A7640000 --rpc-url $RPC   # 1 ETH
cast rpc anvil_impersonateAccount $WHALE --rpc-url $RPC

# 200,000 USDC == 200000 * 1e6 == 200000000000
cast send $USDC "transfer(address,uint256)" $ME 200000000000 \
  --from $WHALE --unlocked --rpc-url $RPC

cast rpc anvil_stopImpersonatingAccount $WHALE --rpc-url $RPC
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC
# -> 200000000000
```

Finding a whale: Basescan's USDC "Holders" tab, or a large protocol contract. Two
cautions — pick a holder that actually had the balance **at your pinned block**, and
**do not drain Aave's own aUSDC reserve**, since that's the liquidity your vault is
about to test against.

In Solidity/scripts the same thing is `vm.prank(WHALE)` (or `vm.startPrank`).

### (b) `deal` in Foundry tests — one line

```solidity
deal(USDC, user, 200_000e6);          // finds the balance slot, adjusts totalSupply
deal(USDC, user, 200_000e6, false);   // skip the totalSupply update if it misbehaves
```

`forge-std`'s `deal` locates the balance mapping slot automatically via `stdStorage`.
This is the right tool inside `forge test`; it does nothing for a running anvil.

### (c) Poke storage directly — for the running chain, no whale needed

```bash
SLOT=$(cast index address $ME 9)      # keccak256(abi.encode(holder, 9))
cast rpc anvil_setStorageAt $USDC $SLOT $(cast to-uint256 200000000000) --rpc-url $RPC
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC
```

Three caveats:

1. **Verify slot 9 empirically** — read a known holder's slot and compare to
   `balanceOf`. USDC is a proxy, so the layout is the *implementation's*
   (`FiatTokenV2_2`), and it can change on upgrade:
   ```bash
   cast storage $USDC $(cast index address $WHALE 9) --rpc-url $RPC
   ```
2. **`FiatTokenV2_2` packs the blocklist flag into bit 255 of that same slot**
   (the field is `balanceAndBlacklistStates`). Writing a value ≥ 2^255 would mark
   your account blocked and every transfer would revert. Any realistic balance is
   far below that, so just never write a huge sentinel like `type(uint256).max`.
3. `totalSupply` won't match. Harmless for Aave, but don't assert on it.

### Snapshot the funded chain so you only do this once

```bash
anvil --fork-url $BASE_RPC_URL --fork-block-number 22000000 --chain-id 31337 \
      --dump-state .anvil-state.json     # written on Ctrl-C
anvil --load-state .anvil-state.json     # next time, already funded + deployed
```

Within a session, `evm_snapshot` / `evm_revert` (or `vm.snapshot()` in tests) resets
between scenarios without refetching.

### ETH for gas

Not a problem: on a fork, anvil still funds its 10 dev accounts with 10000 ETH each.
For any other address, `cast rpc anvil_setBalance <addr> <hex wei>`.

## 6. What stays local — why no real funds are at risk

- **The fork is read-only against Base.** Anvil issues only `eth_getCode`,
  `eth_getStorageAt`, `eth_getBalance`, `eth_getBlockByNumber` etc. to your RPC
  provider. It never calls `eth_sendRawTransaction` upstream.
- **Every write lands in anvil's local overlay**, in memory (plus the disk cache of
  *fetched* state). Your "200,000 USDC" exists only in your process. Real Base has
  no idea any of this happened.
- **You are not spending anyone's money.** Impersonation is an anvil RPC method with
  no cryptographic meaning — you never possess the whale's key, and the same request
  against real Base would be rejected outright.
- **The keys in play are the published anvil keys** (`0xac0974be...f2ff80`). They are
  in every tutorial on the internet. Use them locally forever; **never send real
  funds to those addresses on Base**.
- **A read-only RPC URL can't move funds.** Leaking your Alchemy key is a quota/abuse
  problem, not a custody problem. Keep it in `packages/foundry/.env`, which SE-2
  already gitignores.
- **Pinning `--fork-block-number` means you're reading historical state**, so upstream
  changes can't perturb a test run mid-flight.

The one genuine risk is operator error, not the fork: it stays easy to run
`yarn deploy --network base` or flip your wallet to real Base and broadcast for real.
Two guardrails worth adopting now:

- Keep `targetNetworks: [chains.foundry]` (chain id `31337`) so the UI never
  ambiguously looks like mainnet.
- Never put a private key with real funds in `packages/foundry/.env`. SE-2's
  `yarn account:generate` creates an encrypted keystore precisely so the deployer key
  isn't sitting in plaintext.

## 7. The setup, end to end

```bash
# 0. one-time
echo 'BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY' >> packages/foundry/.env
forge install bgd-labs/aave-address-book
# add the "fork" script to packages/foundry/package.json (§3)
# add [rpc_endpoints] base to foundry.toml (§4)
# make Deploy.s.sol branch on block.chainid: real addresses vs mocks (§3)

# terminal 1 — forked Base, chain id 31337
yarn fork

# terminal 2
yarn deploy
cast rpc anvil_setBalance $WHALE 0xDE0B6B3A7640000 --rpc-url http://localhost:8545
cast rpc anvil_impersonateAccount $WHALE --rpc-url http://localhost:8545
cast send $USDC "transfer(address,uint256)" $ME 200000000000 --from $WHALE --unlocked \
  --rpc-url http://localhost:8545

# terminal 3
yarn start
```

Now the exact probe from your bug report returns a real balance, `Debug Contracts`
talks to real USDC and real Aave, and your vault's `supply` / `withdraw` hit the live
interest-rate curve and live supply caps — with nothing at stake but a JSON file on
your laptop.

### Things the mocks were hiding that you should expect to fail first

Budget for these; they're the reason the fork is worth setting up:

- **6 decimals everywhere.** `200_000e6`, not `200_000e18`.
- **aToken rounding.** Withdrawing exactly what you supplied can come up 1 wei short.
  Use `withdraw(asset, type(uint256).max, to)` to exit fully, and
  `assertApproxEqAbs` instead of `assertEq` on aToken accounting.
- **Interest accrues with time.** `vm.warp` / `vm.roll` between supply and withdraw
  and your balance grows — assert on that rather than being surprised by it.
- **Supply caps and reserve status.** Check `getReserveData` / the reserve
  configuration before assuming a 6-figure `supply()` will be accepted.
- **Use `SafeERC20`.** USDC on Base returns a proper `bool` (it's not USDT), but
  `forceApprove` / `safeTransfer` costs you nothing and removes the whole class.
