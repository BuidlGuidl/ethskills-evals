# Why every Aave/USDC call fails locally — and the fork setup that fixes it

## 1. What `yarn chain` actually gives you

`yarn chain` starts **Anvil with a brand-new, empty chain** (chain ID 31337, block 0). It contains only:

- the ~10 test accounts Anvil pre-funds with 10,000 fake ETH each;
- whatever contracts `yarn deploy` just put there (your vault, plus any mocks your deploy script deploys).

That's it. It is **not** a copy of Base. There is no Aave V3 Pool, no USDC, no oracles, no Base history. The address `0x8335…2913` is real USDC **on Base**. On your local chain it's just an empty address with no code.

## 2. Why the probe fails

`cast call 0x8335…2913 "balanceOf(address)(uint256)" …` sends a call to an address that has **no code**. The EVM doesn't treat that as an error. It returns success with **empty return data**. `cast` then tries to decode a `uint256` from 0 bytes and fails ("could not decode output" / "execution reverted" depending on version).

Your vault hits the same wall. Solidity's high-level calls (`IERC20(usdc).transferFrom(...)`, `IPool(pool).supply(...)`) check that the target has code, or fail decoding the empty return data, so **every integration call reverts**.

## 3. Why the forge tests pass anyway

The mock-based tests deploy their own `MockUSDC` / `MockPool` inside the test, so the code exists **in the test's own in-memory EVM**. They prove your vault logic works against *your idea* of Aave and USDC. They say nothing about whether the real addresses exist on the chain you're running, and on `yarn chain` they don't. (They also can't catch real-protocol details: USDC's 6 decimals, Aave supply caps, reserve config, aToken rounding, and so on.)

Rule of thumb:
- `yarn chain` → isolated contracts, mocks, unit tests.
- `yarn fork` → anything that depends on deployed protocols, tokens, or balances.

## 4. The setup where the same calls hit real Aave and real USDC

### 4.1 Start a fork of Base instead of an empty chain

```bash
# terminal 1 — instead of `yarn chain`
yarn fork --network base
```

This runs Anvil with `--fork-url <Base RPC>` and still uses **chain ID 31337**. The Base RPC comes from `rpc_endpoints` in `packages/foundry/foundry.toml`, which uses your Alchemy key from `packages/foundry/.env`. Set your own key; the shared default gets rate-limited. Anvil lazily pulls any state you touch (code, storage, balances) from real Base at the fork block. So `0x8335…2913` now **is** real USDC bytecode with real balances, and the Aave V3 Pool on Base (`0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`, via PoolAddressesProvider) is really there.

Optional but useful:
- Pin the block for reproducible runs: add `--fork-block-number <n>` to the fork script.
- Make time move continuously, so Aave interest accrues and deadlines work in the UI. Anvil otherwise mines only when a tx arrives, so `block.timestamp` stays frozen between txs:
  ```bash
  cast rpc anvil_setIntervalMining 1
  ```
  (or add `--block-time 1` to the fork script permanently).

### 4.2 Deploy your vault onto the fork

```bash
# terminal 2
yarn deploy
```

Same command as before. It deploys to `localhost:8545`, which is now the fork. In the deploy script, **pass the real Base addresses** (USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, the Aave Pool / PoolAddressesProvider) to the vault constructor. **Don't deploy mocks** on this path. If you want both, branch on a flag or env var.

### 4.3 Point the frontend at the fork, not at Base

In `packages/nextjs/scaffold.config.ts`:

```ts
targetNetworks: [chains.foundry], // chain ID 31337 = your local fork
```

Do **not** switch this to `chains.base`. That would send the UI and wallet to the real network. Use `chains.base` only for a real deployment.

### 4.4 Give a test account six figures of real USDC

Use the fork's cheat powers to move **existing** USDC from a real holder. Don't mint a mock token.

```bash
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
WHALE=<a large USDC holder on Base — pick one from the Basescan "Holders" tab>
ME=<your burner / Anvil test account, e.g. 0xf39F…2266>
RPC=http://localhost:8545

# give the whale gas money (fake ETH, local only)
cast rpc anvil_setBalance $WHALE 0x56BC75E2D63100000 --rpc-url $RPC   # 100 ETH

# pretend to be the whale without its private key
cast rpc anvil_impersonateAccount $WHALE --rpc-url $RPC

# send 100,000 USDC (6 decimals → 100000 * 1e6)
cast send $USDC "transfer(address,uint256)" $ME 100000000000 \
  --from $WHALE --unlocked --rpc-url $RPC

cast rpc anvil_stopImpersonatingAccount $WHALE --rpc-url $RPC

# the original probe now works
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC
# → 100000000000 [1e11]
```

Before you pick a whale, check its balance with the same `balanceOf` call. Also check it isn't blacklisted: USDC has a blacklist, and a blacklisted sender can't transfer. If no suitable holder exists, `anvil_setStorageAt` can write the balance slot directly. That's equivalent, but more brittle, because it depends on USDC's proxy storage layout. Put these commands in a small script (for example `yarn fund`) so every teammate funds the same way after each fork restart.

## 5. What stays local — no real funds at risk

- **Everything runs inside your local Anvil process.** Transactions to `localhost:8545` are never broadcast to Base. Anvil only **reads** from the Base RPC.
- The "real USDC" you receive is a **local copy** of Base state. The whale's real balance on Base is untouched, and your 100k USDC doesn't exist anywhere but your machine.
- Impersonation works only because Anvil skips signature checks. No private keys are involved, and it's impossible on real Base.
- Deposits into Aave, interest, and liquidations all happen against a local copy of the real Aave contracts, with real code and parameters.
- Restarting `yarn fork` discards everything: vault deployment, balances, positions. Re-run `yarn deploy` and the funding script afterward.
- Use Anvil test accounts or a burner wallet. Don't connect a wallet holding real funds and switch it to Base by mistake. The app should only offer chain 31337.

## TL;DR

| | `yarn chain` | `yarn fork --network base` |
|---|---|---|
| Starting state | empty chain | copy of Base at fork block |
| USDC / Aave at real addresses | no code → calls fail | real bytecode + real state |
| Chain ID / frontend target | 31337 / `chains.foundry` | 31337 / `chains.foundry` |
| Getting USDC | only via mocks | impersonate a whale, `transfer` |
| Real funds at risk | none | none (never broadcast) |
