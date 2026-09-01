The failure is specific to USDT because USDT does not behave like a standard ERC-20 on `approve`.

Reasoning:

1. On the first run, the router's allowance to the strategy was presumably `0`, so
   `approve(strategy, amount)` succeeded.
2. The strategy often spends less than the approved amount, so after that first run the
   router still has a nonzero leftover allowance for the strategy.
3. On later runs, the router tries to call `approve(strategy, newAmount)` again while the
   current allowance is still nonzero.
4. USDT is one of the tokens that rejects changing an allowance directly from nonzero to
   nonzero. It requires the allowance to be set to `0` first, then set to the new value.
5. Because the router is using a low-level `call`, it is no longer failing on return-value
   decoding, but it still correctly sees that the token call itself reverted or returned
   failure, so `ok == false` and `require(ok, "approve failed")` trips.
6. USDC does not enforce this zero-first rule, so repeated approvals keep working there.

That matches the observed behavior exactly: first USDT run succeeds, every later run fails,
and it fails before transfers because the failure is at the approval step.

Minimal router change:

If you want the smallest direct fix around the current pattern, zero the allowance before
setting the new one whenever the current allowance is nonzero.

```solidity
(bool ok0, bytes memory data0) =
    token.call(abi.encodeWithSelector(0x095ea7b3, strategy, 0));
require(ok0 && (data0.length == 0 || abi.decode(data0, (bool))), "approve reset failed");

(bool ok1, bytes memory data1) =
    token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
require(ok1 && (data1.length == 0 || abi.decode(data1, (bool))), "approve failed");
```

If you want the OpenZeppelin v5 version of the same fix, use `SafeERC20.forceApprove`,
which exists specifically for tokens like USDT:

```solidity
using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

That is the better minimal change in this codebase because it preserves compatibility with
non-standard tokens without relying on the raw call workaround.

What to do about leftover allowance in general:

Do not assume you can overwrite a leftover nonzero allowance with another nonzero allowance.
In general, the router should either:

- always use a zero-first approval flow when resetting allowances, or
- use `SafeERC20.forceApprove`, which handles that for you.

Operationally, leftover allowance should be treated as normal and expected. The code that
refreshes approval must handle it safely. If the design wants tighter approval hygiene, the
router can also clear the allowance back to zero after the strategy pull completes, but that
is a policy choice, not the minimal fix. The essential requirement is: when a leftover
allowance may exist, approval refresh logic must support tokens that require `0 -> N` rather
than `N -> M`.
