# Re: "This can't work from a plain EOA — accept the new address"

## Short answer

**No, the teammate is wrong about the conclusion.** Their premise was true until
the Pectra upgrade (mainnet, May 2025). **EIP-7702** changed it: an EOA can sign
an authorization that installs a delegation designator (`0xef0100 || implAddress`)
as its own code. After that, **the same address** runs smart-account logic,
including atomic batching, and the same MetaMask key still signs. There's no new
address, no Safe or 4337 deployment, and the WETH never has to move. The ENS name,
history, and reputation all stay attached to the account the user already has.

MetaMask already ships this as its "smart account" upgrade. Dapps reach it through
**EIP-5792** (`wallet_sendCalls`) with the `atomic` capability.

The teammate does have one part right, though it's not the part they flagged: a
**plain static batch is not enough here**, because the supply amount isn't known
until the swap runs. That needs a small helper contract (details below). It doesn't
need a new address.

## Why "one call per transaction" doesn't settle it

| Claim in the verdict | Status in 2026 |
|---|---|
| "An EOA does one call per transaction" | True only for an **undelegated** EOA. A 7702-delegated EOA runs whatever its delegate code does, e.g. `executeBatch(calls[])`, and all of it succeeds or reverts together. |
| "Need a smart-contract wallet" | You need smart-contract **code at the address**. 7702 puts the code at the existing address. |
| "Deploy a Safe / 4337 account, move WETH into it" | That route would work, but it throws away the thing the user said they won't give up. It's also more transactions (deploy + transfer + batch) than the 7702 route. |
| "There is no way around it" | 7702 is the way around it. It exists for exactly this case. |

## Why an ordinary batch is still not enough (and what solves it)

The obvious 7702 batch would be:

1. `WETH.approve(SwapRouter02, 2e18)`
2. `SwapRouter02.exactInputSingle(WETH→USDC, 2e18, recipient = self, amountOutMinimum)`
3. `USDC.approve(AavePool, X)`
4. `AavePool.supply(USDC, X, self, 0)`

The problem is **X**. Batch calldata is fixed when the user signs. Calls 3 and 4
can't read the return value of call 2, and Aave V3's `supply` has no
"use the whole balance" (`type(uint256).max`) option. So you're stuck:

- If X is set to `amountOutMinimum`, the difference stays in the wallet as loose
  USDC. That breaks "supply every USDC the swap returns".
- If X is set above what the swap returns, `supply` reverts.

The fix is to have **on-chain code read the real output**. There are two
reasonable ways:

- **(A) A helper/adapter contract (recommended).** It's stateless and holds nothing
  between transactions:

  ```solidity
  function swapAndSupply(uint256 amountIn, uint256 minOut, uint24 fee) external {
      WETH.transferFrom(msg.sender, address(this), amountIn);
      WETH.approve(address(ROUTER), amountIn);
      uint256 out = ROUTER.exactInputSingle(ISwapRouter02.ExactInputSingleParams({
          tokenIn: address(WETH), tokenOut: address(USDC), fee: fee,
          recipient: address(this), amountIn: amountIn,
          amountOutMinimum: minOut, sqrtPriceLimitX96: 0
      }));
      USDC.approve(address(POOL), out);
      POOL.supply(address(USDC), out, msg.sender, 0);   // aUSDC minted to the user's own address
  }
  ```

  The helper uses the exact `out` the swap returned. The aTokens are credited
  `onBehalfOf = msg.sender`, which is the user's two-year-old address. If
  `minOut` isn't met, or anything else fails, the whole transaction reverts and
  neither leg happens.

- **(B) A delegate implementation that supports dynamic calls**, e.g. an
  executor that can read `balanceOf(self)` or a previous call's return value and
  feed it into a later call. This works too, but only if the wallet's chosen
  delegate supports it. With MetaMask you don't control the delegate, so (A) is
  the portable choice.

## What I would ship

**Primary path, one confirmation, same address:**

1. `wallet_getCapabilities(user, [chainId])`. Proceed only if
   `atomic.status` is `"supported"` (already delegated) or `"ready"` (the wallet
   will perform the 7702 upgrade as part of this send).
2. `wallet_sendCalls` with `atomicRequired: true` and two calls:
   - `WETH.approve(helper, 2e18)`, an exact amount rather than unlimited;
   - `helper.swapAndSupply(2e18, minOut, 500)`, where `minOut` comes from a
     QuoterV2 quote minus the slippage tolerance, and the transaction carries a
     short deadline/expiry.
3. The user confirms once in MetaMask. If the account isn't delegated yet, the
   upgrade authorization goes into the same type-4 transaction. Then track the
   result with `wallet_getCallsStatus`.

Result: 2 WETH is swapped and every USDC it returned is supplied to Aave. The
aUSDC sits at the user's existing ENS address, or nothing happens at all.

**Guardrails that belong in the PR:**

- **Never fall back silently to non-atomic sends.** If the wallet reports
  `atomic` as `"unsupported"`, `wallet_sendCalls` could execute the calls one by
  one. That breaks "both legs or neither". Fail closed and show the fallback below.
- **Delegate choice is a security decision.** A 7702 delegate controls the
  account completely until it's revoked. Use the wallet's own audited
  implementation (MetaMask's smart account). Never have the dapp ask the user to
  sign an authorization to an arbitrary contract. Pin `chainId` (no `0`
  / all-chains authorizations). Document how to revoke: re-delegate to
  `address(0)`.
- **Gas budget.** The user holds "only enough ETH for gas". The first transaction
  also pays for the 7702 authorization (about 25k extra gas) plus swap, approve,
  and supply, so roughly 300k+ gas in total. Estimate it and warn before the
  confirmation instead of letting it revert.
- **The helper must not keep funds or allowances.** It pulls exactly
  `amountIn`, grants approvals only for exact amounts, and has no owner, no sweep
  function, and no stored state. Test that a revert on either leg (bad `minOut`,
  paused Aave reserve, supply cap reached) rolls back the whole transaction. Run
  that test against a mainnet fork.
- Also check that the USDC reserve isn't frozen or paused and isn't near its
  **Aave supply cap**. Otherwise the supply leg reverts, and the swap reverts with it.

**Fallback if the wallet can't do atomic batching (still the same address):**
two confirmations. First, a one-time `WETH.approve(helper, 2e18)`. Second,
`helper.swapAndSupply(...)`. The swap-and-supply step is still atomic, because
it's a single call. Only the approval is separate, and an approval on its own
moves no funds. So even without 7702 the answer isn't "new address". It's "two
clicks instead of one". (Mainnet WETH9 has no EIP-2612 `permit`, so a
signature-only approval isn't available. Permit2 would itself need a one-time
approval first.)

## Verdict to post on the PR

> The "one call per transaction" premise no longer holds. Since Pectra, EIP-7702
> lets this exact EOA delegate to smart-account code and batch atomically. It
> keeps its address, ENS, and history. MetaMask exposes this via EIP-5792
> `wallet_sendCalls` with `atomic` support. So no Safe, no 4337 account, and no
> new address. The real design issue is different: the supply amount is only
> known after the swap, and a static batch can't pass it along. We handle that
> with a stateless `swapAndSupply` helper that supplies the swap's actual output
> `onBehalfOf` the user. The batch becomes `[approve(helper, 2 WETH),
> helper.swapAndSupply(2 WETH, minOut)]`: one confirmation, atomic, same address.
> We fail closed if the wallet doesn't report atomic support, and in that case
> fall back to approve + one atomic call.
