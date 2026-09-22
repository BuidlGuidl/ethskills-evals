# Susu — onchain savings circle

## 0. Scope note

This repo currently contains only `TASK.md` — there is no contract here. So the
six-week answer in §6 is the answer **for the design below**. If circles are
already deployed from code I can't see, jump to §7: it lists the five properties
to grep the deployed contract for. If any of them is missing, the answer flips
from "yes" to "no" and §7 says what to do about it.

Short version: a circle can be made to run for six weeks with nobody touching
it, but only if **no state transition requires a call from you**. That is a
design constraint, not an ops practice, and it is the constraint that drives
almost every decision below.

---

## 1. Product shape

Twelve members, $100 USDC/month, twelve monthly rounds, fixed payout order set
at start. Round `k` pays member `order[k]` the pot. Miss a payment → you forfeit
your turn, and what you already paid in covers the shortfall you caused.

### 1.1 The accounting, made consistent

The rule as stated ("their earlier contributions cover the shortfall") doesn't
work literally: by the time member D defaults in month 5, D's months 1–4 money
has already been *paid out* to the months 1–4 recipients. There is no pile of
D's money sitting around. This needs fixing before it's code, so here is the
version that balances.

Rules:
- A defaulter stops paying and forfeits their payout slot. Their slot pays out
  to nobody; that round's collection goes to the **forfeit pool**.
- Every round, the recipient is entitled to $1,200. They receive
  `min(1200, what's available)`. Any gap is recorded as a **deficit credit**.
- At the end of the circle, the forfeit pool is distributed to deficit credits,
  pro rata if it doesn't cover them all.

Check that it balances. D defaults in month 5, D's turn was month 9:

| | |
|---|---|
| In, months 1–4 (12 payers × 100) | 4,800 |
| In, months 5–12 (11 payers × 100) | 8,800 |
| **Total in** | **13,600** |
| Out: 11 real recipients × 1,200 | 13,200 |
| **Residual** | **400** = exactly D's four payments |

So D's earlier contributions do cover the shortfall — it just happens through
the forfeit pool and a final settlement, not by magic clawback. The ledger is
exact for any number of defaults at any position.

### 1.2 The timing hole, and the bond

The money balances over the year but not *within* it. If D defaults in month 5
and D's slot was month 9, the contract is $100 short in month 5 and doesn't get
made whole until month 9. Month 5's recipient eats a haircut for four months.

Fix: **each member posts a $100 bond at join**, held for the life of the circle.
Twelve bonds = $1,200 of standing liquidity, enough to fully cover one default's
worth of shortfall in every round without waiting. A defaulter's bond is
forfeited into the forfeit pool; everyone else's is returned at settlement. With
one defaulter, nobody ever sees a haircut. With three or more, haircuts happen
and are trued up at the end — and that is honest behaviour to show in the UI
rather than a bug.

Cost of entry becomes $200 in month 1 ($100 contribution + $100 bond). That is a
real product decision, not a technicality — say it plainly in the invite flow.
A family susu runs on trust; a bond that silently surprises someone is worse
than no bond.

---

## 2. Onchain / offchain boundary

**Onchain** (SusuCircle): member set, payout order, bonds, per-round
contributions, default determination, payouts, forfeit pool, final settlement.
This is all value transfer and permanent commitment — it's the whole point.

**Offchain:** names, avatars, the circle's display name, reminder emails/SMS,
payment history views, "who's behind" dashboards. All derived from events.

Nothing is ranked or scored, so there's no leaderboard to keep out of storage.
The one derived thing worth naming: **"who has defaulted" is never stored as a
flag set by a transaction.** It's a pure function of `contributions[member][k]`
and `block.timestamp`. Nobody has to call `markDefault()`. That single choice is
most of the six-week answer.

Events: `Joined`, `CircleStarted`, `Contributed`, `PayoutClaimed`,
`TurnForfeited`, `Settled`. Indexer reads those; if the indexer is down, no
onchain behaviour changes.

---

## 3. Contracts

**One custom contract: `SusuCircle`.** One deployment per circle. No factory, no
escrow, no router — there's no second trust boundary in this product. USDC is
the only external dependency (native Circle USDC, not bridged).

No factory means **creating a new circle requires a deploy**, which requires
one of you. See §6 — this is a deliberate, named limitation, not an oversight.

### 3.1 State

