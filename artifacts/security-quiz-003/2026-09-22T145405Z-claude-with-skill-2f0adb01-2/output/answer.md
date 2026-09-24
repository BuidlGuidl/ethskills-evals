# Where the 25,000 TKN Went

## Short answer

TKN is a **fee-on-transfer (deflationary) token** — roughly **2% is skimmed on every
transfer**, in both directions. The pool credits `stakedBalance[msg.sender] += amount`
using the amount the *user asked to send*, not the amount the *pool actually received*.
Every stake therefore over-credits the staker by 2%, and the internal ledger drifts
above the real balance by 2% of every deposit, forever.

Nothing was stolen by an attacker and nothing leaked out of the contract. The
contract's books are simply lying.

## The numbers prove it exactly

Let `f = 2%` be the transfer fee.

**Actual token balance** (what the ERC-20 contract says the pool owns):

```
received on stake   = 1,250,000 × (1 − 0.02) = 1,225,000
sent on unstake     =   250,000              =   250,000   (debited in full from the pool;
                                                            the *recipient* got 245,000)
balance             = 1,225,000 − 250,000    =   975,000   ✓ matches observed
```

**Internal ledger** (what `stakedBalance` sums to):

```
credited on stake   = 1,250,000
debited on unstake  =   250,000
sum of balances     = 1,000,000                            ✓ matches observed
```

**Shortfall = 1,000,000 − 975,000 = 25,000 = exactly 2% of the 1,250,000 ever staked.**

That the deficit equals 2% of *cumulative deposits* — not of current deposits, not of
withdrawals — is the fingerprint. It rules out every other candidate: a rounding bug
would scale with the number of operations, not the volume; a rewards leak or a hidden
withdrawal would not be an exact percentage of deposits; a rebase or supply change is
excluded by the premise; and there is no admin path out of the contract. The missing
25,000 TKN is sitting in the token's fee-collector address (or was burned, if the fee
is a burn) — it never reached the pool in the first place.

The single-user report closes the case on the other direction: staked 10,000, UI showed
10,000 (the over-credit), unstaked 10,000, wallet received 9,800. The pool really did
send 10,000 and really was debited 10,000; the token took 200 in flight.

## Why the shortfall grows

Look at how each operation moves the gap `G = Σ stakedBalance − token.balanceOf(pool)`:

- **stake(x):** ledger `+x`, balance `+0.98x` → **G grows by `0.02x`**
- **unstake(x):** ledger `−x`, balance `−x` → **G unchanged**

So the deficit is a monotonically increasing function of cumulative deposits. It can
never shrink on its own. Every new staker who deposits makes the hole *larger* in
absolute terms while believing they are funding their own position. The pool is, structurally,
a slow-motion bank run: new deposits subsidise old withdrawals, and the deficit ratchets.

## Why early unstakers were paid and current ones revert

`stakedBalance` is a per-user claim, but the tokens are a single shared pot. There is no
per-user segregation. The pot backs only 97.5% of outstanding claims
(975,000 / 1,000,000), so withdrawals are **first-come, first-served** and the last
25,000 TKN of claims is simply unbacked. Early unstakers were paid in full out of
everyone else's principal. As the pot drains toward zero relative to remaining claims,
`token.transfer` starts failing with the token's insufficient-balance error — and it
will keep failing for whoever is last in line.

Note this also means the current failure mode is **not fair**. Anyone who unstakes today
is still taking 100% of their notional out of a pot that can only cover 97.5% of claims,
pushing the loss onto whoever moves slowest. Left alone, the people who lose everything
are the ones who weren't watching.

## The fix

### 1. Credit what actually arrived — measure the balance delta

This is the core change. Never trust the `amount` argument for a token you don't fully
control.

```solidity
// ❌ BROKEN — credits what the user *asked* to send
function stake(uint256 amount) external {
    token.transferFrom(msg.sender, address(this), amount);
    stakedBalance[msg.sender] += amount;
}

// ✅ CORRECT — credits what the pool *actually received*
function stake(uint256 amount) external nonReentrant {
    require(amount > 0, "Zero amount");

    uint256 balanceBefore = token.balanceOf(address(this));
    token.safeTransferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - balanceBefore;

    require(received > 0, "Nothing received");

    stakedBalance[msg.sender] += received;
    totalStaked += received;

    emit Staked(msg.sender, amount, received);
}
```

