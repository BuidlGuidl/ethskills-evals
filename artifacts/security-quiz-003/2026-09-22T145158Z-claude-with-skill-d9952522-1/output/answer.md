# The 25,000 TKN shortfall: TKN is a fee-on-transfer token

## Short answer

Nothing left the pool improperly. The pool never *received* everything it credited.
TKN takes a ~2% fee on every transfer. `stake()` credits `amount` — the number the
user asked to send — while the contract only ever received `0.98 * amount`. The gap
is 2% of every deposit, and it accumulates forever because it is created on deposit,
not on withdrawal.

The pool is insolvent by exactly that accumulated fee. Payouts are first-come,
first-served against a pool that is short, so the users unstaking today are eating
the losses created by every deposit since launch.

## Reconciling the books

The one concrete data point pins the fee rate:

- user sends 10,000 → UI shows 10,000 staked → they unstake 10,000 → wallet receives 9,800.

9,800 / 10,000 = 0.98, so the fee is 2% and it is charged on the **outbound**
`transfer` as well. Now apply 2% to both legs of the pool's history:

| flow | contract-side credit | actual TKN movement |
|---|---|---|
| cumulative `stake` (1,250,000 requested) | `stakedBalance += 1,250,000` | pool **received** 0.98 × 1,250,000 = **1,225,000** |
| cumulative `unstake` (250,000 requested) | `stakedBalance -= 250,000` | pool **sent** 250,000 (recipients got 245,000; the 5,000 fee came out of *their* proceeds, not the pool's) |

Pool balance = 1,225,000 − 250,000 = **975,000 TKN**. That is exactly the balance you
observe.

Sum of `stakedBalance` = 1,250,000 − 250,000 = **1,000,000 TKN** of claims.

Shortfall = 1,000,000 − 975,000 = **25,000 TKN = 2% × 1,250,000 cumulative deposits.**

Every number in the report is explained with no missing transfer, no admin drain, no
rebase, and no rounding mystery. The books close under the fee-on-transfer hypothesis
and under no other one.

Two details worth naming explicitly, because they drive the fix:

- **Withdrawals are accounting-neutral.** `unstake(X)` debits X and calls
  `transfer(user, X)`, which reduces the pool balance by exactly X. Claims and backing
  fall together. The exit fee is paid by the exiting user out of their own X. So
  unstaking does *not* make the hole bigger — it only decides who is left holding it.
- **Deposits make the hole bigger.** Each new `stake(A)` adds A of claims and only
  0.98A of backing: the shortfall grows by 0.02A. **Every new staker today is
  subsidising the exit of an earlier staker.** That is why the shortfall grows and why
  it will keep growing as long as staking is open.

Only inbound fees can be ruled in or out independently: if the fee applied solely to
outbound `transfer`, the balance would be 1,250,000 − 250,000 = 1,000,000 and there
would be no shortfall at all. The 975,000 proves the fee hits `transferFrom` too.

## Why the early unstakers were fine and today's revert

There is no per-user segregation of funds. `stakedBalance` is a claim ledger and the
contract balance is a single commingled pot. With 1,000,000 of claims against 975,000
of assets, the first 975,000 TKN of withdrawal requests succeed — paid partly out of
other users' principal — and the last 25,000 revert inside TKN's own
insufficient-balance check. That is the transition you are watching happen live.

This is a bank run in slow motion, and it is now a race. The moment this is public,
every remaining staker is rationally incentivised to exit first, and the ~25,000 TKN
of losses lands on whoever is slowest. Treat the ordering of the next steps as
time-sensitive.

## What to do right now (before any code)

1. **Stop new deposits.** Take `stake` out of the UI/front-end immediately and
   announce it. If there is no `pause()` in the contract (your description implies
   there is not), the front-end and public comms are your only lever, but they cover
   the great majority of real deposit flow. Every deposit you allow through adds 2% of
   itself to the hole and puts that loss on someone else.
2. **Decide who eats the 25,000 before the race resolves it.** The default — "whoever
   unstakes last loses everything unbacked" — is the worst possible outcome and also
   the one you get by doing nothing.

## The fix, in two parts

### Part 1 — make the remaining stakers whole: top the pool up

The contract has no admin function and no rescue path, but it does not need one. The
accounting lives in the `stakedBalance` mapping and is completely independent of how
the contract's balance got there. `unstake` just calls `token.transfer`. **A plain
transfer of TKN to the pool address makes those tokens spendable by unstakers, with no
contract change and no privileged call.**

You need **25,000 TKN to land** in the pool. Because the fee hits outbound transfers,
sending 25,000 delivers only 24,500. Send the grossed-up amount:

```
25,000 / 0.98 = 25,510.2040...  →  send 25,510.21 TKN (round up; verify balanceOf after)
```

Better, if the token's owner will do it: ask for the pool address (and your treasury
address) to be **fee-exempt/whitelisted**, then transfer a clean 25,000. Many
fee-on-transfer tokens have exactly such a list, and exempting the pool also stops the
bleeding on any future deposit. Confirm with `balanceOf(pool)` on-chain afterwards
rather than trusting the transfer amount — that habit is the whole lesson here.

