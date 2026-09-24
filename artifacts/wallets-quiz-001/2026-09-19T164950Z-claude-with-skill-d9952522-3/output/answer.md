# Review response: "one-click entry" from the user's existing EOA

## Short answer

**No, the user does not have to accept a new address.** The teammate describes EOAs as they worked before Pectra. Since May 2025, EIP-7702 has been live on Ethereum mainnet. It lets an existing EOA sign an authorization that delegates its execution to contract code. The EOA can then run a batch of calls atomically in one transaction. It keeps the same address, the same ENS name and the same history. Nothing new gets deployed as the user's wallet, and no funds have to move.

So the teammate's premise, "an EOA does one call per transaction, that is what an EOA IS", is no longer true. Their conclusion, "deploy a Safe/4337 account, move the WETH, accept the new address", doesn't follow. Moving the funds would also make the user give up exactly what they said they won't give up.

The teammate is right about one narrower point, and the design has to handle it. **A static list of calls can't express "supply whatever the swap returned."** The next sections cover that.

## Walking through the constraints

| Constraint | What it rules out / requires |
|---|---|
| Same address (ENS, 2 years of history) | Rules out migrating to a Safe or a counterfactual 4337 account. Requires EIP-7702 (or two transactions, see the fallback). |
| One confirmation | Everything must happen in one signed transaction. |
| Both legs or neither | The swap and the supply must run in the same transaction, so a revert anywhere undoes all of it. |
| No existing approvals | The batch has to create the WETH approval itself. WETH9 has no `permit`. Permit2 needs a prior approval to Permit2, so a signature can't replace the approval. |
| Supply amount unknown until execution | Some **code** must read the swap's actual output at run time. A fixed calldata list can't do it. |
| Only gas ETH in the account | Fine. The EOA pays its own gas; no paymaster needed. |

### Why a plain static batch isn't enough

The obvious 7702 batch is:

1. `WETH.approve(SwapRouter02, 2e18)`
2. `SwapRouter02.exactInputSingle(WETH→USDC, amountIn = 2e18, recipient = user, amountOutMinimum = quoteMin)`
3. `USDC.approve(AavePool, ???)`
4. `AavePool.supply(USDC, ???, onBehalfOf = user, 0)`

The `???` is the problem. The calldata for calls 3–4 is fixed when the user signs, but the USDC amount only exists after call 2 runs. Aave V3's `supply` doesn't accept `type(uint256).max` as "use my whole balance" (only `withdraw`/`repay` do). The workarounds don't work either:
- Supplying `amountOutMinimum` leaves USDC unsupplied.
- Using `exactOutput` means not swapping "all 2 WETH".

Neither meets the spec. The wallet's batch executor (e.g. MetaMask's delegator behind `wallet_sendCalls`) runs the calls as given. It won't pipe one call's return value into the next.

### How to fill in the dynamic amount

Put a small amount of code in the batch that reads the actual output. I'd use a **stateless adapter contract** called from the EOA's batch:

```
wallet_sendCalls({
  from: user,               // the existing MetaMask EOA
  chainId: 1,
  atomicRequired: true,     // both legs or neither
  calls: [
    { to: WETH,    data: approve(Adapter, 2e18) },                 // exact amount, not max
    { to: Adapter, data: swapAndSupply(2e18, minOut, deadline, user) }
  ]
})
```

`Adapter.swapAndSupply(amountIn, minOut, deadline, onBehalfOf)`:
1. `transferFrom(msg.sender, this, amountIn)` for the WETH. This uses up the exact approval, so no allowance is left over.
2. Calls Uniswap V3 `exactInputSingle` with `recipient = this` and `amountOutMinimum = minOut`, and **uses the returned `amountOut`**.
3. `USDC.forceApprove(AavePool, amountOut)`, then `AavePool.supply(USDC, amountOut, onBehalfOf, 0)`. The aUSDC goes to the user's EOA, not the adapter.
4. Requires that it holds zero WETH and zero USDC at the end. It keeps no state, has no owner, isn't upgradeable, and only moves tokens from `msg.sender`.

Every piece sits inside one transaction. If the swap misses `minOut`, the deadline passes, the Aave supply cap is hit, or the reserve is paused, the whole batch reverts. The user ends up holding their 2 WETH with no approvals left behind. That is the "both legs or neither" guarantee.

(Alternative: a custom 7702 delegate with the swap-then-supply logic built in. I wouldn't ship that. Wallets, including MetaMask, deliberately don't let dapps pick the delegate for a user's EOA. A delegate controls the whole account, so a dapp-supplied one is a full-account-takeover surface. Stay on the wallet's own audited delegator and put the dynamic logic in an adapter that can only touch what it is approved for.)

## What I would ship

1. **Detect capability.** Call `wallet_getCapabilities` and check atomic batch support for the chain (`atomic.status` = `supported` or `ready`). If the account isn't yet upgraded, MetaMask asks the user to approve the 7702 upgrade to its smart account delegator in the same flow. The address doesn't change.
2. **Quote live.** Get the WETH→USDC quote from the Uniswap V3 Quoter, derive `minOut` from an explicit slippage tolerance, and set a short deadline. Estimate gas live and price it at the current base fee. Never use a remembered ETH price.
3. **Confirmation screen (the gate).** Show:
   - "Swap 2.000000 WETH → ≥ X USDC (min), supply all received USDC to Aave V3."
   - The checksummed Adapter, SwapRouter and Aave Pool addresses.
   - The estimated gas cost in ETH.
   - "Both steps succeed or neither happens."
   - Then one confirmation.
4. **Send** with `wallet_sendCalls` and `atomicRequired: true`. **Never quietly fall back to sending the calls one by one.** That would break the both-or-neither promise and could leave the user holding USDC and not supplying it.
5. **Verify after execution.** Check the aUSDC balance increase, zero WETH/USDC left in the Adapter, and zero remaining WETH allowance to the Adapter.
6. **Adapter hygiene.** Keep it immutable and minimal, with an audit or at least a fork test against mainnet Uniswap/Aave. Include tests for the revert paths (slippage, supply cap, paused reserve) that assert the user's state is unchanged.

**Fallback for wallets without atomic batching:** same address, two transactions. First `WETH.approve(Adapter, 2e18)`, then `Adapter.swapAndSupply(...)`. The second transaction is still atomic on its own, so the swap and the supply still land together or not at all. The only thing lost is "one confirmation", and the leftover exact approval is harmless if the user stops after step one. Even without 7702, **a new address is never required** for the both-or-neither part.

## Caveat to put in the PR (7702 delegation persists)

A 7702 delegation isn't scoped to this transaction. It stays on the account until another signed authorization replaces or clears it. It can stay in place even if the batch's inner calls revert. For this design that's acceptable because the delegate is the wallet's own audited delegator, not ours. The PR should still say so plainly, and the UI or docs should explain how the user reverts to a plain EOA: the wallet's "switch back to standard account" option, which signs an authorization to the zero address. Shutting down any contract doesn't remove the delegation.

## Verdict on the review

- "An EOA does one call per transaction": **outdated since Pectra (EIP-7702).**
- "They need a smart-contract wallet at a new address": **wrong.** The existing EOA can batch atomically as itself.
- "There is no way around it": **wrong.** Ship `wallet_sendCalls` (atomic, via 7702 on the user's current MetaMask address) calling a stateless swap-and-supply adapter. The adapter reads the actual swap output and supplies exactly that amount.
- The valid point hidden in the objection is that a *fixed* batch can't supply an amount that isn't known until execution. That's real. The adapter fixes it, not a change of address.
