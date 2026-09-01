# Re: "There is no way around it" — no, the user keeps their address

**Short answer: the teammate is wrong, and the fix is EIP-7702.** The user does not have to
abandon their address, their ENS, or their history. Since Pectra (mainnet, May 2025) an EOA can
carry a delegation pointer to contract code and execute a batch *as itself*, at the same address.
That is exactly the hole this design falls into.

The verdict was correct in 2024. It has been out of date for over a year.

---

## 1. Where the teammate is right, and where the reasoning breaks

They are right about two things, and it's worth conceding them plainly:

- A pre-Pectra EOA transaction has exactly one `to` field. One top-level call.
- An ERC-4337 account is a *new* contract at a *new* address. You cannot retrofit one onto an
  existing EOA. Same for deploying a Safe. So if 4337 or Safe were the only options, "accept the
  new address" would follow.

The break is in the middle step: **"they need a smart-contract wallet" does not follow from
"they need more than one call."** One top-level call has never meant one *action* — the callee can
do arbitrarily much. What actually blocks this specific flow is narrower and worth naming precisely,
because it's what determines the fix:

> The 2 WETH sit in the EOA. ERC-20 is **pull**-based: any contract that wants to spend them needs
> an allowance first, and granting that allowance is itself a call. The account has no approvals to
> anything, so the one call available gets consumed by `approve` — and there is nothing left to
> trigger the swap with.

This is a *custody and approval* constraint, not a metaphysical property of EOAs. Note the
counterfactual that proves it: if the user held 2 **ETH** instead of 2 WETH, this whole flow works
today on a stock EOA with no 7702 and no new address — `zap{value: 2 ether}(...)` pushes the value
and triggers the contract in the same call, because native ETH is push-based. WETH9 has no
`permit` (it predates EIP-2612) and no transfer hook (not ERC-777/ERC-1363), so there is no
signature-based or callback-based way to pull it. That, and only that, is the real blocker.

And EIP-7702 removes exactly that blocker.

## 2. What EIP-7702 actually does here

The user signs an authorization tuple `(chain_id, implementation_address, nonce)`. It is carried in
the `authorization_list` of a type-`0x04` transaction and sets the account's code to the 23-byte
designator `0xef0100 || implementation`. From then on, a call to the user's own address executes the
implementation's logic with the EOA as `msg.sender` and `address(this)`.

What this means for the objections in the review:

| Concern | Reality under 7702 |
|---|---|
| New address? | **No.** Same address, byte for byte. |
| ENS name? | Untouched — forward and reverse records still resolve to the same address. |
| Two years of history? | Untouched. Same account, same nonce sequence. |
| "Move the WETH into it"? | No transfer. The WETH never leaves the account. |
| Extra confirmation to set it up? | **No.** The authorization and the batch ride in the *same* type-4 transaction. First use is one confirmation. |
| One-way door? | **No.** Signing an authorization for `0x0` wipes the code and returns it to a bare EOA. Migrating to a Safe is the one-way door here, not this. |

The key detail that answers the review directly: the account is still an EOA. Its private key still
signs, its nonce is still the same counter. It just has a delegation pointer. "That is what an EOA
IS" is now describing a thing that has a batching mode.

## 3. The other half: the amount isn't known in advance

Batching alone does not finish the job, and this is the part most 7702 write-ups skip. The batch is
built and signed *before* it executes, so you cannot put the swap's output amount into the third
call. And Aave V3's `supply(asset, amount, onBehalfOf, referralCode)` does a `safeTransferFrom` of
the exact `amount` — unlike `withdraw` and `repay`, it does **not** treat `type(uint256).max` as
"all of it." So there is no max-sentinel escape.

The fix is a stateless adapter that reads its own balance at execution time. Then the batch is only
two calls:

1. `WETH.transfer(zap, 2e18)` — push the WETH into the adapter.
2. `zap.zapAndSupply(...)` — the adapter reads its WETH balance, swaps *all* of it, reads the USDC
   that came back, and supplies *that* to Aave with `onBehalfOf = user`.

Use `transfer`, not `approve`. It is safe because both calls are in one atomic transaction, and it
means the account **still has zero token approvals afterwards** — which, given the user has kept a
clean approval surface for two years, is not a detail to throw away.

The aTokens land in the user's EOA. Any revert anywhere — slippage, Aave supply cap, reserve frozen
— reverts the whole transaction. Both legs or neither, which is the actual requirement.

## 4. What I'd ship

### The adapter

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn; address tokenOut; uint24 fee; address recipient;
        uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata) external payable returns (uint256);
}

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

