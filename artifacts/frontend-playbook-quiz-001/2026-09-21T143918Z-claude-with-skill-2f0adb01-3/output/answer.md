# Why every integration call reverts on `yarn chain`, and how to fix it

## What `yarn chain` actually runs

`yarn chain` starts **Anvil with a brand-new, empty chain** (chain ID 31337). It holds only:

- the 10 default Anvil test accounts, each with 10,000 fake ETH
- whatever `yarn deploy` put there (your vault and any mocks)

It is **not** Base. Nothing already deployed on Base is there: no USDC, no Aave Pool, no Uniswap, and no balances. `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is the USDC address on Base mainnet. On the empty chain that address is just an account with **no code**.

## Why the probe fails

`cast call ... balanceOf(address)(uint256)` sends a call to an address with no code. The EVM treats that as a successful call that returns **empty data** (0 bytes). `cast` then tries to decode a `uint256` from those 0 bytes, fails, and errors out. So "fails outright" really means "there is no contract here". Check it:

```bash
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://localhost:8545
# 0x   <- no code
```

Your vault calls fail for the same reason. A Solidity call through an interface first checks that the target has code (`extcodesize`) and reverts if it doesn't. So `IPool(aavePool).supply(...)` and `IERC20(usdc).transferFrom(...)` revert on every call.

## Why the forge tests pass anyway

The tests deploy **mocks** (MockERC20, MockPool) inside the test itself. They show that your vault works against *your idea* of Aave and USDC. They never touch real Aave or real USDC, and they never touch the local chain at all. Real-world details your mocks probably skip:

- USDC has 6 decimals and a blacklist.
- USDC is a proxy contract.
- Aave has supply caps, a paused/frozen state per asset, and aToken balances that grow with interest (the `liquidityIndex`).

None of this gets exercised.

## The right local setup: fork Base

```bash
# Terminal 1: local Anvil that copies Base mainnet state on demand
yarn fork --network base

# Terminal 2
yarn deploy          # deploys your vault to the fork

# Terminal 3
yarn start

# Once, after the fork starts: mine a block every second so block.timestamp moves
cast rpc anvil_setIntervalMining 1 --rpc-url http://localhost:8545
```

(To make block mining permanent, add `--block-time 1` to the `fork` script in `packages/foundry/package.json`.)

Use a paid RPC endpoint for the fork, not a public one. Put your Alchemy key in `packages/foundry/.env` (`ALCHEMY_API_KEY=...`). Public endpoints rate-limit hard, and a fork makes many reads.

In the vault's deploy script and constructor args, point at the **real Base addresses**, not mocks:

| Contract | Base address |
|---|---|
| USDC (native, Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Aave V3 Pool | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` |

(Confirm the Pool address from the Aave address book, or get it from `PoolAddressesProvider.getPool()`, before relying on it.)

Your original probe now works unchanged:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> --rpc-url http://localhost:8545
# returns that address's real Base USDC balance as of the fork block
```

### Frontend gotcha: the chain ID stays 31337

The fork still runs on Anvil with **chain ID 31337**, even though its state is Base. In `packages/nextjs/scaffold.config.ts`:

```ts
targetNetworks: [chains.foundry], // NOT chains.base while developing on the fork
```

Switch to `chains.base` only when you deploy to real Base.

## What is real and what stays local

- **Read from real Base:** the code and storage of every contract (USDC, Aave Pool, aTokens, oracles) and all balances, as of the fork block. Anvil fetches these lazily from your RPC.
- **Stays 100% local:** every transaction you send, including deploys, supplies, withdraws, and impersonated transfers. Anvil runs them in its own memory and **never broadcasts** to Base. Nothing you do changes real Base, and the "money" you move is only a local copy. Restart the fork and it is all gone.
- **No real keys or funds:** you sign with Anvil's default test keys (their private keys are public, so never use them on a real network). Cheat methods such as impersonation work only because it's your local node.
- The fork stays frozen at the fork block. It does not pick up new mainnet activity. Oracle prices stay put unless you change them.

## Giving a test account six figures of USDC

USDC can't be minted freely: only Circle's minters can mint. On a fork, though, you can **impersonate** any address, meaning you send transactions as that address without its key. So you take USDC from an address that already holds a lot of it.

```bash
RPC=http://localhost:8545
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266     # Anvil account #0 (or your burner/MetaMask address)
WHALE=<an address holding lots of USDC on Base>    # pick one from Basescan's USDC "Holders" tab

# 1. Check that the whale really has enough on the fork
cast call $USDC "balanceOf(address)(uint256)" $WHALE --rpc-url $RPC

# 2. Give the whale ETH for gas, then act as the whale
cast rpc anvil_setBalance $WHALE 0x56BC75E2D63100000 --rpc-url $RPC   # 100 ETH
cast rpc anvil_impersonateAccount $WHALE --rpc-url $RPC

# 3. Send 250,000 USDC (6 decimals -> 250000 * 1e6)
cast send $USDC "transfer(address,uint256)" $ME 250000000000 \
  --from $WHALE --unlocked --rpc-url $RPC

cast rpc anvil_stopImpersonatingAccount $WHALE --rpc-url $RPC

# 4. Verify
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC
```

This is a normal `transfer` run by real USDC code, so balances, events, and the total supply all stay consistent. Put these commands in a small shell script (or a `yarn fund` script) that you run after every `yarn fork`, because restarting the fork wipes the balances.

Alternatives:

- **In forge fork tests:** `deal(USDC, alice, 250_000e6)` from forge-std writes the balance slot directly. Run the tests with `forge test --fork-url $BASE_RPC` so they hit real Aave instead of mocks. Keep the mock tests for fast unit checks, and add fork tests for the integration.
- **Direct storage write** with `anvil_setStorageAt` on the USDC balance slot also works, but it is fragile (USDC packs balance and blacklist state into one storage slot). Impersonating a whale is simpler.

Then approve the vault and deposit through the UI (or `cast send` from `$ME`). The vault's `supply` now goes to the real Aave V3 Pool code on the fork, you get real aUSDC, and interest grows as blocks move forward. That is why interval mining matters.