With this, staking 10,000 TKN credits 9,800 — which is the truth, and what the UI must
display. The ledger can then never exceed the real balance.

Two supporting points:
- `safeTransferFrom` / `safeTransfer` (OpenZeppelin `SafeERC20`) instead of raw calls, so
  a non-standard token that returns no `bool` (or silently returns `false`) can't fail
  open.
- `nonReentrant` plus strict checks-effects-interactions. The existing `unstake` already
  decrements before transferring, which is correct — keep that ordering, and add the
  guard as a safety net since the token contract is an external, fee-taking callee.

On the way out, the staker receives `amount × 0.98` and the pool is debited `amount`.
That is unavoidable with this token and does **not** break solvency — both sides of the
book move by the same `amount`. It must be disclosed in the UI: "you will receive
approximately X after the token's 2% transfer fee."

### 2. Sanity-check invariant

Add an invariant test and an onchain assertion so this class of bug can't come back:

```solidity
// Must always hold
assert(totalStaked <= token.balanceOf(address(this)));
```

Fuzz `stake`/`unstake` sequences against a mock fee-on-transfer token in Foundry
(`forge test --fuzz-runs 10000`). The original contract fails this invariant on the
very first stake.

### 3. What to do about the stakers who are stuck right now

The deployed contract has no upgrade path and no admin function, so the existing
`stakedBalance` mapping cannot be corrected in place. **Stop the bleeding first, then
choose how to absorb the 25,000.**

**Immediately:**
1. Disable staking in the UI and publicly announce it. Every new deposit into the live
   contract enlarges the deficit by 2% and makes the eventual haircut worse for
   everybody. If there is any pause capability on the frontend or router, use it.
2. Publish the snapshot: block number, per-address `stakedBalance`, pool balance,
   and the 97.5% coverage ratio. Tell people plainly that withdrawals are currently
   first-come-first-served and that this is being replaced with a fair mechanism —
   otherwise the announcement itself triggers the run.

**Then, to make stakers whole — in order of preference:**

**Option A — top up the deficit (preferred).** The 25,000 TKN is not destroyed; it is in
the token's fee-collector wallet. If your team controls TKN, or has any relationship with
whoever does, recover or replace the 25,000 TKN from treasury and send it to the
settlement contract. Coverage returns to 100% and nobody takes a loss. This is the only
outcome where users are actually made whole, and 25,000 TKN is a cheap price for it.
Budget an extra ~2% on top to cover the fee on the top-up transfer itself.

**Option B — pro-rata settlement (fair fallback).** If the deficit can't be funded,
stop paying 100% to whoever is fastest and socialise the loss evenly. Deploy a
settlement contract seeded with the snapshot and the recovered pool balance, paying:

```solidity
// coverage = poolBalance at snapshot, totalClaims = Σ stakedBalance at snapshot
uint256 payout = (claim[msg.sender] * coverage) / totalClaims;   // multiply before divide
```

Every staker gets 97.5% of their recorded balance (and receives ~95.6% in their wallet
after the token's exit fee) instead of a lottery between 100% and 0%. Note the problem:
the old contract has no admin withdrawal, so the pool's remaining tokens can only leave
through `unstake`. You will need a coordinated migration — each user calls `unstake` for
a bounded amount and deposits into V2, or you accept that the residual is claimed
through the old contract in whatever order arrives and compensate the shortfall
separately. **Design the migration so the recorded claim, not the race, determines the
final split.**

**Do not** relaunch on the same contract. Deploy V2 with the balance-delta accounting
above, re-verify the source on the block explorer, and run Slither plus the invariant
fuzz suite before it takes a single deposit.

### 4. The generalisable lesson

For any contract that custodies a token it does not itself control:

- **Measure received amounts via `balanceOf` delta.** Fee-on-transfer tokens are the
  common case; this also covers tokens that add a fee later via an upgrade.
- **Reject or wrap rebasing tokens** (stETH → wstETH). A balance that moves without a
  transfer breaks internal accounting the same way.
- **Assert your solvency invariant in tests.** `Σ internal claims ≤ actual balance`, at
  all times, under fuzzed operation orders. This single assertion would have caught the
  bug on day zero.
- **Never let the ledger be authoritative over the token contract.** The ERC-20's
  `balanceOf` is the ground truth; your mapping is a derived view of it and must be
  derived from what actually happened.