/// @notice Holds nothing between transactions. Spends whatever `tokenIn` balance it finds,
///         which the caller pushed in earlier in the same atomic batch.
contract SwapAndSupplyZap {
    ISwapRouter02 public immutable router;
    IAavePool public immutable pool;

    constructor(ISwapRouter02 _router, IAavePool _pool) { router = _router; pool = _pool; }

    function zapAndSupply(
        address tokenIn,
        address tokenOut,
        uint24  fee,
        uint256 amountOutMinimum,
        address onBehalfOf,
        uint256 deadline
    ) external returns (uint256 supplied) {
        // Only the account that funded this call can direct the funds. Closes the
        // "someone else zaps your stranded balance into their own position" vector.
        require(msg.sender == onBehalfOf, "not beneficiary");
        require(block.timestamp <= deadline, "expired");

        uint256 amountIn = IERC20(tokenIn).balanceOf(address(this));
        require(amountIn != 0, "nothing to swap");

        IERC20(tokenIn).approve(address(router), amountIn);
        router.exactInputSingle(ISwapRouter02.ExactInputSingleParams({
            tokenIn: tokenIn, tokenOut: tokenOut, fee: fee,
            recipient: address(this), amountIn: amountIn,
            amountOutMinimum: amountOutMinimum, sqrtPriceLimitX96: 0
        }));

        // Read the balance rather than trusting the return value: this is the amount that
        // is actually here, and it absorbs any stray donation instead of reverting on it.
        supplied = IERC20(tokenOut).balanceOf(address(this));
        require(supplied >= amountOutMinimum, "slippage");

        IERC20(tokenOut).approve(address(pool), supplied);
        pool.supply(tokenOut, supplied, onBehalfOf, 0);
    }
}
```

Notes on the details:
- `SwapRouter02`'s `ExactInputSingleParams` has **no** `deadline` field (that was SwapRouter v1), so
  the deadline is enforced in the adapter. Don't assume the router does it.
- Use `SafeERC20.forceApprove` in the shipped version. USDC and WETH are both well-behaved, but
  don't bake the assumption in.
- `amountOutMinimum` comes from an off-chain `QuoterV2.quoteExactInputSingle` staticcall plus the
  user's slippage tolerance. It is the single most important input — the atomicity guarantee is
  worthless if the swap leg can execute at any price.
- Balance-based reads on both legs are what make an unknown output amount a non-problem.

### The client side (EIP-5792, not raw 7702)

Don't construct the authorization tuple yourself. Ask the wallet, via `wallet_sendCalls` — MetaMask
handles the 7702 upgrade, picks its own audited delegation implementation, and shows the user one
confirmation covering both the upgrade and the batch.

```js
const caps = await provider.request({
  method: 'wallet_getCapabilities', params: [account, ['0x1']],
});
const atomic = caps['0x1']?.atomic?.status; // 'supported' | 'ready' | 'unsupported'

if (atomic === 'supported' || atomic === 'ready') {
  const { id } = await provider.request({
    method: 'wallet_sendCalls',
    params: [{
      version: '2.0.0',
      chainId: '0x1',
      from: account,
      atomicRequired: true,          // fail loudly rather than silently splitting into two txs
      calls: [
        { to: WETH, data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer',
            args: [ZAP, parseEther('2')] }) },
        { to: ZAP,  data: encodeFunctionData({ abi: zapAbi, functionName: 'zapAndSupply',
            args: [WETH, USDC, 500, minOut, account, deadline] }) },
      ],
    }],
  });
  // poll wallet_getCallsStatus with `id`
}
```

`atomicRequired: true` is load-bearing. Without it a wallet is permitted to fall back to sequential
transactions, which is precisely the failure mode the user asked to be protected from.
`'ready'` means the wallet can upgrade the account with the user's approval — that is the
first-run case, and it is still one confirmation.

### Degrade path, in priority order

1. **Atomic available** → the above. One confirmation, no residual approvals, same address.
2. **Atomic unsupported** (an old wallet, or a chain without Pectra) → two confirmations:
   `WETH.approve(zap, ...)`, then a `zapAndSupplyFrom` variant that does the `transferFrom` itself.
   Worth being precise about what this costs, because it's less than the review implies: the
   **swap and supply are still atomic with each other** — that requirement is met by the adapter
   contract alone and never needed a smart wallet at all. Only the *single confirmation* is lost.
3. **Never** — migrate the user to a new address.

Which surfaces the conflation at the root of the review: two separate requirements got merged into
one. *Swap+supply atomicity* has been solvable with a plain zapper contract plus a one-time approval
since Uniswap V3 shipped. *Single confirmation from a cold, approval-free account* is the part that
needed 7702. Neither has ever needed a new address.

## 5. Risks I'd put in the PR description, not bury

- **A 7702 delegation is total control of the account.** Whatever you delegate to can move
  everything. Delegate only to a well-known audited implementation (MetaMask's own delegator,
  Safe's 7702 module, Uniswap's Calibur, ZeroDev Kernel, Biconomy Nexus) — never to something we
  wrote. Routing through `wallet_sendCalls` gets this right by construction, since the wallet
  chooses. This is the single largest new risk surface the design introduces and it deserves an
  explicit line in the PR.
- **Sign authorizations with an explicit `chain_id`, never `0`.** A `chain_id` of 0 makes the
  delegation valid on every chain. Again, deferring to the wallet avoids this.
- **Gas.** "Only enough ETH to pay gas" is a real problem. This batch is roughly 350–450k gas
  (25k first-time delegation cost + approve + V3 swap + Aave supply), several times a plain
  transfer. Check the balance against a live estimate *before* showing the confirmation, and say so
  in the UI rather than letting them sign something that reverts. If we want to remove this, a
  7702-delegated 4337 account can use a paymaster — but that's a follow-up, not a blocker.
- **Aave preconditions.** USDC supply cap, reserve frozen/paused. Any of these revert the batch.
  Atomicity means the user loses gas, not funds — but check them off-chain first and don't offer
  the button if they'll fail.
- **Confirm Pectra on the target chain** if this is going anywhere beyond mainnet.
- **Reverting to a plain EOA** is one authorization signed to `0x0`. Document it, and put it in the
  UI. It is the strongest counter to "you must accept a new address," and users should know the
  door swings both ways.

---

## Verdict

> "Tell the user to accept the new address. There is no way around it."

There is a way around it, it shipped in Pectra in May 2025, and it was designed for this exact
scenario — batching from an account whose address, ENS, and history you cannot give up. Ship the
stateless adapter plus a two-call `wallet_sendCalls` batch with `atomicRequired: true`. The user
keeps their address, gets one confirmation, gets both-legs-or-neither, and ends the transaction with
the same zero token approvals they started with.
