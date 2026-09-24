# One-click WETH → USDC → Aave V3 entry, from an existing EOA

## TL;DR

**EIP-7702 + one self-call.** The user's existing EOA (same address, same key, same ENS and
history) signs an EIP-7702 authorization that sets its code to **MetaMask's audited
`EIP7702StatelessDeleGator`**. A single type-4 transaction from the EOA *to itself* then calls
the DeleGator's ERC-7579 batch `execute`, which runs:

| # | target | call |
|---|--------|------|
| 1 | WETH `0xC02a…6Cc2` | `approve(SwapRouter02, amountIn)` |
| 2 | Uniswap SwapRouter02 `0x68b3…Fc45` | `multicall(deadline, [exactInputSingle({WETH, USDC, fee: 500, recipient: AaveSupplyAll, amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0})])` |
| 3 | `AaveSupplyAll` (helper) | `supplyAll(USDC, minOut)` → `Pool.supply(USDC, <its whole balance>, onBehalfOf = msg.sender = user, 0)` |

Batch mode `0x01…` with exec type `0x00` means "revert on any failure", so the three calls
succeed together or the whole transaction reverts. The aUSDC lands on the user's address.

## Addresses (Ethereum mainnet, verified on-chain 2026-09-19)

| Contract | Address |
|---|---|
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Uniswap V3 SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` |
| Uniswap V3 QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` |
| Uniswap V3 WETH/USDC 0.05% pool | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` |
| Aave V3 Pool | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` |
| Aave V3 aEthUSDC | `0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c` |
| Chainlink ETH/USD | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` |
| MetaMask EIP7702StatelessDeleGator v1.3.0 | `0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B` |
| AaveSupplyAll (helper) | deploy once with `entry.ts deploy-helper`, or reuse a verified deployment |

## Why this meets the constraints

- **Same address, no new wallet.** EIP-7702 (Pectra, live since May 2025) lets an EOA set a
  *delegation designator* (`0xef0100 ‖ delegate`) as its code. The address, private key, ENS
  name, balances, nonce and history stay the same. Nothing moves to a new address, and no
  account contract is deployed for the user. The DeleGator is shared code that already exists
  on chain.
- **This is what MetaMask itself does.** MetaMask's "smart account" upgrade and its EIP-5792
  atomic batching (`wallet_sendCalls`) delegate the same EOA to this same DeleGator. In the
  browser, `enterViaWallet()` sends the three calls with `forceAtomic: true`. The user sees
  **one confirmation** in MetaMask, including the one-time upgrade prompt if the account isn't
  upgraded yet. It fails closed if the wallet can't guarantee atomicity.
- **One atomic on-chain action.** The upgrade (the authorization list) and the batch go in the
  *same* type-4 transaction. The batch uses revert-on-failure mode. If the swap fails, the
  supply fails, the deadline passes or slippage is exceeded, everything reverts: no
  swapped-but-not-supplied state can exist. This was tested on a mainnet fork. I made step 3
  fail on purpose, and the tx reverted with the user still holding 2 WETH, 0 USDC and 0 aUSDC.
- **Supplies exactly what the swap returned.** A plain batch can't pass the swap's return
  value into `Pool.supply(amount)`, and Aave's `supply` does not accept `type(uint256).max`.
  So the swap's `recipient` is the `AaveSupplyAll` helper, and the next call in the same
  transaction supplies the helper's **entire** balance for `msg.sender`. Nothing can run
  between those two calls, so that balance is exactly the swap output, down to the last unit.
- **No lingering approvals.** The user approves the router for exactly `amountIn`, and the
  swap uses all of it (allowance → 0). The user never approves the helper. The helper approves
  the Pool for exactly what it supplies (allowance → 0). The helper has no owner, no storage
  and no admin, and it holds nothing between transactions.

Fork run output (mainnet state, block ~26.01M):

```
Delegation      none -> will authorize MetaMask StatelessDeleGator in this tx
Swap            2 WETH
Quote           5293.856316 USDC (Chainlink 5300.492906, dev 12 bps)
Min USDC out    5267.387034 (slippage 50 bps)
Simulation      OK, gas ~405506
Done in block   26012835
WETH left       0  (router allowance now 0)
aEthUSDC +      5293.856315         # 1-wei aToken rounding; helper & user USDC = 0 afterwards
EOA delegation  metamask  (same address 0x9291…822d)
```

## Running it

```bash
npm install
# one-time, from any funded account (the helper is a public utility, not the user's account)
RPC_URL=https://... PRIVATE_KEY=0x... npx tsx entry.ts deploy-helper
# dry run: quotes, oracle cross-check, full simulation of the type-4 tx; sends nothing
RPC_URL=https://... PRIVATE_KEY=0x... SUPPLY_HELPER=0x... npx tsx entry.ts
# broadcast (SEND_RPC_URL lets you send privately, e.g. https://rpc.flashbots.net)
RPC_URL=https://... SEND_RPC_URL=https://rpc.flashbots.net PRIVATE_KEY=0x... SUPPLY_HELPER=0x... npx tsx entry.ts --send
```

Optional env: `SLIPPAGE_BPS` (default 50), `MAX_ORACLE_DEVIATION_BPS` (default 150),
`DEADLINE_SEC` (default 300).

A MetaMask user will never hand over a private key, and MetaMask does not expose raw 7702
authorization signing to dapps. For them, the real product is `enterViaWallet()` (EIP-5792),
which builds the identical calls. The private-key path is for developers and fork testing.

## What the developer must get right

1. **The delegate is the whole security of the account.** Delegating an EOA gives that code
   full control of every asset the address holds. Only delegate to audited, well-known,
   immutable code. Here that is MetaMask's `EIP7702StatelessDeleGator` at the pinned address,
   and you should check `NAME()`/`VERSION()` and the verified source yourself. Never delegate to
   a contract you just wrote. For the same reason, the custom logic lives in a separate helper
   that has no power over the account, not in the delegate.
2. **Don't overwrite an existing delegation.** `entry.ts` reads the EOA's code. If it's empty,
   it authorizes. If it's already the MetaMask DeleGator, it skips the authorization. If it's
   anything else, it **aborts**.
3. **Authorization fields.** Use `chainId = 1`, never `0`: a `0` authorization is valid on every
   EVM chain. In a self-sponsored type-4 tx the authorization nonce must be the *current nonce
   + 1*, because the sender's nonce is bumped before authorizations are processed. viem does
   this with `executor: 'self'`. Sign right before sending. If the nonce moves (another tx from
   the wallet), the authorization is silently skipped. The tx then becomes a no-op call to a
   codeless EOA that still reports "success". That's why the script **checks real state
   afterwards** (aUSDC delta ≥ minOut) instead of trusting the receipt status.
4. **Delegation persists and survives reverts.** The authorization is applied even if the batch
   reverts, and it stays after the tx. That's harmless with the stateless DeleGator, whose
   `execute` is callable only by the EOA itself or the ERC-4337 EntryPoint with the EOA's own
   signature. It is also exactly the state MetaMask's own upgrade leaves. If the user wants a
   plain EOA again, a later type-4 tx delegating to `address(0)` clears it, or they can use
   "switch back" in MetaMask. That is a separate transaction.
5. **Slippage / MEV.** `amountOutMinimum` is the only thing protecting the swap. The script
   quotes via QuoterV2 and refuses to trade if the quote differs from Chainlink ETH/USD by more
   than 1.5%, because a pre-manipulated pool would otherwise set a bad floor. It then takes the
   *lower* of the two prices minus slippage. `multicall(deadline, …)` bounds how long the signed
   tx stays valid. Broadcast through a private RPC (`SEND_RPC_URL`) so 2 WETH isn't sandwiched
   from the public mempool.
6. **Helper correctness.** `AaveSupplyAll` credits aTokens only to `msg.sender`, so a
   mis-encoded batch cannot send the position to someone else. It checks `amount >= minAmount`
   as a second guard, and its `POOL` is pinned (the script checks this before sending). Verify
   its source on Etherscan after deploying. Never send tokens to it outside the batch: anyone
   can call `supplyAll` and take credit for a stray balance.
7. **Aave reserve state.** Supply reverts, and so does the whole tx, if the USDC reserve is
   paused, frozen or at its supply cap. The pre-send `eth_call`/`estimateGas` with the
   authorization list catches this, together with price, deadline and approval problems. Don't
   skip the simulation.
8. **Gas.** The user holds only gas ETH. The script estimates the full type-4 cost (~405k gas,
   including the authorization) with a 20% buffer and aborts if the balance can't cover it.
9. **"All" WETH** means the balance read right before signing. If it drops before inclusion,
   the tx reverts (safe). If it rises, the extra stays as WETH.
10. **Mainnet only.** The script refuses any RPC whose chainId isn't 1 (fork testing with
    anvil keeps chainId 1 and needs `--hardfork prague`).
