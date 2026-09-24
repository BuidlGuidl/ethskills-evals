# The missing 25,000 TKN: fee-on-transfer accounting

## Short version

TKN is a **fee-on-transfer (deflationary) token** that skims ~2% off every
transfer. The pool credits `stakedBalance[msg.sender] += amount` — the amount
the user *asked* to send — but only ever receives `amount * 98%`. Every stake
therefore writes a liability that is 2% larger than the asset backing it. The
missing 25,000 TKN was never in the pool: it went to the token's fee recipient
(burn address / treasury / LP, whatever TKN does with its tax) at the moment of
each `transferFrom`.

The pool is not leaking funds. It is **mis-recording deposits**, and it has been
insolvent since roughly block one.

## Why the numbers say exactly this

Assume a flat fee `f` taken out of the transferred amount, charged on both
directions (the user's 10,000 → 9,800 round trip shows the fee applies on the
way out too).

- Gross staked, as credited to `stakedBalance`: 1,250,000
- Actually received by the pool: `1,250,000 × (1 − f)`
- Unstaked: the pool sends the full nominal 250,000 (its balance drops by the
  full 250,000); the unstakers receive `250,000 × (1 − f)`

Solve for the observed pool balance:

```
1,250,000 × (1 − f) − 250,000 = 975,000
1,250,000 × (1 − f)           = 1,225,000
(1 − f)                       = 0.98        →  f = 2%
```

Cross-check against the one user we have detail on: staked 10,000, pool
received 9,800 but credited 10,000; unstaked 10,000, pool sent 10,000, wallet
received 9,800. Both legs are consistent with a 2% transfer tax. Also note the
deficit is exactly `2% × 1,250,000 = 25,000` — 2% of *gross cumulative
inflow*, which is the signature of this bug and nothing else. No mint, no
rebase, no admin drain, no reentrancy is needed to explain it, and the stated
facts rule those out anyway.

## Why the shortfall gets worse

Two separate effects:

1. **The absolute gap only grows.** Each new stake of `X` adds `X` to
   liabilities but only `0.98X` to assets — the hole grows by `0.02X`. An
   unstake of `X` removes `X` from liabilities *and* `X` from the pool's
   balance, so it leaves the gap unchanged. The gap is a monotonically
   increasing function of gross deposits: `deficit = 0.02 × cumulativeStaked`.
   It can never shrink on its own.

2. **The coverage ratio degrades faster than the gap grows.** Today:
   `975,000 / 1,000,000 = 97.5%` backed. Because unstakes hold the gap constant
   while shrinking the liability base, every successful full-value withdrawal
   pushes the *remaining* stakers' coverage down. It is a classic
   first-come-first-served bank run: the early unstakers were paid 100% of
   their nominal balance out of everyone else's principal, which is why they
   went through cleanly and why the tail is now reverting with the token's
   insufficient-balance error. The last ~25,000 TKN of recorded balances has
   no asset behind it at all.

So: the early unstakers did not steal anything, but they were over-paid
relative to a solvent pro-rata share, and the loss has been concentrated onto
whoever is slowest to exit.

## The code change

Never trust the requested amount. Credit the **measured balance delta**, and
track the pool's own accounting in a state variable rather than reading
`balanceOf` at use time.

```solidity
using SafeERC20 for IERC20;

uint256 public totalStaked;                       // internal accounting, not balanceOf
mapping(address => uint256) public stakedBalance;

function stake(uint256 amount) external nonReentrant {
    uint256 before   = token.balanceOf(address(this));
    token.safeTransferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - before;   // what actually arrived

    require(received > 0, "nothing received");
    stakedBalance[msg.sender] += received;        // credit what arrived, not what was asked
    totalStaked               += received;
    emit Staked(msg.sender, amount, received);    // log both so the UI can show the fee
}

function unstake(uint256 amount) external nonReentrant {
    stakedBalance[msg.sender] -= amount;          // checks-effects-interactions preserved
    totalStaked               -= amount;
    token.safeTransfer(msg.sender, amount);       // user eats the exit fee; that's TKN's rule
}
```