```solidity
IERC20  immutable USDC;
uint256 constant CONTRIBUTION = 100e6;
uint256 constant BOND         = 100e6;
uint256 constant N            = 12;
uint256 constant ROUND        = 30 days;

address[12] public order;        // payout order, fixed at start
uint64  public startTime;        // 0 until the 12th member joins
mapping(address => bool)    isMember;
mapping(address => uint256) bondPosted;
mapping(address => mapping(uint256 => bool)) paid;   // member => round => paid
mapping(uint256 => bool)    payoutClaimed;           // round => claimed
mapping(address => uint256) deficitCredit;
uint256 public forfeitPool;
```

### 3.2 The two derived functions that carry the design

```solidity
function currentRound() public view returns (uint256) {
    if (startTime == 0) return 0;
    return (block.timestamp - startTime) / ROUND;   // pure clock, no state
}

function hasDefaulted(address m) public view returns (bool) {
    uint256 r = currentRound();
    for (uint256 k = 0; k < r && k < N; k++) if (!paid[m][k]) return true;
    return false;
}
```

`currentRound()` reads a clock. Rounds advance with or without transactions,
with or without us. There is no `advanceRound()` to forget to call.

`hasDefaulted()` is a view over the contribution ledger. Nobody declares a
default; missing a window *is* the default.

### 3.3 Key functions

- `join()` — pulls `BOND`. On the 12th join, sets `startTime = block.timestamp`
  and fixes `order` from the join sequence. **Auto-start: the circle begins
  without anyone calling `start()`.**
