# One-click WETH → USDC → Aave V3, from the user's existing EOA

## TL;DR

The user's existing MetaMask EOA sends **one type-4 (EIP-7702) transaction to its own address.**
In that transaction:

1. The EOA signs an EIP-7702 authorization that sets its code to MetaMask's audited
   `EIP7702StatelessDeleGator` (`0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B`).
2. The EOA calls itself: `execute(BATCH_REVERT_MODE, [call1, call2, call3])` (ERC-7579). All three
   calls succeed, or the whole batch reverts:
   1. `WETH.approve(SwapRouter02, wethBalance)`: an exact allowance that the swap uses up entirely
   2. `SwapRouter02.multicall(deadline, [exactInputSingle(WETH→USDC, amountIn = wethBalance, amountOutMinimum, recipient = SupplyAllUSDC)])`
   3. `SupplyAllUSDC.supplyAll(owner, amountOutMinimum)`: this reads its own USDC balance, which is exactly
      what the swap returned. It then calls `AavePool.supply(USDC, thatAmount, onBehalfOf = owner, 0)`.

The user ends up holding aEthUSDC in the same address. Their WETH balance is 0, and no token
allowance is left over.

## Why this meets the constraints

| Constraint | How |
|---|---|
| Same address, same ENS, same history | EIP-7702 (live on mainnet since Pectra, May 2025) gives the **existing EOA** delegated code. The address, nonce, balances and ENS records stay the same. No funds move to a new address. |
| No new wallet / nothing the user would call "an account" | The user deploys nothing. The delegate code is MetaMask's own existing, audited DeleGator, which MetaMask uses for its "smart account" upgrade. The user's key stays the only authority: `execute` can only be called by the account itself or by the ERC-4337 EntryPoint with a UserOp signed by that same key. A simulated call from any other sender reverts. |
| Single confirmation | One signed transaction. The 7702 authorization is part of that same transaction. |
| Atomic, never half-done | All three calls run inside one call frame in batch mode `0x01…00` (execType = revert). If the swap misses its minimum or deadline, or the supply fails for any reason (cap, pause, frozen reserve), everything reverts. The WETH stays with the user and gets no allowance. |
| Supply amount unknown ahead of time | See next section. |

### Why there's a small helper contract

A batch of pre-encoded calls cannot say "supply whatever the previous call returned":
- Aave V3 `supply()` takes a fixed `amount`. Unlike `withdraw`/`repay`, it has no `type(uint256).max` meaning "use my balance".
- The Uniswap router cannot call Aave.
- `exactOutput` would fix the USDC amount, but then it would not swap *all* the WETH.

So one thing must read the balance while the transaction runs. That is
`contracts/SupplyAllUSDC.sol`: about 15 lines, **stateless, ownerless, no admin, no upgrade path**.
USDC and the Aave Pool are hard-coded as constants. It is not an account and holds nothing
between transactions. The swap sends USDC straight to it, and it supplies its entire balance
`onBehalfOf` the user in the same atomic batch. The user never grants it any allowance. The
worst a bug in it could affect is the USDC of the transaction it is in, and it enforces its
own `minAmount` check.

The developer deploys it once (`npx tsx entry.ts deploy-helper`, from any developer account)
and every user reuses it. `entry.ts` refuses to use a `SUPPLY_HELPER` whose on-chain runtime
bytecode differs from the reviewed build artifact (`contracts/SupplyAllUSDC.json`, built with
`node compile.cjs`, solc 0.8.24).

## How to run it

```sh
npm install
export RPC_URL=https://<your mainnet RPC>

# 1. Dry run with no key, for any address. It overrides that address's code with the
#    DeleGator's (and, if SUPPLY_HELPER is unset, puts the helper at a placeholder address),
#    then runs the exact batch against current mainnet state using eth_simulateV1.
npx tsx entry.ts simulate 0xUserAddress

# 2. One-time helper deploy, then pin it
PRIVATE_KEY=... npx tsx entry.ts deploy-helper
export SUPPLY_HELPER=0x...   # verify on Etherscan first

# 3. The real thing. It prints the plan and gas cost, then waits for you to type "yes"
PRIVATE_KEY=... SEND_RPC_URL=https://rpc.flashbots.net npx tsx entry.ts run

# Optional, later: remove the delegation (a separate transaction)
PRIVATE_KEY=... npx tsx entry.ts revoke
```