Notes on this shape:

- `stakedBalance` now means "TKN the pool actually holds for you". The staker
  still pays TKN's 2% on the way in and 2% on the way out — that is the token's
  behaviour and the pool cannot refund it — but the pool no longer *promises*
  TKN it doesn't have. The UI must show the credited (post-fee) figure, which is
  why the event carries both numbers; showing "10,000 staked" after a 9,800
  receipt is what turned a token quirk into a solvency bug.
- Use `totalStaked`, never `token.balanceOf(address(this))`, as the denominator
  once rewards logic lands. Raw `balanceOf` lets anyone inflate share prices by
  donating tokens, and it re-imports the same class of bug from the other side.
- `SafeERC20` matters independently: a non-standard token that returns no
  `bool` would make the raw `transfer`/`transferFrom` calls silently succeed.
- If you would rather not support this token class at all, the alternative
  one-liner is `require(received == amount, "fee-on-transfer not supported")` —
  a fine policy for a fresh deployment, but useless here, since TKN *is* the
  pool's token.
- Balance-delta accounting is correct for fee-on-transfer but still not safe
  for *rebasing* tokens, where balances move between calls. Confirm TKN does
  not rebase (the brief says it doesn't) before relying on it.

## What happens to the stakers who cannot unstake

The change above fixes future accounting. It does **not** conjure the 25,000
TKN that is already gone, and the live contract has no admin function and no
upgrade path, so nothing can be fixed in place. Do these in order:

1. **Stop the bleeding now.** Disable `stake` in the front-end immediately and
   announce it. Every additional deposit adds 2% of itself to the hole and
   makes a new victim. If the contract has no pause, the front-end and a public
   warning are the only levers — say so plainly rather than letting deposits
   trickle in.

2. **Top the pool up — this is the clean fix.** The shortfall is exactly
   25,000 TKN and the pool accepts plain transfers, so the team (or the
   treasury, or the fee recipient that received this money in the first place)
   can simply `transfer` 25,000 TKN to the pool address and every current
   staker can then unstake their full recorded balance. Budget slightly more
   than 25,000: if the top-up transfer is itself taxed, you need to send
   `25,000 / 0.98 ≈ 25,511` for 25,000 to land. This is the only remedy that
   makes everyone whole, and the 25,000 is genuinely recoverable — it sits with
   TKN's fee recipient. Ask the token team for the refund and, at the same
   time, ask them to **fee-exempt the pool address** (most tax tokens have a
   `setExcludedFromFee`-style switch); that stops the leak at the source for
   both directions and gives stakers a clean round trip.

3. **If no top-up is possible, socialise the loss pro-rata — don't leave it
   first-come-first-served.** Coverage is 97.5%, so every remaining staker is
   entitled to `0.975 × stakedBalance`. The deployed contract cannot enforce
   that, so: deploy the corrected pool, publish a snapshot of `stakedBalance`
   at a fixed block, and have the front-end cap each user's `unstake` call at
   their 97.5% share. That is a social constraint, not a cryptographic one —
   anyone can call the old contract directly and take 100% — which is another
   reason the top-up in (2) is the better answer. Be explicit with users about
   this if you go this route.

4. **Migrate and re-audit.** Move to the corrected contract, keep the old one
   dead (deposits off, withdrawals open until drained), and before rewards
   logic ships, re-check every place that assumes "amount sent == amount
   received" — reward funding, any future `sweep`, and anything that would read
   `balanceOf(address(this))` as the share denominator.

5. **Reconcile as policy.** Add an invariant check in tests and a monitor in
   production: `token.balanceOf(pool) >= totalStaked` must hold after every
   transaction. Test it against a mock 2%-fee ERC-20, not just a vanilla one —
   a standard-token test suite passes this bug cleanly, which is precisely how
   it reached mainnet.