This restores solvency for today's ledger: 1,000,000 of backing against 1,000,000 of
claims, and the currently-reverting unstakes go through. Note that exiting users will
still receive 98% of their balance in their wallet — that is TKN's exit fee, charged
to them by the token, and it is not something the pool can or should absorb. Say so
plainly in the UI.

If the treasury cannot or will not fund 25,000 TKN, the honest alternative is to
**socialise the loss pro rata** — every staker redeems ~97.5% of their ledger balance
— which the current contract cannot express and which therefore requires the
migration in Part 2. Pro-rata socialisation is fair; first-come-first-served is not.
Do not let silence choose the unfair one.

### Part 2 — fix the code: credit the measured balance delta, never the requested amount

The bug is one line. `stake` must credit what actually arrived:

```solidity
using SafeERC20 for IERC20;

function stake(uint256 amount) external nonReentrant {
    uint256 balBefore = token.balanceOf(address(this));
    token.safeTransferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - balBefore;   // <-- the fix
    require(received > 0, "ZeroReceived");

    stakedBalance[msg.sender] += received;
    totalStaked += received;
    emit Staked(msg.sender, amount, received);
}

function unstake(uint256 amount) external nonReentrant {
    stakedBalance[msg.sender] -= amount;     // effects before interaction (already correct)
    totalStaked -= amount;
    token.safeTransfer(msg.sender, amount);  // user pays the token's exit fee out of `amount`
    emit Unstaked(msg.sender, amount);
}
```

Points that matter:

- **Measure, don't assume.** Do not hardcode `amount * 98 / 100`. Fee rates on these
  tokens are frequently owner-settable, tiered, or per-address exempt; a hardcoded
  rate re-creates the same class of bug the next time someone calls `setFee`. The
  balance delta is correct for a 0% fee, a 2% fee, and any future fee.
- **`nonReentrant` is load-bearing here**, not decoration. A balance-delta measurement
  is only sound if nothing else can move the contract's balance between the two reads.
  A token with a transfer hook (ERC-777-style, and several fee tokens have callbacks)
  could re-enter `stake`/`unstake` mid-measurement and cause one deposit to be credited
  with another's tokens. Use OpenZeppelin `ReentrancyGuard`.
- **`SafeERC20`** because a token that is willing to silently take 2% is exactly the
  kind of token that also returns a non-standard/missing boolean.
- **The `unstake` side is already correct** and should stay as-is: it moves claims and
  assets by the same number, and the fee is correctly borne by the person leaving.
- **Emit both `amount` and `received`.** The UI must display the credited amount
  (`received`), not what the user typed. That single display bug is what made this
  invisible for three weeks.

The current contract is immutable as described, so this is a **V2 deployment plus a
migration**, not a patch. If it is in fact behind a proxy, upgrade it — but run the
storage-layout compatibility check first, and put the upgrade behind the multisig, not
an EOA.

### Worth doing in V2 while you are redeploying: share-based accounting

For this pool today, "credit what you received" is sufficient. But if you will ever
add the rewards logic you mentioned, switch the ledger from absolute balances to
shares now:

```
shares_minted = (totalShares == 0) ? received : received * totalShares / poolBalanceBefore
redeemable    = shares * token.balanceOf(address(this)) / totalShares
```

This makes any surplus (rewards) or deficit (a fee you missed, a future token quirk)
distribute *pro rata across all stakers automatically*, instead of turning into a
first-come-first-served race the way it did here. Two caveats if you go this route:
seed the pool against the first-depositor / donation inflation attack with virtual
assets and shares (or simply start from OpenZeppelin `ERC4626`, which handles this and
the rounding direction for you), and note that balance-delta crediting still does not
cover a *rebasing* token — share accounting does.

### Migration mechanics

1. Snapshot `stakedBalance` for every staker at a fixed block; publish the list.
2. Deploy V2 with the fixed `stake` (ideally share-based).
3. Fund V2 with the full snapshot total — the 975,000 currently in V1 plus the ~25,000
   top-up (grossed up for the transfer fee on each hop, or with V1/V2/treasury made
   fee-exempt).
4. Credit V1 balances into V2 directly from the snapshot. Do **not** make users
   withdraw from V1 and re-stake into V2 — that would charge them the 2% fee twice and
   re-open the exact hole you are closing.
5. Leave V1 drained and abandoned, with the front-end pointed at V2.

## Pre-deployment checklist for V2

- Fork test pinned to mainnet against the **real TKN contract**, not a mock. A clean
  `MockERC20` is precisely why this shipped: it cannot reproduce a fee.
- Explicit test: stake 10,000 → assert `stakedBalance == 9,800` and
  `balanceOf(pool)` increased by 9,800.
- Invariant test: `sum(stakedBalance) <= token.balanceOf(address(this))` — as a strict,
  always-on invariant across arbitrary stake/unstake sequences. This one line is the
  solvency property, and it would have failed on transaction one.
- Test after the token owner changes the fee rate mid-life, including to 0%.
- Test zero-amount and dust deposits, direct donations to the pool, and reentrancy via
  a hostile token hook.
- Static analysis clean; V2 authority on the multisig.
