# Why local calls to Aave/USDC fail, and how to fix it with a Base fork

## 1. What `yarn chain` actually runs

In the foundry flavor, `yarn chain` starts **plain `anvil`**. That is a brand-new, empty chain that lives only in memory:

- chain id `31337`, block 0, nothing deployed
- 10 test accounts, each with 10,000 fake ETH
- after `yarn deploy`: **only your own contracts** (the vault and whatever the deploy script creates)

It is **not Base**. It has no Aave, no USDC, and no link to Base at all. The address
`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is USDC on Base mainnet, but on this chain
nothing is deployed there. It's just an empty account.

## 2. Why the probe fails

`cast call` to an address with no code gets back empty data (`0x`). Cast then can't decode that
into `(uint256)`, so it fails with an error like "contract 0x8335… does not have any code".
Your vault hits the same problem:

- A Solidity high-level call such as `IERC20(usdc).balanceOf(...)` or `IPool(pool).supply(...)` checks
  that the target has code first. It reverts when there is none.
- If the call did go through, decoding the empty return data would still revert.

So **every** integration call reverts.

**Why the forge tests pass:** they deploy `MockUSDC` / `MockPool` inside the test, so the code
is there. Those tests show your logic works against *your mocks*. They say nothing about
real Aave behavior (supply caps, aToken rounding, USDC's 6 decimals, blacklist/pause, and so on).

## 3. Fix: run anvil as a fork of Base mainnet

A fork is still a local anvil node on `localhost:8545`, but it takes its starting state from Base.
Any account or contract it hasn't touched yet is fetched lazily from a Base RPC. Real USDC and real Aave
V3 code and storage are therefore at their real addresses, and every write stays local.

### Terminal 1: start the forked chain (replaces `yarn chain`)

```bash
yarn fork --network base
# SE-2 foundry runs roughly: anvil --fork-url base --chain-id 31337 --config-out localhost.json
```

Or run it by hand, which gives you more control:

```bash
anvil \
  --fork-url https://base-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY \
  --fork-block-number <recent block> \
  --chain-id 31337
```

Notes:
- `base` resolves via `[rpc_endpoints]` in `packages/foundry/foundry.toml`. Use a real RPC
  (Alchemy, Infura, QuickNode) rather than the rate-limited public `https://mainnet.base.org`.
- **Keep `--chain-id 31337`.** The frontend's `scaffold.config.ts` (`targetNetworks: [chains.foundry]`),
  the burner wallet, the faucet and `yarn deploy` all expect 31337. If you let anvil use Base's
  id 8453, wallets may treat the local node as real Base.
- `--fork-block-number` pins the state, so runs repeat exactly and the RPC caches better.

### Terminal 2: deploy as usual

```bash
yarn deploy        # deploys to localhost:8545 (the fork) with the local anvil key
```

In the deploy script, point the vault at the **real Base addresses** (no mocks):

| Contract | Base address |
|---|---|
| USDC (native) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Aave V3 PoolAddressesProvider | `0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D` |
| Aave V3 Pool | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` (better: read `provider.getPool()`) |
| aBasUSDC | `0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB` |

The probe now works:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> --rpc-url http://localhost:8545
```

## 4. What stays local (no real funds at risk)

- Every transaction, including deploys, supplies, borrows and transfers, runs **only inside your anvil process**.
  Nothing is broadcast to Base.
- The upstream RPC is used **read-only**, to fetch state the fork hasn't seen yet.
- The signing keys are anvil's public test keys (and the SE-2 burner wallet). Their "ETH" and "USDC" exist
  only on the fork.
- Restarting anvil throws all of it away.
- Don't point `yarn deploy` / `--rpc-url` at a real Base RPC with a real key unless you actually mean to deploy.

## 5. Giving a test account six figures of USDC

USDC has no faucet on a fork, but anvil lets you act as any account. Pick an address that holds a lot of USDC
and transfer from it. For example, the aBasUSDC token contract holds all USDC supplied to Aave. Check the
holder's balance first with `balanceOf`, since any large holder works.

```bash
RPC=http://localhost:8545
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
WHALE=0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB   # aBasUSDC, holds Aave's USDC
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266      # anvil account #0 (or your burner address)

cast call $USDC "balanceOf(address)(uint256)" $WHALE --rpc-url $RPC   # check it has enough

cast rpc anvil_impersonateAccount $WHALE --rpc-url $RPC
cast rpc anvil_setBalance $WHALE 0x56BC75E2D63100000 --rpc-url $RPC   # 100 ETH for gas
cast send $USDC "transfer(address,uint256)" $ME 250000000000 \
  --from $WHALE --unlocked --rpc-url $RPC                             # 250,000 USDC (6 decimals)
cast rpc anvil_stopImpersonatingAccount $WHALE --rpc-url $RPC

cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC      # -> 250000000000
```

Put this in a script such as `yarn fund` and run it after each fork restart.

Other ways to do it:
- **Write the balance straight into storage** with `anvil_setStorageAt` on USDC's balance mapping slot. You can
  find the slot with `cast index` / `forge inspect`. There's no whale involved, but it's fragile if the token layout changes.
- **Don't** rely on `deal()` inside the `forge script` deploy script. Cheatcodes only change forge's simulation.
  They are not broadcast to anvil, so the balance never shows up in the app.

## 6. Also recommended: fork tests next to the mock tests

In forge tests you *can* use `deal`:

```solidity
function setUp() public {
    vm.createSelectFork(vm.rpcUrl("base"), FORK_BLOCK);
    vault = new Vault(USDC, AAVE_POOL);
    deal(USDC, alice, 100_000e6);
}
```

Run them with `forge test --match-path test/fork/*`. That way CI checks the real Aave/USDC behavior, not only the mocks.

## Summary

`yarn chain` gives you an empty local chain, so real Base addresses have no code there. Swap it for
`yarn fork --network base` (anvil forking Base, chain id kept at 31337), deploy with the real addresses,
and fund test accounts by impersonating a USDC holder. The integration calls then hit the real contracts
at the real addresses, and every change stays on your machine.
