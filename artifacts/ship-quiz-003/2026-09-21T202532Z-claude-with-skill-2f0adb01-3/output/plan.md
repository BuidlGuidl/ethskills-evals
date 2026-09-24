# Susu — onchain savings circle: design + six-week unattended operation

**Date:** 2026-09-21
**Scope:** contract design for a 12-person / $100 / month USDC savings circle, and a direct
answer to "do the circles that are already running keep working while both of us are away
for six weeks?"

> **One caveat on the second question.** This repo contains no contract code — only the task
> notes. So I can't audit what your live circles are actually running on. Part 3 answers the
> question for the design below; Part 4 is the checklist to run against your *deployed*
> contract to find out whether the live circles have the same property. If any answer in
> Part 4 is "no", treat Part 3's conclusion as not applying to those circles.

---

## Part 1 — Architecture

### What goes onchain

Onchain (trustless value + permanent commitment):

- Membership roster and payout order, frozen at start
- Every contribution and every payout
- The default / forfeiture rule
- The escape hatch

Offchain:

- Who gets invited, and the *social* choice of payout order
- Reminders ("your $100 is due in 3 days")
- Names, photos, chat, dispute conversations
- Any analytics / history views (read from events)

### Contract count: **1**

`SusuCircles.sol` — one contract holding many circles, keyed by `circleId`. Not a factory:
a factory buys per-circle address isolation you don't need and costs a deploy per circle.
One contract, strictly segregated per-circle accounting.

No registry contract, no token, no upgrade proxy, no timelock, no admin.

### Chain: **Base**

- Native USDC (not bridged), Coinbase on-ramp, and Coinbase Smart Wallet — this is a
  family app, and half the members will not have a wallet on day one.
- 12 members × 12 contributions + 12 claims ≈ 156 txs per circle per year. On Base that's
  pennies total. On mainnet the gas would be a visible fraction of a $100 contribution.
