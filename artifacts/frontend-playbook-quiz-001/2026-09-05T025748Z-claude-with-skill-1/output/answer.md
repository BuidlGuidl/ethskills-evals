# Why the probe fails, and the local setup that actually hits real Aave + USDC

## 1. What `yarn chain` actually gives you

`yarn chain` starts **Anvil with an empty state**. It is a brand-new chain whose
genesis contains nothing but 10 pre-funded dev accounts:

```
yarn chain                      yarn fork --network base
└─ Empty local chain            └─ Fork of real Base mainnet
└─ No protocols                 └─ Uniswap, Aave, etc. available
└─ No tokens                    └─ Real USDC, WETH exist
└─ Isolated contracts, unit     └─ Integration against REAL
   tests, mocks                    deployed state
```

After `yarn deploy`, the only code on that chain is **your own contracts**. There is
no Aave V3 `Pool`, no `PoolAddressesProvider`, no aToken, and no USDC — those live on
Base mainnet and were never copied anywhere. Base's USDC address
`0x8335…2913` on your local chain is just an address with `extcodesize == 0`, the
same as any random address you make up.

## 2. Why the `cast call` probe fails outright

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> \
  --rpc-url http://localhost:8545
```

The EVM does not error when you call an account with no code — it succeeds and
returns **zero bytes**. So the node hands `cast` back `0x`. You told `cast` the return
type is `(uint256)`, and it cannot ABI-decode 32 bytes of `uint256` out of 0 bytes, so
it aborts. The failure is a **decode failure on empty returndata**, which is the
signature of "there is no contract at this address" — not a revert, and not an RPC problem.

Confirm it in one line:

```bash
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://localhost:8545
# prints 0x  →  nothing deployed there
```

## 3. Why your integration calls revert (but the tests pass)

Same root cause, different surface. When Solidity makes a high-level call that has a
return value — `IERC20(USDC).balanceOf(...)`, `IPool(POOL).supply(...)` — the compiler
inserts an `extcodesize` check on the target *before* the call. Target has no code →
**the check fails and your function reverts**, before any external call happens. Every
Aave/USDC path in the vault reverts for this reason, uniformly, which matches
"every integration call reverts".

Your forge tests pass because they never touch those addresses. The mocks are deployed
fresh inside the test EVM and injected at *their own* addresses, so the tests exercise
your vault's accounting against a mock's behaviour — they prove your arithmetic, and they
prove nothing about Aave's real `supply`/`withdraw` semantics, its reverts, its aToken
rebasing, or USDC's actual transfer behaviour. Mock-passing + integration-reverting is
the expected outcome of running deployed-state-dependent code on an empty chain.

## 4. The fix: run a fork, not an empty chain

The rule: `yarn chain` when the code under test is self-contained; **`yarn fork` the
moment behaviour depends on deployed protocols, tokens or balances.** A vault
integrating Aave V3 and USDC is squarely the second case.

### Terminal 1 — fork of real Base

```bash
yarn fork --network base
```

Set a real RPC first (`packages/foundry/.env`), don't run a demo off `mainnet.base.org`:

```
ALCHEMY_API_KEY=<your key>
```

Anvil pulls Base mainnet state on demand over that RPC. Now `0x8335…2913` **has code** —
it is real USDC, with real total supply and real holders — and the Aave V3 Pool is there
with its real reserve configuration.

### Terminal 2 — deploy your contracts onto the fork

```bash
yarn deploy
```

Unchanged. Your vault lands on a chain where its dependencies exist, so the constructor
wiring to the Aave addresses resolves. (`deployedContracts.ts` is regenerated here — never
hand-edit it.)

### Terminal 3 — frontend

```bash
yarn start
```

### The chain-ID gotcha that bites everyone

The fork is still **Anvil on chain ID 31337**, even though it mirrors Base. The frontend
target network must be `chains.foundry`, *not* `chains.base`:

```typescript
// packages/nextjs/scaffold.config.ts — during development
targetNetworks: [chains.foundry],   // ✅ NOT chains.base
```

Point it at `chains.base` only when you deploy to the real network. Getting this wrong
makes the app read the live chain while your contracts live on the fork, which looks like
"my contract isn't deployed".

### Re-run the probe

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --rpc-url http://localhost:8545
# returns 0 — a real decoded zero, from real USDC code
```

Zero, decoded successfully, is the correct result: the token exists, that account just
holds none of it yet. Section 6 fixes that.

## 5. What stays local — why no real funds are at risk

A fork is a **local copy of state, not a connection to the chain**. Concretely:

- Anvil *reads* Base state through your RPC and caches it. Every write — your deploys,
  your transactions, impersonated transfers, storage overrides — is applied only to
  Anvil's local overlay.
- **Nothing is ever broadcast.** No transaction you send to `localhost:8545` reaches Base.
- You control the accounts because Anvil lets you, not because you hold keys. Impersonation
  works only inside the fork; the same command against real Base does nothing.
