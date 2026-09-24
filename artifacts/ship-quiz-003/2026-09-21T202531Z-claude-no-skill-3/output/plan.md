# Onchain Susu — contract design, and whether it survives six weeks alone

## 0. Two things to read first

**There is no contract in this repo yet.** `TASK.md` and a stub `package.json`
are all that's here. So "the circles that are already running" are circles that
will be running when you leave. Whether they keep working is not something to
find out — it's something to decide in the next few days. This document assumes
you're deploying before you go, and is written to make that safe.

**The rule as stated cannot be implemented as stated.** "Their earlier
contributions cover the shortfall" assumes the contract is holding those earlier
contributions. It isn't. A susu is a pass-through: the $1,200 that arrives in
month 3 leaves in month 3. Between rounds the contract balance is zero. When
someone misses in month 7, there is no pile of their past money to reach into —
every dollar of it is already in the hands of the recipients for months 1–6.

This matters far more than it sounds, because it's the failure that will happen
while you're away. The fix is small and I've built it into the design below: a
**refundable one-month bond**, posted at join. That single change turns the
family rule into something the contract can actually execute.

---

## 1. The economics, stated plainly

Over twelve months: 12 members × 12 payments × $100 = **$14,400 in**.
12 payouts × $1,200 = **$14,400 out**. The circle is exactly zero-sum. It creates
no yield. What it creates is *timing* — position 1 gets a year-long
interest-free loan, position 12 runs a year-long savings account, and everyone
in between is somewhere on that line. That's the whole product, and it's a good
one.

The consequence is that **every susu is a credit instrument, and position in the
order is the credit risk.** A member at position 1 pays $100, receives $1,200,
and then owes eleven more payments with nothing at stake. Walking away nets them
$1,100. In your family the thing stopping that is your family. Onchain there is
nothing stopping it at all.

Do the damage arithmetic. Position 1 takes the pot in month 1 and stops paying.
Months 2–12 each collect $1,100 instead of $1,200. If the shortfall is
socialized, the eleven honest members each end the year $100 down, totalling the
defector's $1,100 gain. Zero-sum holds; the money just moved.

You cannot design this risk away. Full collateral — bonding the $1,100 you might
walk with — locks up the exact money the member joined to borrow, and you've
built an expensive escrow rather than a susu. So the design below does the
honest thing: it **automates the accounting and the penalty, covers one missed
month with real collateral, and leaves the residual risk where it actually
lives — in who you let into the circle.** Be explicit about this with members.
Position 1 is a $1,100 unsecured loan from the other eleven.

---

## 2. Contract design

### 2.1 Design constraints (these drive everything)

1. **No privileged caller, ever, in the live path.** Not for advancing rounds,
   not for paying out, not for marking defaults. If any monthly step needs you,
   the circle stops the month you get on a plane.
2. **Rounds are derived from time, not incremented by a transaction.**
   `round = (block.timestamp - startTime) / ROUND` — nobody has to "tick" it.
3. **Pull, never push.** The recipient claims. No loop over 12 addresses that
   one blacklisted or reverting member can brick.
4. **Anyone can pay for anyone.** The highest-value function for an unattended
   six weeks (§3.4).
5. **The contract must be able to finish the full twelve months with both of you
   permanently gone.** Not as a disaster mode — as the normal path.

### 2.2 State

```solidity
contract Susu {
    IERC20  public immutable usdc;
    uint256 public immutable amount;      // 100e6
    uint256 public immutable bond;        // 100e6  — one month, refundable
    uint256 public constant  N = 12;
    uint256 public constant  ROUND = 30 days;
    uint256 public constant  GRACE = 5 days;   // see §3.5

    uint256 public startTime;             // 0 until the 12th member joins
    address[12] public order;             // payout order, fixed at start

    struct Member {
        uint8   position;     // 1..12
        bool    joined;
        uint96  bondHeld;
        bool    forfeited;    // missed a payment before their turn
        bool    tookPot;
    }
    mapping(address => Member) public members;
    mapping(uint256 => mapping(address => bool)) public paid;  // round => member
    mapping(uint256 => uint256) public collected;              // round => USDC
    mapping(uint256 => bool)    public settled;
    uint256 public surplus;   // from forfeited turns; tops up later shortfalls
}
```

### 2.3 Lifecycle

**Formation.** `join(uint8 position)` — transfers `amount + bond` (the first
month plus the bond, $200) and claims a free position. Permissionless, first
come first served, or seeded from a fixed list in the constructor if you want
the order settled off-chain by the family. When the twelfth member joins,
`startTime = block.timestamp` **in that same transaction**. No separate `start()`
for someone to forget to call.

**Each round `r` (1..12).**
- Window opens at `startTime + (r-1) * ROUND`, due at `+ ROUND`, hard deadline
  at `+ ROUND + GRACE`.
- `contribute()` / `contributeFor(address member)` — pulls `amount`, sets
  `paid[r][member]`, adds to `collected[r]`.
