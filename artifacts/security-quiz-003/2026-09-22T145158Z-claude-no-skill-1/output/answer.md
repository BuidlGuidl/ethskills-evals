# The missing 25,000 TKN: fee-on-transfer token vs. nominal-amount accounting

## Short answer

Nothing was stolen and nothing left the pool improperly. **TKN takes a 2% fee on
every transfer**, and the pool credits `stakedBalance` with the *requested*
amount instead of the amount it *actually received*. Every `stake(amount)` mints
2% of `amount` in phantom claims. `unstake` then pays those phantom claims out of
other users' principal, first-come-first-served, until the pool runs dry — which
is the revert you are now seeing.

## Deriving it from your numbers

Let `f` be the token's transfer fee rate. The pool's real balance is:

```
balance = (1 - f) * cumulative_staked  -  cumulative_unstaked_nominal
```

The second term is *nominal*, not net: when the pool calls
`token.transfer(user, 10_000)`, the pool's balance drops by the full 10,000; the
fee is taken out of the recipient's side, so the unstaker receives 9,800.

Plug in `f = 2%`:

```
0.98 * 1,250,000  -  250,000  =  1,225,000 - 250,000  =  975,000  ✓
```

That is exactly the on-chain balance you observe. And the deficit is exactly:

```
sum(stakedBalance) - balance = 1,000,000 - 975,000 = 25,000
                             = 2% * 1,250,000 = f * cumulative_staked  ✓
```

The single-user report closes the loop and proves the fee applies in **both**
directions:

| Step | Recorded | Token movement |
|---|---|---|
| `stake(10_000)` | `stakedBalance = 10_000` | user −10,000, pool **+9,800**, fee recipient +200 |
| `unstake(10_000)` | `stakedBalance = 0` | pool −10,000, user **+9,800**, fee recipient +200 |

