# Why the USDT deposit reverts

The failing call is the direct approval:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is not a fully standard ERC-20 implementation. In particular, its
`approve` function does not return the `bool` that `IERC20.approve` declares.
Solidity therefore makes the external call, receives empty return data, and then
tries to ABI-decode that data as a Boolean. The decode fails and the caller
reverts, commonly with no useful reason string.

The OpenZeppelin mock cannot reproduce this behavior. A stock OpenZeppelin
`ERC20` implements the standard ABI and returns `true` from `approve`, so the
same direct call always has return data that can be decoded successfully. The
fact that both tokens use six decimals is irrelevant to this failure.

`SafeERC20` protects only calls made through its wrapper functions. This line is
wrapped:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`SafeERC20` performs a low-level call and treats empty return data as success,
which accommodates USDT. Merely declaring `using SafeERC20 for IERC20` does not
change or intercept `usdt.approve(...)`; that expression still calls the
`IERC20` function directly and Solidity still attempts to decode a `bool`.

## Code fix

Use the SafeERC20 allowance operation as well:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` is the robust choice for USDT. It accepts tokens that return no
value and, when necessary, retries by first setting the allowance to zero. That
also handles USDT's other well-known constraint: changing a nonzero allowance
directly to another nonzero allowance can fail. It is preferable to ignoring the
return value from a raw `approve`, because the revert here occurs while decoding
the return data, before Solidity can discard the returned expression.

If the installed OpenZeppelin version predates `forceApprove`, upgrade it. An
equivalent compatibility helper must use low-level optional-return calls and
perform the zero-then-set fallback; a plain `approve` is not equivalent.

## Testing-practice fix

Add a pinned-mainnet-fork integration test that uses the actual deployed USDT
and Aave V3 contracts and executes the complete deposit path. For example, fork
a fixed block with `vm.createSelectFork`, give a test actor real USDT state (for
example by impersonating a funded holder and transferring tokens), approve the
vault, deposit, and assert that the Aave supply succeeds and the vault receives
the expected aToken/accounting result. The RPC endpoint must support historical
state at the pinned block.

Keep the mock unit tests for local logic, but do not use them as evidence of
external-integration compatibility. A mock is an executable version of the
assumptions made by its author. Here it assumes standards-compliant Boolean
returns, while deployed USDT violates that assumption. Adding 39, 390, or any
number of tests against the same stock mock only exercises more inputs through
the same incorrect ABI behavior; it cannot discover behavior that the mock does
not implement. A test using a specially written non-returning token could serve
as a regression test after this defect is known, but the pre-deployment search
that would have exposed the unknown mismatch is a pinned fork against the real
token and protocol.
