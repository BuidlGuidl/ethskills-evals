# Re: "there is no way around it" — no, the user keeps their address

## The verdict, directly

> "An EOA does one call per transaction — that is what an EOA IS."

That was true until Pectra. It has not been true on Ethereum mainnet since **May 2025**,
when **EIP-7702** activated. An existing EOA can sign an authorization that delegates its
address to contract code, and in that same transaction execute a batch atomically — **same
address, same ENS, same history, no new account deployed, no funds moved**.

So the recommendation in the review — deploy a Safe or a 4337 account, transfer the 2 WETH
into it, tell the user to accept the new address — is solving a problem that has a
same-address solution. We should not ask this user to abandon two years of history and an
ENS name for a batching primitive their own EOA now has.

One correction to the framing while we are here: even "deploy a Safe" no longer implies a
new address. Safe ships a 7702-compatible setup, and 4337 bundlers accept 7702-delegated
EOAs. The choice is not "EOA vs. smart account" anymore; it is "which code do I point my
existing address at."

## The part the review got right, buried in the wrong conclusion

The genuinely hard constraint in this design is not batching. It is this line:

> The supplied amount is whatever the swap actually returns; it is not known before the
> transaction runs.

A batch executor replays a fixed list of `(target, value, calldata)`. The calldata is signed
before the swap runs, so you cannot put `amountOut` in it. Handing someone a 7702 batcher
and saying "you're done" ships a broken feature — either you supply a stale guess and leave
USDC stranded, or the second call reverts.

Two ways out. Ship the second.

**Option A — supply exactly `amountOutMinimum`, no new contract.** The swap already
guarantees at least `amountOutMinimum` or it reverts, so that number *is* known at signing
time. Batch: `approve(pool, minOut)` → `exactInputSingle` → `supply(USDC, minOut, …)`.
Atomic, works with any stock 7702 batcher (MetaMask's delegation framework, ERC-7821, Safe's
7702 module), zero bespoke code to audit. The cost: the slippage residue — everything the
swap returned above `minOut` — sits in the wallet as loose USDC. That violates "supply every
USDC that swap returns."

**Option B — one small stateless adapter, and the dynamic amount is handled in Solidity.**
The return value of `exactInputSingle` is available inside a contract call. Read it, supply
it. This is what I'd ship.

## What I would ship

A 7702 transaction whose delegate is a **well-audited generic batcher** (not bespoke code —
see the durability caveat below), executing three calls with fully static calldata:

1. `WETH.approve(zap, 2e18)`
2. `zap.swapAndSupply(2e18, minOut, deadline, user)`
3. `WETH.approve(zap, 0)`

`Zap` is an immutable, stateless helper that custodies nothing between transactions:

```solidity
function swapAndSupply(uint256 amountIn, uint256 minOut, uint256 deadline, address onBehalfOf)
    external
{
    WETH.transferFrom(msg.sender, address(this), amountIn);
    WETH.approve(address(ROUTER), amountIn);

    uint256 out = ROUTER.exactInputSingle(ISwapRouter.ExactInputSingleParams({
        tokenIn: address(WETH), tokenOut: address(USDC), fee: 500,
        recipient: address(this), deadline: deadline,
        amountIn: amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0
    }));

    USDC.approve(address(AAVE_POOL), out);
    AAVE_POOL.supply(address(USDC), out, onBehalfOf, 0);   // aTokens mint to the user's own address
}
```

Why this shape:

- **`out` is the real number.** Every USDC the swap returned gets supplied. No dust, no guess.
- **The aTokens land at the user's address**, via Aave's `onBehalfOf`. The zap never holds a
  position.
- **Atomicity is free.** One transaction, one revert domain. Swap fails → nothing happened.
  Aave paused or supply-capped → nothing happened. Both legs or neither, as specified.
- **The "no approvals" property survives.** Call 3 zeroes the allowance in the same atomic
  batch, so the account ends the transaction exactly as it started: no standing approval to
  the zap, to the router, or to anything else. This is why the batcher matters — without it
  you would have to leave a live allowance sitting there between transactions.
- **The bespoke code is not the account's code.** The zap is a call target with a WETH
  allowance that exists for the duration of one transaction. It is not what the address
  delegates to.

Without 7702 this needs two confirmations — WETH is WETH9 and has no `permit`, and routing
through Permit2 just relocates the same one-time approval. There is no single-confirmation,
same-address path here other than 7702.

## The caveat that has to be in the PR, not in a follow-up ticket

**A 7702 delegation is not scoped to the transaction that sets it. It persists.**

After this runs, the account has code, permanently, until it is replaced or explicitly
cleared by a *new signed authorization*. Decommissioning the delegate contract does nothing —
the pointer stays. And a transaction whose inner batch reverts can still leave the delegation
standing: the swap failing does not undo the upgrade.

That is a real change to the user's account, and it is the thing they should actually be
consenting to in the confirmation dialog — not the swap, which they already understand. Ship
it with:

- **A revocation path in the UI.** A visible affordance to sign an authorization to
  `address(0)` and return to a plain EOA. The user must be able to remove the delegate
  *without the delegate's cooperation*. If we can't ship the off-ramp, we don't ship the
  on-ramp.
- **A pinned, verified delegate address.** Delegated code has total control of the account's
  balance and storage. Wrong address here is not a bug, it is a drained wallet. Pin it,
  verify it on-chain, and do not let it be configured at runtime.
- **An explicit `chainId` in the authorization.** `chainId = 0` makes the authorization valid
  on every EVM chain. Use the real chain id unless cross-chain delegation is a deliberate
  product decision, which it isn't here.
- **A note on downstream behavior.** The address now returns non-empty `EXTCODEHASH`.
  Anything that gates on "is this an EOA" — some airdrop claims, some `tx.origin ==
  msg.sender` checks — may treat this account differently afterward. Worth telling a user
  with two years of history and an ENS name before they sign, not after.

## Before it moves funds

Per our own rule for anything that spends: the confirmation stops on a screen showing the
exact WETH in, the `minOut` floor the user chose, the checksummed zap and Aave pool
addresses, and a **live** gas estimate — priced at submission time, never from a remembered
ETH price. This account holds only enough ETH for gas, and a 7702 transaction is not free:
21k base + 25k for the authorization on a not-yet-delegated account, plus the swap and the
supply. Budget roughly 450–550k gas and check the balance covers it *before* prompting; a
7702 transaction that runs out of gas can still burn the authorization nonce.

Two things worth knowing if the balance is short: 7702 lets a separate sponsor submit the
transaction while the user only signs the authorization, so gas sponsorship is available
without changing this design. And `minOut` on a 2 WETH swap is MEV-relevant — set it from a
live quote with a tight tolerance, and prefer a private mempool for submission.

## Summary

The teammate is wrong on the premise and therefore wrong on the remedy. The user does not
have to accept a new address; EIP-7702 gives their two-year-old MetaMask account atomic
batching in place. The real engineering problem in this PR is the runtime-determined supply
amount, which a fixed batch cannot express — solved by a small stateless zap that reads the
swap's return value. The real *risk* in this PR is that the delegation outlives the
transaction, which is a consent-and-revocation requirement, not a footnote.