- Balances you conjure are fake outside the fork. Kill Anvil and all of it is gone; restart
  and you are back to a clean mirror of mainnet.

So: real addresses, real bytecode, real protocol logic, entirely fake money. Use a
throwaway/dev key anyway, and keep MetaMask on the local network so you can't misfire a
mainnet transaction by hand.

## 6. Getting a test account six figures of USDC

**Do not deploy a mock USDC.** Your vault has Base's USDC address baked in, and a mock at a
different address just reintroduces the problem you're debugging. On a fork you take tokens
from an account that already has them.

Pick a holder and verify it *on the fork* before relying on it — holder rankings drift, so
check, don't assume:

```bash
WHALE=<a current large USDC holder on Base>
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" $WHALE --rpc-url http://localhost:8545
```

A reliable, self-verifying candidate: the **Aave V3 aBasUSDC aToken contract** holds the
pool's entire USDC reserve by construction, so it is a whale as long as the market is live.
Read it straight off the protocol rather than pasting an address from memory:

```bash
POOL=<Aave V3 Pool on Base>
cast call $POOL "getReserveData(address)" \
  0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://localhost:8545
# aTokenAddress is one of the returned fields → use it as $WHALE
```

Then impersonate and transfer 250,000 USDC (USDC has **6 decimals**, so 250000e6):

```bash
DEV=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266   # Anvil account #0

# gas for the impersonated sender (a contract holder has no ETH earmarked for this)
cast rpc anvil_setBalance $WHALE 0xDE0B6B3A7640000 --rpc-url http://localhost:8545

cast rpc anvil_impersonateAccount $WHALE --rpc-url http://localhost:8545

cast send 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "transfer(address,uint256)" $DEV 250000000000 \
  --from $WHALE --unlocked --rpc-url http://localhost:8545

cast rpc anvil_stopImpersonatingAccount $WHALE --rpc-url http://localhost:8545

# verify
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" $DEV --rpc-url http://localhost:8545
# 250000000000  → 250,000 USDC
```

If no suitable holder exists (or you'd rather not move protocol liquidity),
`anvil_setStorageAt` writes the balance slot directly and `anvil_setBalance` handles ETH —
equivalent overrides, same "local only" guarantee.

Give the dev account ETH for gas too if it needs it, then approve the vault and run the
real deposit path:

```bash
cast send 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "approve(address,uint256)" $VAULT 250000000000 \
  --private-key $DEV_KEY --rpc-url http://localhost:8545
```

## 7. One more thing: the clock

Anvil mines **only when a transaction arrives**. Between transactions `block.timestamp` and
the block number are frozen, then jump in one step on the next tx. For an Aave vault that
matters directly — the liquidity index and therefore accrued interest are a function of
elapsed time, so a paused clock means aToken balances and any yield/APY display sit
motionless while you demo, even though `vm.warp` unit tests pass.

```bash
# in a fourth terminal
cast rpc anvil_setIntervalMining 1 --rpc-url http://localhost:8545
```

Make it permanent by adding `--block-time 1` to the fork script in
`packages/foundry/package.json`.

`evm_mine` (restamp once) and `evm_increaseTime` (jump the clock on demand) are the right
tools for controlled single-step tests — e.g. asserting interest after exactly 30 days —
but neither substitutes for interval mining under a running demo.

## 8. Keep the mocks, add fork tests

The mock suite is still worth having: it is fast and it pins your vault's own accounting.
Add a fork-mode layer beside it so Aave's real semantics get exercised in CI too:

```bash
forge test --fork-url $BASE_RPC_URL
```

with `vm.createSelectFork` in the tests that need real state, and `deal`/`vm.prank` for
funding inside Foundry.

---

### TL;DR

`yarn chain` is an empty chain — Base's USDC address has no code there, so `cast call`
gets back empty returndata and can't decode a `uint256`, and Solidity's `extcodesize`
check reverts every Aave/USDC call before it's made. Swap terminal 1 to
`yarn fork --network base`, keep `targetNetworks: [chains.foundry]` (chain ID is still
31337), `yarn deploy` onto the fork, then impersonate a verified USDC holder and
`transfer` 250000000000 (250k USDC, 6 decimals) to Anvil account #0. Everything is a
local overlay on a cached copy of mainnet — nothing is broadcast, no real funds are at
risk. Turn on `anvil_setIntervalMining 1` so interest actually accrues while you look at it.

### Addresses — verify, don't paste

The playbook keeps verified addresses in its `addresses/` reference, which isn't present in
this workspace, so the Aave Pool and aToken above are left as variables on purpose. Resolve
them on the fork before use — `cast code <addr>` must return non-empty, and derive the
aToken from `getReserveData` rather than hardcoding it. USDC on Base
(`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) is the address from your own probe and is
correct.
