# Why every Aave/USDC call reverts locally, and how to fix it

## What `yarn chain` actually gives you

`yarn chain` starts **Anvil with a fresh, empty chain** (chain ID 31337, block 0). It holds only:

- the 10 default Anvil accounts, each with 10,000 test ETH
- whatever `yarn deploy` just put there (your vault, plus any mocks your deploy script creates)

It is **not** a copy of Base. There is nothing at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Base USDC), and nothing at the Aave V3 Pool address either. Those contracts only exist on the real Base chain.

## Why the probe fails

`cast call` sends `balanceOf` to an address with **no code**. The call returns empty data, and cast can't decode empty bytes as `(uint256)`, so it fails outright. Your vault's calls hit the same empty addresses. Calls to Pool/USDC then revert, either because Solidity checks that the target has code, or because empty return data can't be decoded.

The forge tests pass because they never touch those addresses. They deploy **mocks** and call those. The mocks prove your logic works against *your idea* of Aave/USDC. They don't prove it works against the real contracts (USDC proxy + blacklist/pause, 6 decimals, Aave supply caps, reserve config, aToken rebasing, etc.).

## The right local setup: fork Base

Use a **fork**: a local Anvil node that pulls real Base state (code, storage, balances) from an RPC on demand. The same calls, at the same addresses, now hit real Aave and real USDC bytecode and state.

```bash
# terminal 1 – instead of `yarn chain`
yarn fork --network base          # needs a Base RPC (alias `base` in foundry.toml / an Alchemy key in .env)
# optional, for a live demo: keep blocks & timestamps moving so Aave interest accrues visibly
cast rpc anvil_setIntervalMining 1 --rpc-url http://localhost:8545

# terminal 2
yarn deploy                       # deploys your vault onto the fork (still localhost:8545)

# terminal 3
yarn start
```

The probe now works:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> --rpc-url http://localhost:8545
```

Deploy script: stop deploying MockUSDC/MockPool on the fork. Pass the real Base addresses to the vault instead: USDC `0x833589fC…2913`, and the Aave V3 Pool, or better the `PoolAddressesProvider`, taken from Aave's address book.

Frontend: keep `scaffold.config.ts` at `targetNetworks: [chains.foundry]`. The fork **is** the local Anvil network (chain ID 31337, localhost:8545). Do **not** switch to `chains.base`, or the wallet will send transactions to the real Base. Switch to `chains.base` only when you really deploy.

## What stays local (no real funds at risk)

- Everything happens inside your local Anvil process. The upstream RPC is only **read** from, and nothing is ever broadcast to Base.
- Deploys, deposits, Aave supplies/withdrawals, and "whale" transfers change only your local copy. Restart the fork and it's all gone.
- Signers are the default Anvil test keys. No real private key is needed.
- The one real-world cost is RPC read usage on your provider key.

## Getting six figures of USDC into a test account

On a fork you can act as any address. Take USDC from an address that already holds lots of it, instead of deploying a fake token:

```bash
RPC=http://localhost:8545
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266     # Anvil account #0 (or your burner wallet)
WHALE=<address holding lots of Base USDC>          # e.g. Aave's aBasUSDC token contract (it holds the pool's USDC), or a large exchange wallet; confirm on basescan

cast call $USDC "balanceOf(address)(uint256)" $WHALE --rpc-url $RPC   # confirm it holds enough
cast rpc anvil_impersonateAccount $WHALE --rpc-url $RPC
cast rpc anvil_setBalance $WHALE 0x8AC7230489E80000 --rpc-url $RPC     # 10 ETH for gas, in case it's a contract with none
cast send $USDC "transfer(address,uint256)" $ME 250000000000 \
  --from $WHALE --unlocked --rpc-url $RPC                              # 250,000 USDC (6 decimals)
cast rpc anvil_stopImpersonatingAccount $WHALE --rpc-url $RPC

cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC       # → 250000000000
```

`anvil_impersonateAccount` lets you send transactions as the whale without its key. `--unlocked` tells cast to use that instead of signing. It's a real USDC `transfer` on your local copy, so balances, events, and allowances behave exactly as on Base.

If no suitable holder exists, write the balance directly with `anvil_setStorageAt` on USDC's balance mapping. In forge fork tests, `deal(USDC, me, 250_000e6)` does the same thing. Prefer the whale transfer, because it goes through the real token logic.

## Summary

| | `yarn chain` | `yarn fork --network base` |
|---|---|---|
| State | empty chain + your deploys | real Base state, fetched on demand |
| USDC / Aave at real addresses | nothing there, calls revert | real contracts |
| Chain ID / RPC for frontend | 31337 / localhost | 31337 / localhost (`chains.foundry`) |
| Good for | unit tests with mocks | integration against deployed protocols |
| Real funds at risk | none | none (nothing broadcast) |

Keep the mock tests as fast unit tests. Add fork tests (`forge test --fork-url $BASE_RPC`) and use the fork for app work that touches Aave/USDC.