- After the deadline, `settle(r)` — **permissionless, callable by anyone,
  and called automatically inside `claim`** — walks the twelve members once:
  - paid → nothing;
  - missed, bond intact → draw `amount` from `bondHeld` into `collected[r]`,
    and if they haven't taken their pot yet, set `forfeited = true`;
  - missed, bond exhausted → nothing to draw; the shortfall stands.
- `claim(r)` — only `order[r-1]`, only after settlement. Pays
  `min(collected[r] + surplusDraw, N * amount)`. Funds stay claimable forever;
  a recipient who's offline for a month loses nothing.

**Forfeited turns.** A forfeited member's round still collects from everyone
else but pays out to nobody; that ~$1,100 goes into `surplus`, which tops up
later short rounds. This is the property that makes the default rule close on
itself: the member who breaks the circle funds the repair of it.

**Bond top-up.** `topUpBond()` restores a drawn bond. A member who missed month 4
and repaid by the month-5 deadline is protected again. Forfeiture is not undone —
their turn is gone — but they can keep the rest of their obligations current.

**Settlement.** After round 12, `withdrawBond()` returns any remaining bond to
each member who paid in full, and splits `surplus` pro-rata among non-forfeited
members. Per-member pull; no one can block anyone else.

### 2.4 What the bond actually buys you

The bond is the whole of the "earlier contributions cover the shortfall" rule,
made real:

- **One missed month per member is fully covered.** The recipient gets the
  complete $1,200 and never knows. This is the overwhelmingly common case —
  someone's card fails, someone's travelling, someone forgets.
- **It costs $100, refundable.** It does not defeat the purpose the way full
  collateral would.
- **It does not cover a walk-away.** Position 1 leaving costs the group $1,100
  and the bond recovers $100 of it. The bond is an absorber for accidents, not
  insurance against bad faith. Say this to members in those words.

### 2.5 Invariants worth testing

- Contract USDC balance ≥ unclaimed pots + bonds held + surplus, always.
- Total paid out ≤ total contributed + bonds drawn. Never mints value.
- Every member appears in `order` exactly once; `order` is immutable after start.
- `claim` is idempotent and can only be called by the round's recipient.
- A member who reverts on receive, is USDC-blacklisted, or never shows up cannot
  prevent any other member from contributing, claiming, or withdrawing.
- No function anywhere lets any address move another member's funds. Including
  yours. Especially yours.

### 2.6 Deliberate non-features

**No owner. No pause. No upgrade path. No proxy.** For a twelve-month contract
with two absent authors, an admin key is not a safety feature — it's the largest
single risk in the system. A pause you can't lift from a beach is worse than no
pause. Deploy immutable, verify the source, and let the thing run. If you find a
bug, the response is to help the members exit and redeploy, not to reach in.

**One exception, and only this one:** a per-circle **guardian** — a 3-of-5
multisig of the circle's own members — with exactly one power, `extendDeadline`,
which can push the current round's deadline forward by up to 14 days and can do
nothing else. It cannot move funds, change the order, or forgive a debt. This is
your outage valve (§3.5) and it's delegable to people who aren't you.

---

## 3. The actual question: do running circles survive six weeks?

**Verdict: yes, if you build the design above — and no, if you build the obvious
version.** Six weeks spans two round boundaries, so two payouts and two default
settlements happen with nobody home. Below is what that means, split by whether
you can fix it before you go.

### 3.1 What keeps working with zero intervention

Under the design above: contributions (members push their own), payouts
(recipients pull their own), default detection (derived from state by anyone,
including by the claim itself), round advance (derived from `block.timestamp`),
and end-of-year settlement. Nothing in the monthly cycle has a hole where an
operator goes. That's not a happy accident — it's §2.1, and every item on that
list exists because of this question.

### 3.2 What breaks if you build the obvious version

These are the shapes this contract naturally wants to take, and each one fails
specifically at six weeks:

| Design | What happens while you're away |
|---|---|
| `advanceRound()` / `distribute()` guarded by `onlyOwner` | Two payouts never happen. Money sits in the contract. Members can see their balance and can't touch it — the worst possible optics for a trust-based product. |
| Push payout: loop transferring to each member | One member who is USDC-blacklisted, or whose address is a contract that reverts, makes the entire round's distribution revert. Every month after is stuck too. |
| Keeper/cron pulling `transferFrom` against standing approvals | Keeper dies, RPC key expires, or one member revokes their approval → that month silently under-collects. You find out in six weeks. |
| Pausable or upgradeable behind your 2-of-2 | You are the 2-of-2, and you're both away. You can neither respond to a bug nor unpause. Strictly worse than immutable. |
| Frontend as the only way to call | Vercel build expiry, an RPC key hitting its cap, a domain auto-renew failing. The contract is fine; nobody can reach it. Publish the Etherscan **Write Contract** route as a first-class path, not a fallback. |

If any of these are already in a draft on a branch somewhere, this table is the
pre-departure fix list.

