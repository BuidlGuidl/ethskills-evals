# The missing 25,000 TKN

## Short answer

Nothing left the pool that shouldn't have. TKN is a **fee-on-transfer token** (~2%),
and the pool credits `stakedBalance` with the *requested* amount instead of the amount
it *actually received*. Every stake mints ~2% of phantom liabilities. The pool is not
leaking assets — it is manufacturing debt.

## The arithmetic that proves it

The user report is the tell: staked 10,000, UI showed 10,000, unstaked all 10,000,
wallet received 9,800. That is a 2% fee on the outbound leg. If the fee applies to the
inbound leg too, the pool only ever received 9,800 for that 10,000 credit.

Model it: on `transferFrom(user -> pool, amount)` the pool's balance rises by
`0.98 * amount`. On `transfer(pool -> user, amount)` the pool's balance falls by the
full `amount` and the user receives `0.98 * amount`.

```
assets  = 0.98 * 1,250,000  -  250,000  =  1,225,000 - 250,000 = 975,000  ✓ actual balance
liabilities =      1,250,000  -  250,000  =  1,000,000                    ✓ sum of stakedBalance
shortfall   =  0.02 * 1,250,000           =     25,000                    ✓ exactly the gap
```

Both observed figures fall out of a single 2% transfer fee, to the token. This is not a
coincidence you can get from a bug in the accounting arithmetic (there is none — the
contract's `+=` / `-=` are correct), from a rebase (excluded), from an admin drain (no
such function), or from reentrancy (there is nothing to re-enter). The deficit is exactly
2% of *cumulative stakes*, which is the signature of a per-deposit skim.

Note the shortfall is **2% of cumulative staked**, not 2% of currently staked. Unstakes do
not reduce it: the pool debits the full `amount` and the withdrawing user eats the exit fee
personally. So the hole is monotonically non-decreasing and grows by 200 TKN per 10,000 TKN
of new deposits, forever, for as long as staking stays open.

## Why early unstakers were fine and today's revert

The pool pays claims first-come-first-served out of a pot that is only ~97.5% of what it
owes. While `poolBalance >= amount` the transfer succeeds; the user is simply drawing down
someone else's principal. The contract has no solvency check, so the deficit is invisible
until the balance runs below the next requested amount and the *token* reverts with
insufficient balance. In other words: the pool is running a slow bank run, and the revert
threshold has now reached the current queue. Left alone, the last ~2.5% of stakers
(≈25,000 TKN of claims, and rising) are the ones who eat 100% of the loss — a purely
arbitrary, ordering-based allocation.

Two further consequences worth stating plainly, because they are the real severity:
- The loss allocation is **race-based**, so the rational move for every remaining staker is
  to exit immediately. Expect a gas auction the moment this is public.
- Every new deposit taken from here on is partly funding the exit of an earlier staker.
  That is why **staking must be halted before anything else**.

## The fix

### 1. Credit the measured balance delta, not the requested amount

```solidity
using SafeERC20 for IERC20;

function stake(uint256 amount) external nonReentrant whenNotPaused {
    uint256 balanceBefore = token.balanceOf(address(this));
    token.safeTransferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - balanceBefore;

    stakedBalance[msg.sender] += received;   // credit what actually arrived
    totalStaked             += received;
    emit Staked(msg.sender, amount, received);
}

function unstake(uint256 amount) external nonReentrant {
    stakedBalance[msg.sender] -= amount;     // reverts on underflow (>=0.8)
    totalStaked               -= amount;
    token.safeTransfer(msg.sender, amount);  // recipient bears the exit fee
    emit Unstaked(msg.sender, amount);
}
```

With this, `sum(stakedBalance) == token.balanceOf(pool)` holds as an invariant for all
future activity: the pool only ever promises tokens it is actually holding. The staker
still pays the token's fee on both legs — that is the token's behaviour and cannot be
avoided — but the *pool* is no longer insolvent, and the UI should show the credited
`received`, not the submitted `amount`, so 9,800 is displayed from the start.

The alternative, if you would rather not support fee-on-transfer tokens at all, is to
reject them explicitly: `require(received == amount, "fee-on-transfer unsupported")`.
Choose one; do not leave the behaviour implicit. Do not "fix" it by whitelisting the
token at deploy time and trusting it — several tokens ship with a fee switch that is
disabled at launch and can be turned on later by their owner, which is very likely what
happened here (the books only broke after launch). The balance-delta measurement is the
only form that stays correct across a fee that changes under you.

Also required, per the same ERC-20 integration hygiene: `SafeERC20` (TKN's `transfer`
may return no bool or return false without reverting), a `nonReentrant` guard on both
entry points, and strict checks-effects-interactions — note `unstake` already decrements
before transferring, which is correct; keep it that way.

### 2. Do not deploy the fix and call it done

Fixing `stake()` stops the hole growing. It does **not** refill the existing 25,000, and
the stranded stakers are still stranded. Sequence:

1. **Pause `stake()` immediately.** Every further deposit deepens the hole and, worse,
   silently funds an earlier exit. This is the urgent step — it comes before the code fix.
2. **Fix the accounting** as above (new contract, or a migration — if the live pool is
   non-upgradeable you will need a new deployment plus a migration path, which is another
   reason to stop deposits now and snapshot balances).
3. **Settle the 25,000 shortfall.** Two honest options:
   - **Backfill from the treasury** (the right answer if this was your integration bug and
     you can afford it): send enough TKN to make the pool whole. Remember the fee applies
     to *that* transfer too — to land 25,000 you must send `25,000 / 0.98 ≈ 25,510.21`, and
     you must re-measure against the live shortfall at the moment you do it, not against
     today's number.
   - **Socialize the loss pro-rata**, which is at least fair: switch to share-based
     accounting and pay out `balanceOf(pool) * shares[user] / totalShares`, so every
     remaining staker takes the same ~2.5% haircut instead of the last 2.5% of stakers
     taking a 100% loss. This is the only defensible option if a backfill isn't possible.

   What you must not do is leave it first-come-first-served and let the race resolve it.
4. **Disclose before you unpause**, and tell holders the exact haircut. Silence here turns
   an integration bug into a much worse problem, because the information asymmetry is
   itself the thing that decides who loses money.

### 3. Test that would have caught it

An invariant test asserting `sum(stakedBalance) == token.balanceOf(pool)` against a mock
fee-on-transfer token, plus a pinned mainnet-fork test against real TKN. Fee-on-transfer
is on the standard pre-deployment checklist for any contract that custodies an arbitrary
ERC-20 — alongside rebasing, missing return values, and non-standard decimals.