- Use the canonical Base native USDC address (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
  — **verify it against Circle's docs before deploy, don't trust it because it's written
  here.** USDC is **6 decimals**: $100 = `100_000_000`. USDC is also an upgradeable proxy
  with a blacklist; that's a risk you inherit and can't remove (see Part 3, item 9).

---

## Part 2 — Contract design

### 2.1 The accounting trap in the rule as written

Your rule is: *"if someone misses a payment they forfeit their turn, and their earlier
contributions cover the shortfall for that month's recipient."*

In aggregate that's sound. In **cash flow** it isn't, and this is the single most important
thing to get right before writing code.

A member who defaults in month 3 has already paid $200 — but that $200 was paid *out* to
the month‑1 and month‑2 recipients. It is gone. There is nothing to seize. What actually
funds the shortfall is the **$1,200 payout they no longer receive**, and that money only
becomes available in whatever month their turn was scheduled for.

Worst case: a member defaults in month 1 and their turn was month 12. Months 1–11 are each
$100 short *right now*; the $1,200 that covers it doesn't materialise for another eleven
months.

The aggregate is fine — total collected $13,400, eleven payees, $1,218 each, i.e. honest
members come out slightly *ahead*. The problem is purely timing. Two mechanisms fix it:

1. **Security deposit at join.** Each member posts `depositMultiple × $100` up front,
   refunded after the final round if they're in good standing. This is immediate,
   seizable liquidity. `depositMultiple = 1` makes one short month whole on time.
2. **Deficit claims.** If the reserve can't cover a round, the recipient gets a short pot
   *plus* an onchain IOU (`deficit[member]`), paid automatically from the reserve as it
   fills — including at the forfeiting member's skipped turn, and at final settlement.

A deposit large enough to guarantee every round on time is ~11 contributions, which
defeats the point of the circle. So: `depositMultiple` is a per-circle parameter (0/1/2),
default 1, and the UI must state plainly that a default can mean **"your pot arrives in two
parts"** — never that money is lost.

### 2.2 Design note: payout order is a risk decision

Month‑1's recipient borrows $1,100 from the group and repays over a year. Month‑12's
recipient lends all year. Order is not cosmetic — put the members you trust least *late*.
The contract enforces the order; choosing it is a family decision made offchain and passed
to `createCircle`.

### 2.3 Rounds advance by time, not by a transaction

```solidity
function currentRound(uint256 id) public view returns (uint256) {
    Circle storage c = circles[id];
    if (c.startTime == 0) return 0;
    uint256 r = (block.timestamp - c.startTime) / c.periodLength;
    return r >= c.size ? c.size : r;   // c.size == circle is over
}
```

Round number is a pure function of `block.timestamp`. **Nothing and nobody has to be called
to advance a month.** This is the choice that makes the rest of Part 3 come out the way it
does, and the one I would not compromise on for any feature.

Periods are fixed `30 days`, not calendar months. Solidity has no calendar; fake-month
arithmetic is a bug farm. Tell members "every 30 days", show the exact deadline in the UI.

### 2.4 Storage

```solidity
contract SusuCircles {
    using SafeERC20 for IERC20;

    struct Circle {
        IERC20    token;           // USDC
        uint96    amount;          // 100e6
        uint64    startTime;       // 0 = not started
        uint32    periodLength;    // 30 days
        uint64    joinDeadline;    // abort-and-refund after this if not full
        uint8     size;            // 12
        uint8     joinedCount;
        uint8     depositMultiple; // 0 | 1 | 2
        bool      aborted;
        uint96    reserve;         // forfeited deposits + skipped-turn pots
        uint96    balance;         // this circle's share of token holdings
        address[] members;         // index == payout round
    }

    mapping(uint256 => Circle) public circles;

    // circleId => member => ...
    mapping(uint256 => mapping(address => bool))    public isMember;
    mapping(uint256 => mapping(address => bool))    public joined;
    mapping(uint256 => mapping(address => bool))    public defaulted;
    mapping(uint256 => mapping(address => uint96))  public deposit;      // refundable
    mapping(uint256 => mapping(address => uint96))  public contributed;  // lifetime paid in
    mapping(uint256 => mapping(address => uint96))  public deficit;      // owed to recipient
    mapping(uint256 => mapping(address => bool))    public unwindVote;

    // circleId => round => ...
    mapping(uint256 => mapping(uint256 => uint96)) public roundPot;
    mapping(uint256 => mapping(uint256 => uint8))  public roundPaidCount;
    mapping(uint256 => mapping(uint256 => bool))   public roundSettled;
    mapping(uint256 => mapping(uint256 => bool))   public roundClaimed;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public paidRound;
}
```

`balance` is tracked per circle so one circle can never draw on another's USDC. Every
transfer in/out adjusts it.

### 2.5 Functions

**`createCircle(token, members[12], amount, periodLength, depositMultiple, joinDeadline)`**
Permissionless. Anyone can open a circle with a roster; array order *is* the payout order.
Rejects duplicate members, zero addresses, `size < 2`.

**`join(id)`** — a listed member pulls in `amount * depositMultiple` as their deposit.
When the last member joins, `_start()` runs inline — no separate transaction needed.

**`start(id)`** — permissionless backstop: callable by anyone once all members have joined.
Sets `startTime = block.timestamp`.

**`abort(id)`** — permissionless, after `joinDeadline` if not full. Flips `aborted`; each
joiner pulls their deposit back via `withdrawDeposit`. A half-filled circle can never trap
funds, and un-trapping it needs no operator.

**`contribute(id)`**
```
require started, not over, msg.sender is member, !defaulted, !paidRound[r][msg.sender]
r = currentRound(id)
token.safeTransferFrom(msg.sender, this, amount)
paidRound[r][msg.sender] = true; roundPaidCount[r]++; roundPot[r] += amount
contributed[msg.sender] += amount; balance += amount
emit Contributed(id, r, msg.sender, amount)
```
Accepted any time inside the 30-day window. A member pays 12 times, including in the month
they receive — simplest to reason about, nets out identically, and avoids an "am I exempt
this month?" edge case the UI would have to explain.

**`settle(id, round)`** — permissionless, idempotent, only for rounds that have **ended**:
```
for each member m: if !paidRound[round][m] && !defaulted[m]:
    defaulted[m] = true                  // forfeits their turn, permanently
    reserve += deposit[m]; deposit[m] = 0 // the only liquid money there is
    emit Defaulted(id, round, m)

recipient = members[round]
target    = size * amount
if defaulted[recipient]:
    reserve += roundPot[round]; roundPot[round] = 0   // skipped turn funds the shortfalls
    roundClaimed[round] = true
else if roundPot[round] < target:
    topUp = min(target - roundPot[round], reserve)
    reserve -= topUp; roundPot[round] += topUp
    if (roundPot[round] < target) deficit[recipient] += target - roundPot[round]
roundSettled[round] = true
```

**`claim(id, round)`** — the scheduled recipient pulls their pot.
- Allowed once the round is **fully funded** (all 12 in, don't make them wait out the month)
  **or** once the round has ended, in which case `settle` is invoked lazily first.
- Pull, not push. No loop of 12 transfers, no reentrancy surface, no gas cost on anyone
  else, and a recipient who is slow or offline blocks nobody.
- **Claims never expire.** No deadline, no sweep, no forfeiture-by-inactivity. Funds owed
  to a member stay owed forever.

**`claimDeficit(id)`** — permissionless-to-call-for-yourself; pays `min(deficit, reserve)`.
This is how a short pot gets topped up as the reserve fills.

**`finalize(id)` / `withdrawDeposit(id)`** — after the final round: deficits are paid
first, then members in good standing pull their deposit plus a pro-rata share of any
residual reserve (the surplus from skipped turns). Defaulters recover nothing — that's
what forfeiture means, and it should be spelled out in the invite, in the UI, and at the
family table before anyone signs.

**`voteUnwind(id)` / `executeUnwind(id)` — the escape hatch.** Any member can vote; at a
supermajority (9 of 12, fixed at creation) the circle stops and every member pulls a
pro-rata refund of the remaining balance weighted by `contributed + deposit`. Defaulters
included at their reduced weight; this is a wind-down, not a punishment.

This exists **instead of** a pause button or an admin key. A pause on a family's savings
pot is a rug vector and a single point of failure; an upgradeable money path means the two
of us can rewrite the rules unilaterally, which is exactly the trust the susu is supposed
not to require. The members can already do the only emergency action that matters, and
they can do it without us.

### 2.6 Security notes

- `SafeERC20` everywhere; USDC decimals = 6, never hardcode 18.
- Checks-Effects-Interactions; all payouts are pull-based, single transfer, no loops over
  members that move money.
- No fee-on-transfer / rebasing support — assert `balanceOf` delta equals `amount` on
  `contribute` so a surprise token upgrade fails loudly instead of quietly under-crediting.
- Immutable after `start`: roster, order, amount, period. No setters.
- `createCircle` is permissionless, so griefers can create junk circles with your address
  in the roster. `join` is opt-in and costs the griefer nothing to be ignored — the
  frontend filters to circles you've been invited to via an offchain invite, and `abort`
  cleans up the rest. Acceptable.
- **No Chainlink VRF for ordering, no Chainlink Automation, no keeper bot.** Both come with
  a funded subscription that can run dry — see Part 3, item 1.
- Events on every state change for the frontend and any indexer.

### 2.7 State transition audit

| Function | Who calls | Why they would | If nobody calls | Needs us? |
|---|---|---|---|---|
| `createCircle` | organiser | wants a circle | no new circles start | no |
| `join` | member | wants in | circle never fills → `abort` refunds | no |
| `start` | auto on 12th join / anyone | wants circle running | stays in joining state, refundable | no |
| *round advance* | **nobody — time** | n/a | **n/a, it's a view** | **no** |
| `contribute` | member | keep their turn ($1,200) | they default, per the rules | no |
| `settle` | folded into `claim`; anyone | it's a precondition of getting paid | nothing: the person with $1,200 at stake does it | no |
| `claim` | recipient | $1,200 | claimable forever, no expiry | no |
| `claimDeficit` | shorted recipient | their own money | claimable forever | no |
| `withdrawDeposit` | member | their own deposit | claimable forever | no |
| `voteUnwind` | members | emergency | circle just continues | no |

Every row is either time-derived or driven by the caller's own money. There is no function
whose non-execution breaks the system, and no function only we can call.

---

## Part 3 — Do the running circles keep working for six weeks?

**Short answer: the contract does. The thing members actually touch does not, unless you
spend about a day on the checklist in Part 5 before you leave.**

Six weeks ≈ two round boundaries. Here's every way it goes wrong, worst first.

### 1. The contract itself — **fine, and this is not luck**

Rounds advance on `block.timestamp`. Contributions are member-initiated. Payouts are pull.
Defaults are computed lazily by the person collecting $1,200. Deposits and deficits are
pull. The escape hatch is member-controlled. No admin key, no cron, no bot, no subscription.
It runs for a year with both of us unreachable.

It would **not** be fine if the deployed version does any of these — this is the list to
check in Part 4:

- a keeper/bot/cron that calls `closeRound()` / `advance()` / `payout()`
- Chainlink Automation or VRF, or any service with a **prepaid subscription balance** that
  drains — the classic six-weeks-away failure: the sub empties in week 3, rounds stop
  advancing, and nobody can top it up
- `onlyOwner` on anything in the money path
- a backend that co-signs, relays, or sequences transactions
- push payouts looping over 12 members (one bad recipient address bricks the month)
- a claim deadline or "unclaimed funds sweep"

### 2. Payment reminders — **breaks, and it costs real money**

Nobody has an incentive to remind eleven other people to pay. Members forget. Under your
own rules, forgetting means **forfeiting a $1,200 turn** — the single most expensive
failure in this whole document, and it's a notifications problem, not a Solidity problem.

Two round boundaries fall inside your six weeks, i.e. two chances for this.

Fix: reminders on infrastructure that doesn't need you — a GitHub Actions cron (free,
no balance to drain) reading contract state and sending email/SMS/XMTP at T‑7, T‑3, T‑1
days. Plus: get every member to put a recurring calendar event in *now*, before you go.
Plus: a countdown and a red "unpaid" banner on the frontend's front page. Belt and braces,
because the downside is $1,200 per incident.

### 3. Frontend availability — **breaks, and it causes defaults**

If the app is down, members can't pay, and not paying has consequences. Realistic six-week
killers: an RPC key on a trial plan or free-tier rate limit; a Vercel build that fails on a
dependency republish; a domain or ENS registration expiring; an SSL cert or a Node version
deprecation.

Fix: pin every dependency (lockfile committed, no `^`), confirm the RPC plan is paid with
headroom for 8 weeks *and* code a public-RPC fallback, renew domain/ENS past the window,
and pin an IPFS snapshot of a working build as a static fallback that needs no build step.
Point uptime monitoring at a third person who isn't away.

### 4. USDC allowance — **breaks silently, per member**

If the UI approves exactly one month's $100, every member's next payment fails. Same if it
uses Permit2/`permit` with a short deadline.

Fix: approve the remaining term at join (or `remaining × amount` on each contribute), and
**read the current allowance for all 12 members of every active circle before you leave.**
Anyone short gets one re-approval tx now instead of a default in week 4.

### 5. Gas — **breaks, per member**

A member with no ETH on Base cannot pay. It's cents, but zero is zero.

Fix: check ETH balances for all active members; top up anyone at zero. If you're using a
paymaster for gasless contributions, **that's a draining prepaid balance — fund it for
eight-plus weeks or turn it off.** A paymaster running out in week 3 looks exactly like
item 1's keeper failure.

### 6. Support and disputes — **breaks, and mostly can't be fixed by code**

Over six weeks someone will have a case: "my transaction failed, I paid on time," or "my
turn got skipped." The contract is immutable and has no admin, so even sitting at our desks
there is nothing we could do — that's the design, and it's the right design, but it means
the *answer* has to exist before we leave, not after the complaint.

Fix: write the rules in plain language (one page: deadlines, what default costs, why a pot
can arrive in two parts, that funds are never lost to inactivity), name one family
point-of-contact per circle who can read contract state, and publish the 9-of-12 unwind so
members know they have the final say without us.

### 7. A recipient who can't receive — **latent, check now**

A roster address that's an exchange deposit address, a lost key, or a contract that can't
hold USDC. No admin means no address change — by design.

Fix: verify all 12 addresses of every active circle now (self-custody, member-controlled,
has signed at least one tx). Document that claims never expire, so a member with a
temporarily inaccessible wallet loses nothing by claiming late.

### 8. Sequencer outage vs. the payment deadline — **mitigated by design, worth knowing**

Rounds tick on wall-clock time. If Base is down at a deadline, a member could be defaulted
for something that wasn't their fault. Base outages run hours, not days, and the design
already softens this: contributions count any time before the round is *settled*, and
settlement only happens when someone claims. Practically this makes late-but-before-claim
payments valid. If you want it airtight, extend `contribute` to accept round `r` until
`roundSettled[r]` — a small change, worth making before you go.

### 9. USDC and chain-level risk — **outside your control, disclose it**

Base USDC is an upgradeable proxy with a blacklist. A frozen member address, or a token
upgrade changing transfer semantics, is not something the contract or we can fix. The
`balanceOf`-delta assertion in `contribute` at least makes a semantics change fail loudly.
Say this out loud to the family rather than discovering it in week 4.

### 10. Indexer / subgraph — **breaks, cosmetically or worse**

A subgraph that stops syncing, or a Graph billing balance that empties, makes the app show
stale state: "you've paid" when you haven't. That turns a monitoring failure into a default.

Fix: read everything the member *acts* on — paid status, deadline, pot, whose turn — from
the contract via RPC. The indexer is allowed to power history views only.

### 11. New circles — **work fine**

`createCircle`, `join` and `start` are all permissionless, so a new circle can form and
start while you're away. Consider a UI banner saying support is offline until late
October/November; don't disable it, since there's no way to re-enable it remotely.

---

## Part 4 — Audit the deployed contract against this (do this first)

For each live circle, answer yes/no. Any "no" means Part 3's conclusion doesn't hold and
item 1's failure modes are live.

1. Is the current round a pure function of `block.timestamp` (a `view`), or is it stored
   state that some transaction has to bump?
2. Is there any function in the money path with `onlyOwner` / `onlyRole` / an operator
   modifier? `grep -rn "onlyOwner\|onlyRole\|require(msg.sender == owner" contracts/`
3. Is there any keeper, cron, Chainlink Automation upkeep, VRF subscription, Gelato task,
   or backend job? For each: what is its balance, and when does it run out?
4. Are payouts pull (recipient calls) or push (contract loops and sends)?
5. Is there a claim deadline, expiry, or sweep of unclaimed funds anywhere?
6. Can a stuck/half-filled circle be refunded without an admin?
7. Is the contract upgradeable? If yes, who holds the upgrade key, and where is it while
   you're both away?
8. Is there a pause? If yes, who can unpause, and are they reachable?
9. For every active member: USDC allowance ≥ remaining contributions, and ETH > 0?
10. Domain, ENS, RPC plan, Vercel plan, paymaster, subgraph billing — expiry or balance
    date past mid-November 2026?

---

## Part 5 — Pre-departure checklist

Roughly a day of work. Ordered by cost of skipping it.

- [ ] Run Part 4 against every live circle; write the answers down in this repo
- [ ] Fix any keeper/admin/subscription dependency found — or, if it can't be fixed in
      time, use the 9-of-12 unwind to wind those circles down *before* leaving rather than
      letting them fail mid-window
- [ ] Reminder cron on GitHub Actions (T‑7/T‑3/T‑1), tested end-to-end with a real send
- [ ] Every member adds a recurring calendar reminder — confirm individually, don't assume
- [ ] Top up allowances and ETH for all active members
- [ ] Pin dependencies; deploy; pin an IPFS snapshot as a no-build fallback; add a
      public-RPC fallback in the client
- [ ] Renew domain/ENS/RPC/hosting past mid-November 2026
- [ ] Uptime monitor alerting a named third person
- [ ] One-page plain-language rules doc, shared in every circle's chat
- [ ] Name a point-of-contact per circle; show them how to read contract state and how
      the unwind vote works
- [ ] Extend `contribute` to accept a round until it's settled (item 8)

## Still to do on the contract (not started here)

This document is design-level; the Solidity above is a sketch, **not compiled and not
tested.** Before it touches real money:

1. Foundry unit tests: happy path, every default permutation, default of a month‑1
   recipient, default of a month‑12 recipient, deficit accrual and payoff, unwind at
   threshold and below it, abort-and-refund.
2. Fuzz the settlement math. The invariant to fuzz: **sum of all withdrawable claims ==
   circle balance**, at every point in every sequence of actions. Assert no circle can
   ever draw on another's balance.
3. Fork test against real Base USDC (6 decimals, proxy, blacklist behaviour).
4. `slither .`, then a security review by a fresh agent with the `audit` skill — not by
   whoever wrote the contract.
5. Run one circle with 12 members and $1 contributions for two rounds on Base Sepolia
   before anyone puts in $100.