### 3.3 What breaks that no contract design fixes

Be clear-eyed: these are real, they're reasonably likely across six weeks and
multiple circles, and the answer to each is a *person*, not a code change.

- **A member loses their keys, dies, or is USDC-blacklisted.** They can't pay
  and can't receive. Funds intended for them may be permanently unreachable.
  Nothing onchain resolves this.
- **A member wants to swap positions.** Utterly routine in a real susu —
  someone's rent moved, someone's wedding is in March. The order is immutable by
  design. In person you'd sort it in a phone call; the contract will refuse.
- **A genuine default with a relationship behind it.** The contract will execute
  forfeiture automatically, permanently, and without sympathy, at the deadline.
  In your family that decision comes after someone calls them. Onchain, the call
  has to happen *before* the deadline or it doesn't matter.
- **The order is wrong and it turns out to matter.** Position 1's credit risk is
  real and it's concentrated entirely in your choice of who goes first.

### 3.4 The mitigations, in priority order

1. **Ship `contributeFor(address)`.** Any address can pay any member's month.
   This is the single most valuable line of code for an unattended six weeks: a
   spouse, a cousin, or a steward with $100 can rescue a missed payment from
   anywhere, with no permissions and no contact with you. Most of §3.3 degrades
   from "circle breaks" to "someone covered it" because of this one function.
2. **Appoint a steward per circle.** One member, non-technical, who holds a
   printed one-page runbook: how to see who hasn't paid, how to call
   `contributeFor` from Etherscan, who to phone, and the guardian signers. They
   need no keys of yours and no code. Walk them through it once before you go.
3. **Stand up the guardian 3-of-5** from circle members (§2.6) and test an
   extension on testnet with the actual signers, not with your own keys.
4. **Freeze new deployments now.** Don't start a circle in the two weeks before
   you leave. Round 1 is the highest-risk round — it's the one where position 1
   takes $1,200 having paid $200 — and it's the one you want to watch in person.
   Any circle that starts should clear month 1 before you're on a plane.
5. **Alerts to the steward, not to you.** An email you read in an airport with
   no laptop is strictly worse than no email. Route monitoring to whoever can
   act on it.
6. **Write the members' note.** One page: what the bond is, what happens if you
   miss a month, that forfeiture is automatic and irreversible at the deadline,
   and that position 1 is trusted with $1,100. Expectations set in advance are
   the only conflict-resolution mechanism that works while you're gone.

### 3.5 The one that deserves its own heading

**A chain outage that crosses a deadline defaults everybody at once.**

If you're on an L2 and the sequencer halts for a day near a due date, members who
fully intended to pay cannot transact. The deadline passes. `settle` runs, and
twelve honest people are marked missed, twelve bonds are drawn, and every member
who hadn't yet taken their turn is forfeited — permanently, in one transaction,
with no one available to do anything about it. This is a total loss of the
circle from a cause none of the members had any part in.

Three defences, use all three:

- **A generous grace window.** `GRACE = 5 days` past a 30-day round. Rounds are
  monthly; five days costs nothing and absorbs essentially every realistic
  outage.
- **Read the L2 sequencer uptime feed** (Chainlink publishes one on the major
  L2s) in `settle`, and refuse to mark defaults if the sequencer was down during
  the window, extending the deadline by the downtime instead.
- **The guardian's `extendDeadline`**, as the human backstop for whatever the
  first two didn't anticipate.

### 3.6 The honest summary

Six weeks is short for a twelve-month contract, and that's the real frame here:
whatever you deploy has to run for a year, which is longer than most side
projects hold their authors' attention. Building for "survives the trip" and
building for "survives us" are the same build, so do it once, properly.

**If you ship the design in §2, running circles keep working and you should go.**
Members contribute, recipients claim, defaults settle, bonds absorb the ordinary
accidents, and the year completes whether or not either of you ever comes back.

**What you will still lose is discretion.** No mercy, no swaps, no "she'll pay
next week, let it slide" — the contract does what it says at the deadline. In a
family susu the discretion is most of the value, and the honest trade you're
making is that you're giving it up to get an instrument that doesn't need
anybody to hold it. Tell the members that's the trade. Then `contributeFor` is
how you give a little of the discretion back.

---

## 4. Build order

1. Contract per §2, immutable, no owner. Bond, `contributeFor`, pull claims,
   time-derived rounds, grace window.
2. Tests for §2.5, plus the adversarial ones: position-1 walk-away; blacklisted
   recipient; reverting-contract member; sequencer down across a deadline; every
   member missing the same month; claim after twelve months of silence.
3. Testnet run with the round compressed to hours. Drive the whole year,
   including a default and a forfeiture, from **Etherscan only** — no frontend.
   If you can't, the steward can't either.
4. Frontend, explicitly as a convenience layer over a contract that doesn't need
   it.
5. Steward runbook, members' note, guardian multisigs. Then deploy — with at
   least two weeks in the country afterwards.