- `contribute()` — pulls `CONTRIBUTION` for `currentRound()`. Reverts if the
  caller has already defaulted (you can't buy back in) or already paid.
- `claimPayout(uint256 k)` — callable by `order[k]` once round `k` has closed.
  Pays `min(1200e6, balance available for k)`, records any gap as
  `deficitCredit`. Reverts if the caller has defaulted. If a defaulter never
  calls, their slot's money simply stays and lands in `forfeitPool` at
  settlement — no call is needed to forfeit a turn.
- `settle()` — after round 12 closes, any member pulls their own bond refund
  plus their pro-rata share of `forfeitPool` against `deficitCredit`. Per-member
  pull, not a loop over all twelve, so one blocked address can't wedge the rest.

### 3.4 Deliberate omissions

**No owner. No pause. No upgrade proxy. No admin key at all.** Two people who
are both away for six weeks cannot operate an admin function, and a pause
control you can't reach is strictly worse than no pause control — it converts
"a bug drains one circle" into "every circle is frozen and the money is stuck
until someone gets back to wifi." Immutable and boring is the right trade for
$14,400 of family money. If you later want an emergency exit, the version that
survives your absence is a *member-voted* one (7 of 12 signal
`emergencyDissolve()` → pro-rata refund), never an owner switch.

---

## 4. State transition table

Every function that moves money, who calls it, why they'd bother, and what
happens if nobody does. This table goes in the README verbatim.

| Transition | Caller | Why they pay gas | If nobody calls |
|---|---|---|---|
| `join()` | incoming member | reserves their seat and payout slot | circle never starts; bonds are withdrawable via `abortJoin()` before start |
| circle start | **nobody** — auto on 12th `join()` | n/a | n/a. Cannot stall. |
| round advance | **nobody** — `(now - startTime) / 30 days` | n/a | n/a. Cannot stall. |
| default marking | **nobody** — derived view | n/a | n/a. Cannot stall. |
| `contribute()` | member | not paying forfeits their $1,200 turn *and* their $100 bond — a ~$1,300 penalty for saving $100 | that member is in default at round close; the round still closes on time |
| `claimPayout(k)` | that round's recipient | receives up to $1,200 | funds stay claimable forever, no expiry; later rounds are unaffected |
| turn forfeiture | **nobody** — a defaulter simply can't `claimPayout` | n/a | the unclaimed slot flows to `forfeitPool` at settlement |
| `settle()` | each member, for themselves | recovers own $100 bond + own deficit credit | that member's funds stay claimable forever; other members settle independently |

Every row is either self-serve (the caller is the person getting paid) or
requires no caller at all. **There is no keeper, no cron, and no privileged
address anywhere in the table.** No row says "founder."

That property is the deliverable. Everything else is implementation.

---

## 5. Chain: Base

Base, for reasons specific to a family susu rather than "L2 is cheap":

1. **Native Circle USDC** — real USDC, not a bridged wrapper with its own
   depeg/bridge risk. For a savings product that is the dependency that matters.
2. **Coinbase on/off-ramp lands directly on Base.** Your aunt needs to turn
   dollars into the thing that pays into the circle, and turn her $1,200 back
   into rent money. Every extra bridge hop is a place a non-crypto member
   abandons or loses funds. This is the actual deciding factor.
3. **Smart Wallet / passkeys** — no seed phrase for twelve family members, which
   for a twelve-month commitment is a real retention issue.
4. Fees are low enough that a $100 monthly transfer isn't meaningfully taxed.

Assumption to verify, not remembered: check live Base fees before deploy with
`cast gas-price --rpc-url $BASE_RPC_URL` and price a `contribute()` at current
ETH. I have not measured this here — treat the fee claim as unconfirmed until
that command has been run.

Contract addresses must come from Circle's official Base documentation at deploy
time. Do not copy a USDC address from this document or from memory — a wrong
token address sends twelve people's approvals somewhere they can't be recovered.

---

## 6. The actual question: do running circles survive six weeks?

**Yes — the money mechanics do, by construction. But three things around them
break, and one of them will bite you in week two.**

### What genuinely does not need you

Rounds advance off `block.timestamp`. Contributions are pulled by members.
Payouts are pulled by recipients. Defaults are derived. Settlement is per-member
pull. If both of you lose your laptops on day one, every deployed circle still
reaches month twelve correctly and everyone can withdraw everything they're
owed. Nothing in §4 has you as the caller — that's why.

### What breaks — in order of when it hits you

**1. Reminder notifications (breaks in week 2, hurts the most).**

The contract doesn't care if someone forgets to pay. The *member* cares enormously
— forgetting costs them $1,300. Right now the only thing standing between a
member and that loss is a reminder, and reminders are offchain infrastructure
that someone maintains. If they run on a cron on one of your machines, or on a
free tier that expires, or on an API key that rotates, then during your six weeks
somebody misses a payment they fully intended to make, and the contract
irreversibly and correctly takes their turn and their bond. That is the worst
possible failure: the code is right and a family member is out $1,300.

*What to do:* before you leave, (a) move reminders off any personal machine onto
a hosted scheduler with a payment method that won't lapse, (b) send every member
a calendar invite with the round dates and the direct contract link so the
reminder path doesn't depend on your infrastructure at all, and (c) give each
round a **grace period** — accept a late contribution up to 5 days into the next
round before default latches. The grace window is a one-line change now and
impossible to add later. Do this one first.

**2. The frontend (could break any week).**

If the web app goes down — expired hosting, RPC key rate-limited, domain
auto-renew fails on a dead card, a dependency breaks a rebuild — members have no
way to pay, and the contract keeps counting days toward default. The contract is
fine; the humans are locked out. This turns an ops outage into real financial
loss on a deadline.

*What to do:* **verify the contracts on Basescan before you leave and send every
member the "write contract" URL as the documented fallback.** Verification is
usually treated as a nicety; here it's the liveness path of last resort. Also:
pin the frontend build, put the RPC key on a paid plan, confirm domain auto-renew
against a card that doesn't expire in the next six weeks, and check that the app
doesn't hard-fail when the indexer is unavailable (contributing must work off
direct RPC reads alone).

**3. New circles can't start (breaks on first request).**

One contract per circle, no factory, means creating a circle needs a deploy,
which needs one of you. Existing circles are unaffected, but anyone asking to
start a new circle waits six weeks.

*What to do:* decide which you want. Accept it and tell people "new circles
resume in November" — that's a perfectly fine answer for an MVP and costs you
nothing. Or, if you expect demand, add a minimal `SusuFactory` with a single
`createCircle()` before you go. It's a second contract and a second thing to get
right under time pressure; if you're leaving soon I'd accept the freeze. It is
the cheapest of the three problems.

### Things that would break but don't, because of §3.4

Worth stating explicitly, because these are the usual way "it runs itself"
projects die while their authors are away:

- **No owner/pause.** Nothing can be frozen by a key nobody can reach.
- **No upgradeable proxy.** No pending upgrade to babysit, no admin timelock
  expiring mid-trip.
- **No 2-of-2 multisig.** With exactly two of you, both away, a 2-of-2 is a
  guaranteed outage. If you keep a multisig anywhere in this system for any
  reason, add a trusted third signer before you leave.
- **Payouts are pull, per member.** A USDC blacklist or a member's contract
  wallet reverting on receive affects only that member's claim, and never blocks
  a round or another member's settlement.