**Tested:** `simulate` was run against live mainnet as an EOA holding about 2.07 WETH.
Result: the batch succeeded, used about 305k gas (the estimate including the auth overhead is
about 392k), aUSDC went 0 → 5475.25, and WETH went to 0. The same batch sent from any address
other than the account itself reverted. `run` was **not** broadcast, because no funded key
was used.

### For a real MetaMask user, prefer the wallet path

The user's key lives in MetaMask. Exporting it into a script is itself a risk. MetaMask also
does not let dapps request arbitrary 7702 authorizations. The in-browser path is
`enterViaWallet()`. It sends the same three calls with EIP-5792 `wallet_sendCalls` and
`forceAtomic: true` (`atomicRequired`), and refuses if the wallet does not report `atomic`
support. MetaMask then upgrades the EOA to the **same** DeleGator and runs the calls in one
transaction, which the user confirms once in MetaMask. The CLI `run` mode is for a developer
testing with a key they control.

## What the developer must get right

**Keys**
- `PRIVATE_KEY` comes only from the environment. There is no default, fallback or example
  value in the repo, and `.gitignore` covers `.env*` before the first commit. A key that has
  ever been pasted into a chat, ticket or prompt is burned: rotate it and never fund it.
- The authorization is signed **only after** the human types `yes`. Gas is estimated beforehand
  with a state override, so no signed authorization exists if the user declines. A signed 7702
  authorization is a bearer instrument: anyone holding it can submit it while its nonce is valid.
  Never log or persist it.

**The authorization itself**
- `chainId: 1`, never `0`. Zero makes it valid on every chain, including chains where the
  delegate address may hold different code.
- `executor: 'self'`: because the same account sends the transaction, the authorization nonce
  must be `current + 1`. Get this wrong and the authorization is silently skipped. The batch
  then goes to a code-less EOA, which returns success but does nothing.
- Delegate only to the pinned DeleGator. The script checks its runtime code hash
  (`0x0b77e4…09ab`). If the account is already delegated to something else, the script
  refuses rather than overwriting it.

**The delegation persists**
- It is not scoped to this transaction. It stays until another authorization replaces or
  clears it. It also takes effect even if the inner batch reverts, because the authorization
  is processed before execution. Removing it takes a new signed authorization (`revoke` mode).
  Changing or retiring the delegate contract does nothing to it.
- Leaving it on the DeleGator is a reasonable default. That is where MetaMask's own smart-account
  upgrade puts it, and only the user's key can drive it. But the user should be told it is there.
  Wallets and dapps will see code at the address. MetaMask may show the account as "smart account".
- The EOA key keeps full control regardless of delegation. 7702 does not add signers. It also
  does not let the key be rotated.

**Money safety**
- `amountOutMinimum` = best QuoterV2 quote (0.05% and 0.3% pools) minus `SLIPPAGE_BPS`
  (default 50, capped at 300). The helper checks the same minimum again.
- A quote taken from an already-manipulated pool would make that minimum meaningless. So the
  quote must be within 2% of Chainlink ETH/USD, and the feed must be at most about 1h old.
- Deadline = latest block + 10 minutes, enforced by `SwapRouter02.multicall(deadline, …)`.
- Broadcast through a private/MEV-protected RPC (`SEND_RPC_URL`), and confirm it accepts
  type-4 transactions. The on-chain minimum still bounds the loss if the transaction is sandwiched.
- The confirmation gate prints the WETH amount, the quote and minimum, and every checksummed
  target (router, helper, Pool, delegate). It also shows the gas limit and max fee priced
  live, with a USD equivalent from Chainlink at run time. The script checks the account can
  pay the worst-case gas.
- Never send USDC to the helper outside this batch. Anyone could then supply it on their own
  behalf.
- Aave risk remains: supply caps, reserve freeze/pause, and USDC depeg. A cap or freeze makes
  the whole transaction revert, which is the intended failure mode. Run `simulate` right before `run`.

## Addresses used (Ethereum mainnet)

| What | Address |
|---|---|
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Uniswap V3 SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` |
| Uniswap V3 QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` |
| Aave V3 Pool (Ethereum core) | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` |
| aEthUSDC | `0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c` |
| Chainlink ETH/USD | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` |
| MetaMask EIP7702StatelessDeleGator | `0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B` |
| SupplyAllUSDC helper | deployed once by you → `SUPPLY_HELPER` |

Cross-check these against Uniswap's, Aave's (`aave-address-book`) and MetaMask's
(`delegation-framework`) published deployments before the first mainnet run.