The UI showed 10,000 because it reads `stakedBalance`, which is the lie. The
9,800 received is the outbound fee (the *user's* own exit cost, legitimate);
the 200 lost on the way in is the pool's phantom credit, and that is the leak.

### Ruling out the alternatives

* **Admin drain / rug** — there is no admin withdrawal function and the pool has
  only ever sent TKN to unstakers. Confirm with `TokenTransfer` logs filtered on
  `from == pool`: you should see only unstake payouts plus a 2% fee transfer
  alongside each one.
* **Rebase / supply change** — stated as not having happened, and a rebase would
  not produce a deficit that is *exactly* 2% of cumulative deposits.
* **Reentrancy / double-spend** — `unstake` decrements before transferring, so
  even a reentrant token cannot double-withdraw; and the arithmetic above already
  accounts for 100% of the gap with no residual.
* **Rounding** — 25,000 TKN is not rounding.

Verification you can run in one call each: compare
`token.balanceOf(pool)` before/after a 1,000 TKN test stake on a fork — you will
see +980 — and check the token for a `fee`/`tax`/`_taxFee` variable or a
`isExcludedFromFee` whitelist.

## Why the shortfall grows

The deficit is `f * cumulative_staked`. It is **monotonically increasing in
staking volume** and is never repaired by anything:

* every new `stake(amount)` adds `0.02 * amount` of new phantom claims;
* `unstake` leaves the deficit *unchanged* (it removes `amount` from
  `stakedBalance` and `amount` from the balance), so exits do not heal it — they
  merely decide **who** absorbs it.

So this is a bank run with a fixed-size hole. Early unstakers were paid 100% of
their nominal claim out of a pot that was only ever 98% funded; the loss is
concentrated entirely on whoever is last in line. Right now the last 25,000 TKN
of claims is unbacked, and those holders get a hard revert from the token's
insufficient-balance check rather than a pro-rata payout. Unchecked, each new
deposit both grows the hole and hands the new depositor a claim they can only
satisfy by draining someone else.

## The fix

### 1. Stop the bleeding today (no code required)

The live contract has no admin function, no pause, and no upgradeability, so the
only exit path is `unstake()` — you cannot orchestrate an orderly migration out
of it, and you cannot pause the race. Two immediate actions:

**(a) Fund the hole by sending 25,000 TKN directly to the pool address.** Because
`unstake` pays out of the raw token balance and does no internal-balance
bookkeeping, a plain donation transfer instantly makes every current staker whole
and all reverts stop. Note the transfer is itself taxed, so send
`25,000 / 0.98 ≈ 25,511 TKN` (or have the pool whitelisted first — see below).
The 25,000 is not lost value from the project's perspective if the fee recipient
is your own treasury: reclaim it from there, since that is precisely where it
went. This is the fairest outcome — the deficit was created by a contract bug,
not by any staker's behaviour, and it costs ~2% of TVL.

**(b) Stop routing new stakes to V1.** Pull `stake` from the UI, publish the
issue, and point users at V2. Every additional deposit into V1 re-opens the hole
at 2%.

If the treasury genuinely cannot cover 25,000 TKN, the alternative is to
socialise the loss: deploy V2 with a snapshot of `stakedBalance` scaled by
`975,000 / 1,000,000` (a uniform 2.5% haircut) — but this only works for the
balances you can actually migrate, and with no admin exit on V1 you still have to
get the tokens out via a `unstake` race. In practice, option (a) is the only
clean path. Do not let the race continue and call it a resolution: that is a 100%
loss for a handful of arbitrary latecomers instead of a 2.5% loss shared.

### 2. Correct the accounting in V2 — credit what arrived, not what was asked

Measure the balance delta around the transfer. This is correct for
fee-on-transfer, deflationary/burn, and plain ERC-20 tokens alike:

```solidity
using SafeERC20 for IERC20;

mapping(address => uint256) public stakedBalance;
uint256 public totalStaked;

function stake(uint256 amount) external nonReentrant {
    require(amount > 0, "zero");

    uint256 before = token.balanceOf(address(this));
    token.safeTransferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - before;   // <-- the fix

    require(received > 0, "nothing received");
    stakedBalance[msg.sender] += received;
    totalStaked            += received;
}

function unstake(uint256 amount) external nonReentrant {
    stakedBalance[msg.sender] -= amount;   // reverts on underflow (0.8.x)
    totalStaked               -= amount;
    token.safeTransfer(msg.sender, amount); // user bears their own exit fee
}
```

Why each piece matters:

* **`received` from the balance delta** is the whole correction. The invariant
  becomes `totalStaked <= token.balanceOf(address(this))` at all times, restored
  by construction rather than by assumption. Assert it in an invariant test.
* **`nonReentrant`** is required *because* of the delta pattern: a callback token
  (ERC-777, or a tax token with hooks) that re-enters `stake` mid-transfer would
  let the inner call's delta include the outer call's inbound tokens and
  double-credit. Also keep `unstake`'s state change before the transfer (your
  current code already does).
* **`SafeERC20`** — the current code ignores the return value of `transfer` and
  `transferFrom`. TKN reverts, so it did not bite you, but a token that returns
  `false` instead of reverting would make `unstake` silently zero a balance and
  send nothing.
* **Outbound fee stays with the user.** `unstake(10_000)` debiting 10,000 and
  netting the user 9,800 is correct: the exit tax is the unstaker's cost, paid
  from their own tokens, and it does not touch anyone else's principal.

When you add rewards, do **not** use `token.balanceOf(address(this))` as
"total assets" while a same-token reward buffer sits in the contract — track
`totalStaked` and rewards separately, or move to explicit share accounting
(ERC-4626-style, `shares = received * totalShares / totalStaked`) so that any
future shortfall is distributed pro rata instead of first-come-first-served.

### 3. Better yet, remove the fee for the pool

Ask the TKN team to add the pool address to the token's fee-exemption whitelist
(most tax tokens have `isExcludedFromFee` or similar). Then deposits arrive
whole, stakers stop paying 2% each way to use the pool, and the delta accounting
above becomes a no-op safety net rather than the thing holding the books
together. Keep the delta code regardless — the whitelist is a mutable setting on
someone else's contract, and your invariant should not depend on it.

### 4. Guardrails so this class of bug cannot recur

* An invariant/fuzz test asserting `sum(stakedBalance) <= balanceOf(pool)` after
  arbitrary sequences of stake/unstake, run against a mock fee-on-transfer token
  (and a rebasing mock, and a `return false` mock) — not just a vanilla ERC-20.
* A documented token allowlist: a single-token pool should state which token it
  is deployed against and what that token's transfer semantics are.
* An admin-pausable `stake` (pausing deposits only, never withdrawals) so a
  discovered accounting bug can be contained without a public race.