### One remaining risk you can't engineer away

Six weeks is ~1.5 rounds. If a member loses their key or their money mid-trip,
there is no recovery path and no one to appeal to. That is true of this design
whether you're away or not — immutability is what makes the rest of the answer
"yes." Just make sure members know it *before* they join, not when it happens.

### The pre-departure checklist

1. Add the 5-day grace period. (Cannot be added after deploy.)
2. Move reminders to hosted infra; send calendar invites as a backup path.
3. Verify contracts on Basescan; send members the fallback write URL.
4. Confirm RPC plan, domain renewal, and frontend pinning survive six weeks.
5. Confirm no multisig in the stack is 2-of-2.
6. Decide and announce: new circles frozen, or ship the factory.
7. Post an "if something goes wrong while we're away" note to every circle,
   including the fallback contract URL and the fact that rounds keep ticking.

---

## 7. If circles are already deployed from code not in this repo

Read the deployed source and check these five. Each has a direct consequence.

| Check | Failure mode if absent | Fix while away |
|---|---|---|
| Is round advance derived from `block.timestamp`, or is there an `advanceRound()`/`closeRound()` someone must call? | Circles stall the first month you're gone. Payouts never unlock. | Can't patch an immutable contract. If a *permissionless* caller exists, hire/arrange a keeper and publish the call so members can self-serve. If it's owner-only, you must delegate the key to a trusted third party before leaving. |
| Is default derived, or set by `markDefault()`? | Defaulters keep their turn or block a round; the ledger goes wrong silently. | Same: needs a caller. Document it and delegate. |
| Is there an owner, pauser, or upgrade admin? | Any incident is unfixable and any paused circle is money-stuck for six weeks. | Add a third signer, or transfer to a 2-of-3 with a trusted third party, before you go. |
| Are payouts push (loop over members) or pull? | One blacklisted/reverting address wedges the whole round for everyone. | Confirm pull. If push, pre-check every member address against USDC's blacklist and that none are contracts that revert on receive. |
| Are contracts verified onchain? | No fallback path if the frontend dies. | Verify now — it's the one item on this list you can still fully fix in an afternoon. |

---

## 8. Deployment runbook

Target: **Base mainnet** (chain id 8453). Test first on Base Sepolia (84532).

### Environment

```
BASE_RPC_URL=       # paid plan, not a free key that rate-limits mid-trip
BASESCAN_API_KEY=
DEPLOYER_PRIVATE_KEY=
USDC_BASE=          # from Circle's official Base docs, verified at deploy time
```

### Deploy + verify

```bash
forge test -vvv
forge test --fork-url $BASE_RPC_URL --match-path test/fork/*   # real USDC

forge create src/SusuCircle.sol:SusuCircle \
  --rpc-url $BASE_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args $USDC_BASE \
  --verify --etherscan-api-key $BASESCAN_API_KEY
```

### Ownership

None. `SusuCircle` has no owner, no admin, and no upgrade path (§3.4). The
deployer key holds no privilege over a deployed circle and can be retired after
deploy. There is deliberately no multisig to transfer to — with two founders both
away, an admin key is a liability, not a safety net.

### Post-deploy verification (do this before inviting anyone)

Prove the whole path with real money on mainnet, small:

1. Confirm the deployed `USDC()` matches Circle's documented Base address —
   `cast call $CIRCLE "USDC()(address)" --rpc-url $BASE_RPC_URL`.
2. From a test wallet: `approve` $200 USDC, then `join()`. Confirm `Joined` and
   the $100 bond landed.
3. Call `abortJoin()`, confirm the bond comes back in full. This exercises the
   token path in both directions before anyone's real savings are involved.
4. Confirm `currentRound()` returns 0 pre-start, and on a Sepolia circle with a
   shortened `ROUND`, confirm it increments with time and **zero transactions** —
   this is the property the entire six-week answer rests on, so test it, don't
   assume it.
5. Open the Basescan write tab and confirm `contribute()` is callable from the
   UI. That's the documented fallback from §6.2; if it doesn't work, it isn't a
   fallback.

### Before launch

- Tests cover: full 12-round happy path; default early/mid/late; multiple
  defaults; defaulter's turn arriving; settlement math balancing to zero in
  every case; claim-never-called not blocking later rounds.
- Fork tests for all USDC interaction.
- A fresh reviewer reads the finished slice — specifically the settlement math
  in §1.1 and the transition table in §4 — before a single real dollar goes in.
