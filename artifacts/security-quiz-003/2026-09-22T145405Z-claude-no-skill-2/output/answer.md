# The missing 25,000 TKN: fee-on-transfer token vs. fixed-amount accounting

## Short version

TKN is a **fee-on-transfer (or transfer-burn) token with a 2% fee**. The pool
credits `stakedBalance[msg.sender] += amount` — the amount the user *asked* to
transfer — but the pool only ever *received* `amount * 0.98`. Every stake
mints 2% of phantom liability. Nothing was stolen from the contract; the
tokens never arrived in the first place, and the contract's ledger has been
lying by 2% of every deposit since block one.

## Why that is the answer and not something else

The numbers are over-determined — one parameter (2%) has to explain three
independent observations, and it does, exactly:

**1. The pool balance.**

```
received from stakers : 1,250,000 * 0.98 = 1,225,000
sent to unstakers     :   250,000 (debited in full from the pool)
expected balance      : 1,225,000 - 250,000 =   975,000
observed balance      :                         975,000   ✓
```

**2. The ledger.** `stakedBalance` sums to 1,250,000 - 250,000 = 1,000,000,
which is what you see. The ledger is internally consistent; it is consistent
with a reality that does not exist.

**3. The single user.** They staked 10,000: the pool received 9,800 but wrote
down 10,000. They unstaked 10,000: the pool was debited the full 10,000 and
the token delivered them 9,800 after its own fee. The fee is charged on the
recipient side both ways, which is the ordinary fee-on-transfer pattern
(`_balances[from] -= amount; _balances[to] += amount - fee;`). So the pool
overcounts on the way in *and* pays out at face value on the way out — the
inbound half is the accounting bug; the outbound 200 is just the token's fee
landing on the user, which is expected and unavoidable.

The exact 2% fit is what rules out the other candidates:

- **Rewards / admin drain** — there is no such code, and a drain would not
  scale linearly with cumulative deposits.
- **Unchecked return value.** `transferFrom` is called without checking the
  `bool`, so a token that returns `false` instead of reverting would credit
  users for 0 tokens received. That is a real latent bug (fix it with
  `SafeERC20`), but it would produce a 100% shortfall on the affected
  deposits, not a uniform 2%.
- **Rebase / supply change** — excluded by the premise, and would not leave
  the per-user 10,000 → 9,800 fingerprint.
- **Reentrancy** — `stake` credits after the external call and `unstake`
  debits before it, so both are already in the safe order. A reentrancy drain
  would not be proportional to volume either.

Confirm on-chain in five minutes before acting: read TKN's `transfer` /
`_transfer` source for a fee/burn branch, and check the fee recipient's
balance — it should hold roughly **30,000 TKN** attributable to this pool
(25,000 from the 1,250,000 staked, 5,000 from the 250,000 unstaked). Also do a
`balanceOf` delta around a 1 TKN test transfer, and check whether the fee rate
is owner-settable — many such tokens can change it, which matters for the fix.

## Why the shortfall grows

Deficit = 2% × cumulative amount ever staked. It is monotonically
non-decreasing and rises with every new deposit; unstaking does not shrink it,
because the pool is debited the full recorded amount on the way out. Right now
liabilities are 1,000,000 against 975,000 of assets — 97.5% collateralized.

The failure mode is **first-come-first-served**: early unstakers were paid in
full out of later stakers' principal, and the last ~25,000 TKN of claims are
unbacked. That is why the reverts started only recently and why they will
spread. It is a bank run with a guaranteed loser, and every hour the pool
stays open in this state, new depositors are funding exits for people who got
there first. **Disable staking in the UI now**, before anything else.

## The fix

### 1. Credit what actually arrived (measure, don't assume)

```solidity
using SafeERC20 for IERC20;

function stake(uint256 amount) external nonReentrant {
    uint256 before = token.balanceOf(address(this));
    token.safeTransferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - before;
    require(received > 0, "nothing received");
    stakedBalance[msg.sender] += received;
    totalStaked += received;
    emit Staked(msg.sender, amount, received);
}
```

Measure the delta; do not hardcode `amount * 98 / 100`. If the token's fee is
owner-settable, a hardcoded rate re-creates the same bug the next time it
changes.

`unstake` is already correct once the ledger is honest: debit `amount`,
`safeTransfer(amount)`, and the user receives `amount` minus the token's fee.
That haircut belongs to the user and the token, not to the pool. Say so
explicitly in the UI — show "you will receive ~X after the token's 2% fee" —
because the 10,000 → 9,800 surprise is itself a support problem.

Two things to be aware of with the delta pattern: it is only safe under
`nonReentrant` (an ERC-777-style token with receive hooks can otherwise make
one deposit's delta include another's), and it silently absorbs any direct
donation that lands mid-transaction. Both are acceptable here; the
alternative, a share-based pool (`shares = amount * totalShares /
totalAssets`), also fixes the fee problem and additionally handles rewards and
airdrops — worth choosing now if rewards are on the roadmap, since you are
redeploying anyway.

Whatever you ship, gate deposits on a token allowlist or reject fee tokens
outright if the pool is only ever meant to hold well-behaved ERC-20s. The
cheapest fix for a single-token pool is often "we verified TKN takes a fee and
we account for it," not "we support all tokens."

### 2. Make the stuck stakers whole — by donating to the *existing* contract

The 25,000 TKN is not recoverable. It is sitting in the token's fee wallet,
was never owned by the pool, and there is no admin function to claw anything
back. Someone has to eat it, and the only fair answers are "the treasury" or
"everyone pro-rata." Given the size, cover it.

The elegant part: the current contract needs **no migration to become
solvent**. Its ledger is fixed-amount, so a plain `transfer` of TKN to the
pool address raises assets without touching any balance — a donation works.

Account for the fee on the donation itself:

```
need: 975,000 + 0.98 * D >= 1,000,000
      D >= 25,510.21 TKN
```

Send **~25,600 TKN** from the treasury (a little slack for rounding; if the
treasury address is fee-exempt, 25,000 is exact). Every staker can then
unstake their full recorded balance, and each will receive 98% in hand — the
token's own exit fee, which they would have paid regardless.

Do it in this order:

1. Disable staking in the UI immediately. The contract has no pause function,
   so this is the only brake you have, and it is off-chain — assume some
   deposits still land.
2. Donate the ~25,600 TKN. This unblocks the reverting unstakers within one
   transaction and stops the run.
3. Deploy V2 with delta-based (or share-based) accounting and `SafeERC20`,
   point the UI at it, and let users unstake from V1 and stake into V2 at
   their own pace. Leave V1 funded and open-ended; do not force a deadline.
4. Publish the numbers. Some users have already unstaked and silently received
   2% less than the UI promised; they are owed an explanation whether or not
   you compensate the fee.

If the treasury genuinely cannot fund the gap, the fallback is to migrate to
share-based accounting and socialize the loss: every staker redeems
`shares / totalShares * actualBalance` and takes a uniform ~2.5% haircut
instead of the last 2.5% of users losing everything. That requires users to
exit V1 first-come-first-served to fund V2, which is exactly the race you are
trying to stop — so it is strictly worse than paying, and only worth
considering if paying is impossible.

### 3. One more note on the migration path

Because V1 has no admin withdrawal, tokens can only leave it through
`unstake`. Any migration therefore runs *through* the users, and each hop
costs them another 2% in token fees (V1 → wallet → V2). If you want stakers to
end up in V2 whole, budget roughly another 2% of migrated principal, or give
V2 a one-time credit mechanism that mints V2 balances from a V1 snapshot and
is funded in bulk from the treasury — one transfer, one fee, instead of one
per user.
