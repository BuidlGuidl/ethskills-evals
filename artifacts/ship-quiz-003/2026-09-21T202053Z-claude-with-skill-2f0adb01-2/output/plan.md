# Onchain Susu (ROSCA) — Contract Design + Six-Week Absence Review

**Scope note:** this repo contains only `TASK.md`. I have **not** seen the contract behind
your already-running circles, so Part 3 is a design done from first principles and Part 5 is a
diagnostic you run against the real deployment. If the deployed code differs from Part 3, Part 5
is the part that actually answers your question.

---

## 1. The one-line answer

**A susu contract *can* run untouched for six weeks — but only if you designed it so that
every state change is triggered by someone who wants money, not by you.** The contract is the
easy part. What breaks while you're away is almost never Solidity; it's the RPC key, the
frontend host, the reminder emails, and an admin key sitting on a phone in another country.

Six weeks ≈ 1.4 monthly rounds, so **one or two payouts happen with nobody home.** That's
enough to hurt if the design has a push step, and enough for two members to silently miss a
payment and forfeit a $1,200 turn.

---

## 2. Architecture decisions

### What goes onchain

| Onchain | Offchain |
|---|---|
| Member list and the fixed payout order | Names, phone numbers, profile photos |
| Deposits and monthly contributions (USDC custody) | Payment reminders, SMS/email/WhatsApp |
| Who paid which month, who forfeited | Circle discovery / browse UI |
| Payout entitlement and settlement math | Activity feed (index the events) |
| Circle close and residual distribution | Reputation display across circles |

A susu is *exactly* the onchain litmus test: trustless custody of a pot, a permanent
commitment to an order, and it must keep working if your team vanishes. The social layer —
who you invite, who nags whom — stays off.

### Contract count: 2

- `SusuCircle.sol` — one circle. All logic and custody.
- `SusuFactory.sol` — EIP-1167 minimal-proxy clone factory.

A factory is normally over-building, but here it's the Uniswap-pool case: many independent
groups each want their own instance with their own members and their own money. Clones make a
new circle cost a few cents and keep each family's funds in a separate contract, so a bug or a
default in one circle cannot touch another.

**No proxy upgradeability on `SusuCircle`.** A running circle is a 12-month commitment over
real money; an upgradeable implementation means whoever holds the admin key can rewrite the
rules mid-circle. Each circle is immutable from `start()`. New rules ship as a new
implementation that the factory points at for *future* circles only.

### Chain: Base

Recurring $100 stablecoin payments from ordinary people, 12 members × 12 rounds ≈ 160
transactions per circle. Base gives the cheapest transfers (fractions of a cent, so gas never
eats a contribution), a direct Coinbase on-ramp so a family member can go dollars → USDC
without touching a bridge, and Smart Wallet / passkey onboarding for people who have never
held crypto. Native USDC is on Base, so no bridged-asset risk.

Mainnet would work and is cheaper than its reputation, but "help my aunt fund her turn from a
debit card" is Base's superpower, not mainnet's.

---

## 3. Contract design

### Parameters (fixed at `initialize`, immutable thereafter)

```
token          = USDC (6 decimals — not 18)
contribution   = 100e6
deposit        = 100e6          // security deposit, posted at join
period         = 30 days
rounds         = order.length   // 12
order[]        = the 12 members, index == the round they receive
joinDeadline   = start-by date; after this, unfilled circles refund
```

### The deposit, and why it exists

Your family's rule is: *"if someone misses a payment they forfeit their turn, and their earlier
contributions cover the shortfall for that month's recipient."*

Offline that works because the organizer is holding float and can reach into it. **Onchain
there is no float.** In a pure pass-through ROSCA, month *r*'s inflow is paid out in month *r*;
by the time someone defaults in month 7, their month-1..6 contributions are long gone into six
other people's pockets. The contract has nothing to reach into.

So we materialize the rule as a **100 USDC security deposit posted at join.** That is the
member's "earlier contributions," held in escrow from day one. Miss a month and the deposit is
seized to top the recipient's pot back up to $1,200, and you forfeit your turn. Your total
commitment is $1,300 in, $1,300 out (pot + deposit back) if you never miss.

This is the same rule your family already runs. It just has to be pre-funded, because a
contract can't extend credit.

### Lifecycle

```
CREATED ──all 12 join()──► RUNNING ──round 11 settles──► CLOSED
   │
   └──joinDeadline passes──► refundDeposit() per member
```

**Round timing is derived from the clock, never stored.** There is no `advanceRound()`
transaction. `currentRound() = (block.timestamp - startTime) / period`. Nothing needs poking to
make time pass.

- Round *r* accepts contributions during its full 30-day window.
- Round *r* settles at the instant round *r+1* opens.
- The UI shows a **day-5 due date**; the contract forgives until **day 30**. That 25-day
  cushion is deliberate — it absorbs a sequencer outage, a holiday, and a member who is
  travelling, without a $1,200 forfeit.

### Settlement (the part that must never need you)

`settle(r)` is **permissionless and idempotent**:

1. `pot = roundPot[r]` (sum of contributions actually received for round *r*)
2. For each member who didn't pay: mark `disqualified`, seize their `deposit` into the pot
3. If `order[r]` is in good standing → credit `withdrawable[order[r]] += pot`
   Else (the scheduled recipient forfeited) → `surplus += pot`
4. Mark `settled[r] = true`

**Settlement credits an internal balance. It never transfers tokens.** That's the pull-payment
pattern, and it matters concretely here: USDC has a blacklist. If one member's address gets
blacklisted, a push transfer would revert and **wedge the entire circle**. With pull, one
broken recipient only breaks their own `withdraw()`.

`withdraw()` transfers `withdrawable[msg.sender]` with `SafeERC20`. Checks-effects-interactions,
balance zeroed before the transfer.

`contribute(r)` for any round auto-settles all unsettled earlier rounds first, so settlement
also happens as a free side effect of the eleven other people paying their dues.

### Closing

`finalize()` is permissionless and idempotent, callable once round 11 has settled. It returns
each good-standing member's deposit and credits them `surplus / goodStandingCount`. Auto-invoked
at the tail of `settle(rounds - 1)`, so in practice it just happens.

### Prepayment

`contribute(r)` accepts any `r >= currentRound()`. A member leaving the country can fund all
twelve months in one sitting. **Ship this before you leave — it is the single highest-leverage
feature for an absent team** (see §4.2).

### Value conservation — who eats a default

The contract cannot conjure money. Total in equals total out. Worth being exact about where
losses land, because this is what your family will actually ask.

**Case A — member defaults *before* their turn.** Alice is position 8, stops paying at round 3.

| | |
|---|---|
| Round 3 | 11 pay = $1,100, Alice's $100 deposit seized → recipient gets the full **$1,200** ✓ |
| Rounds 4–6 | $1,100 each — recipients short $100 each = **−$300** |
| Round 7 (Alice's slot) | $1,100 collected → goes to **surplus**, Alice gets nothing |
| Rounds 8–11 | $1,100 each — **−$400** |
| Close | surplus $1,100 ÷ 11 good members = **+$100 each = +$1,100** |

Good members: −$700 shortfall, +$1,100 surplus = **+$400 collectively.** Alice put in
$300 + $100 deposit = $400 and got $0. It balances **exactly.** The loss falls entirely on the
defaulter, which is the rule your family intends.

**Case B — member defaults *after* their turn.** Bob is position 2, receives $1,200 at
round 1, stops paying at round 3.

| | |
|---|---|
| Bob's total in | $200 contributions + $100 deposit = **$300** |
| Bob's total out | **$1,200** |
| Round 3 | deposit covers it → recipient whole ✓ |
| Rounds 4–11 | $1,100 each — **−$800** spread across eight recipients |
| Surplus available | **$0** — Bob's slot already paid out |

**Bob walks away $900 up and the other eleven are collectively $800 down.** The deposit covers
exactly one missed month; after that there is nothing to seize.

**This is not a bug we can code away.** It's the structural credit risk in every rotating
savings circle on earth, and the reason a susu is a *trust* institution. Putting it onchain
removes the organizer risk (nobody can run off with the pot, nobody miscounts) — it does **not**
remove the member risk.

Be loud about this in the UI. Concretely:

- The contract records defaults permanently; surface a member's history across circles.
- Optional knob: position-weighted deposits (earlier slots post more). It genuinely reduces
  the exposure, and it also destroys the reason anyone wants an early slot. **Default off.**
  Offer it as a per-circle setting and let each family choose.
- Never market this as "trustless savings." It is *transparent* savings. Only invite people
  you'd already invite to a susu.

### Sketch

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/// One savings circle. Immutable once started. No owner, no pause, no upgrade.
contract SusuCircle is Initializable {
    using SafeERC20 for IERC20;

    IERC20  public token;
    uint256 public contribution;
    uint256 public depositAmount;
    uint256 public period;
    uint256 public joinDeadline;
    uint256 public startTime;          // 0 until the circle is full

    address[] public order;            // index == round that member receives
    mapping(address => uint8)   public position1;     // 1-based; 0 == not a member
    mapping(address => bool)    public joined;
    mapping(address => bool)    public disqualified;
    mapping(address => uint256) public escrow;        // live deposit
    mapping(address => uint256) public withdrawable;  // pull payments

    mapping(uint256 => mapping(address => bool)) public paid;
    mapping(uint256 => uint256) public roundPot;
    mapping(uint256 => bool)    public settled;

    uint256 public surplus;
    uint256 public goodStanding;
    bool    public finalized;

    event Joined(address indexed member);
    event Started(uint256 startTime);
    event Contributed(address indexed member, uint256 indexed round);
    event Defaulted(address indexed member, uint256 indexed round, uint256 seized);
    event Settled(uint256 indexed round, address indexed recipient, uint256 pot);
    event Withdrawn(address indexed member, uint256 amount);
    event Finalized(uint256 surplusPerMember);

    function rounds() public view returns (uint256) { return order.length; }

    function currentRound() public view returns (uint256) {
        if (startTime == 0) return 0;
        return (block.timestamp - startTime) / period;
    }

    // ---- formation -------------------------------------------------------

    function join() external {
        require(startTime == 0 && block.timestamp <= joinDeadline, "closed");
        uint8 p = position1[msg.sender];
        require(p != 0 && !joined[msg.sender], "not invited");
        joined[msg.sender] = true;
        escrow[msg.sender] = depositAmount;
        goodStanding++;
        token.safeTransferFrom(msg.sender, address(this), depositAmount);
        emit Joined(msg.sender);
        if (goodStanding == order.length) {          // 12th join starts it. No poke.
            startTime = block.timestamp;
            emit Started(startTime);
        }
    }

    /// Circle never filled: each member pulls their own deposit back. Permissionless per member.
    function refundDeposit() external {
        require(startTime == 0 && block.timestamp > joinDeadline, "still forming");
        uint256 amt = escrow[msg.sender];
        require(amt > 0, "nothing");
        escrow[msg.sender] = 0;
        token.safeTransfer(msg.sender, amt);
    }

    // ---- the running circle ---------------------------------------------

    /// Pay dues for round `r`. `r` may be any future round -> prepay the whole year.
    function contribute(uint256 r) public {
        require(startTime != 0 && r < rounds(), "bad round");
        require(joined[msg.sender] && !disqualified[msg.sender], "not active");
        uint256 cur = currentRound();
        require(r >= cur, "round closed");
        require(!paid[r][msg.sender], "already paid");

        settleThrough(cur);                       // settling is a side effect of paying
        paid[r][msg.sender] = true;
        roundPot[r] += contribution;
        token.safeTransferFrom(msg.sender, address(this), contribution);
        emit Contributed(msg.sender, r);
    }

    function contributeMany(uint256[] calldata rs) external {
        for (uint256 i; i < rs.length; ++i) contribute(rs[i]);
    }

    /// Anyone may call. Idempotent. Never transfers tokens.
    function settle(uint256 r) public {
        require(startTime != 0 && r < rounds() && !settled[r], "not settleable");
        require(currentRound() > r, "round still open");
        if (r > 0) settle(r - 1);                 // rounds settle in order

        uint256 pot = roundPot[r];
        uint256 n = order.length;
        for (uint256 i; i < n; ++i) {
            address m = order[i];
            if (paid[r][m] || disqualified[m]) continue;
            disqualified[m] = true;
            goodStanding--;
            uint256 seized = escrow[m];
            escrow[m] = 0;
            pot += seized;
            emit Defaulted(m, r, seized);
        }

        address recipient = order[r];
        settled[r] = true;
        if (disqualified[recipient]) {
            surplus += pot;                        // forfeited turn -> split at close
            emit Settled(r, address(0), pot);
        } else {
            withdrawable[recipient] += pot;        // credit, do not push
            emit Settled(r, recipient, pot);
        }
        if (r == n - 1) finalize();
    }

    function settleThrough(uint256 upTo) public {
        for (uint256 r; r < upTo && r < rounds(); ++r) if (!settled[r]) settle(r);
    }

    function finalize() public {
        uint256 last = rounds() - 1;
        require(!finalized && settled[last], "not done");
        finalized = true;
        uint256 share = goodStanding == 0 ? 0 : surplus / goodStanding;
        for (uint256 i; i < order.length; ++i) {
            address m = order[i];
            if (disqualified[m]) continue;
            withdrawable[m] += escrow[m] + share;  // deposit back + surplus share
            escrow[m] = 0;
        }
        surplus = 0;
        emit Finalized(share);
    }

    /// The only function that moves tokens out. Checks-effects-interactions.
    function withdraw() external {
        uint256 amt = withdrawable[msg.sender];
        require(amt > 0, "nothing");
        withdrawable[msg.sender] = 0;
        token.safeTransfer(msg.sender, amt);
        emit Withdrawn(msg.sender, amt);
    }
}
```

Sketch, not shippable. Before real money: Foundry unit tests for every default permutation,
fuzz the settlement math, invariant test **`sum(withdrawable) + sum(escrow) + surplus ==
token.balanceOf(this)`** (that one invariant catches most of the accounting bugs), fork-test
against real Base USDC, `slither .`, and a full audit pass in a **fresh agent context** so the
reviewer has no bias from having written it. The `settle` loop is bounded by 12 — keep it
bounded; if you ever allow large circles, move the default sweep to per-member.

---

## 4. The six-week question

### 4.1 State-transition audit — who calls every function, and what if nobody does?

| Function | Who calls it | Why they would | If nobody calls it | Needs you? |
|---|---|---|---|---|
| `join()` | Invited member | To be in the circle | Circle never starts; `refundDeposit()` gets money back | **No** |
| `refundDeposit()` | Member of a stalled circle | Wants $100 back | Their own funds sit idle, nobody else affected | **No** |
| `contribute(r)` | Member | Forfeits a **$1,200** turn otherwise | They default; deposit seized; rules handle it | **No** |
| `settle(r)` | Recipient, any member, anyone | Recipient unlocks $1,200; also auto-fires inside `contribute` | Round pot sits; **settles later with identical result** — the math is snapshot-based | **No** |
| `withdraw()` | Recipient | It's $1,200 of their money | Balance waits for them indefinitely. No expiry | **No** |
| `finalize()` | Anyone; auto-fires on last settle | Unlocks deposits + surplus | Deposits wait; anyone can trigger it any time | **No** |
| **Round advance** | **nobody** | derived from `block.timestamp` | n/a — there is no transaction | **No** |

There is no row where the answer is "one of the two of us." That's the design target, and the
two mechanisms that get us there are: **time-derived round state** (no `advanceRound()` cron)
and **pull payments** (recipient claims, contract never pushes).

Apply the hyperstructure test — *could this run forever with nobody behind it?* For the
**contract**, yes. For the **product**, no, and that gap is the real answer.

### 4.2 What actually breaks while you're gone

Ranked by how likely it is to bite you in six weeks.

**1. Nobody sends the reminders. ← the one that will actually cost someone $1,200.**
Missing a payment isn't a warning email, it's a forfeited turn and a seized deposit. Your
members are ordinary people who currently get nagged by a human. Six weeks = one or two rounds
with no nagging. *Fix before you leave:* ship `contributeMany()`, email every active member
telling them to **prepay all remaining rounds now, in one transaction**, and send calendar
invites for each due date as a backstop. A prepaid member cannot default.

**2. The frontend dies and the contract is unreachable.**
The most likely failure by far — expired Alchemy/Infura free tier, a card that declines while
you're abroad, a WalletConnect project ID, a Vercel build that breaks on a dependency bump, an
expiring domain, a subgraph that falls out of sync. The contract is fine and nobody can reach
it. *Fix:* pin an immutable IPFS build behind an ENS name, configure a keyless public RPC
fallback, prepay every bill through the end of the trip, freeze dependencies, and disable
auto-deploy on `main` so nothing rebuilds unattended.

**3. No escape hatch documented.**
When #2 happens, members need to `contribute` and `withdraw` without your UI. *Fix:* publish a
one-page doc — verified contract address, Basescan "Write Contract" walkthrough with
screenshots, the two functions that matter, and the reminder to `approve` USDC first. Send it
to every member *before* you leave, not after something breaks.

**4. An admin key you're carrying is the single point of failure.**
If the deployed contract has `onlyOwner` or `Pausable` and the key lives on a laptop in
transit: a lost phone, a triggered pause with nobody to unpause, or a compromised key while
you're unreachable all become circle-ending. *Fix:* for running circles, **renounce**. If you
must keep a lever, keep it **only on the factory** and only over *creating new circles* —
pausing the front door never touches money already in flight — and hold it in a 2-of-3 Gnosis
Safe whose third signer is someone **not travelling**.

**5. Circles mid-formation get stuck.**
A circle that's 9-of-12 filled when you leave will sit there holding $900 of deposits. *Fix:*
that's what `joinDeadline` + `refundDeposit()` are for. Verify the deployed contract actually
has a permissionless refund path — if it doesn't, those deposits are frozen until you're back.

**6. Base sequencer outage across a due date.**
Historically short, but a multi-hour outage on the 5th with a hard deadline would cause unjust
forfeits. *Fix:* the 25-day cushion between the UI due date and the contract deadline. Verify
your live contract has comparable slack; a tight deadline is the thing to loosen before you go.

**7. A bug is found and nobody is home.**
*Fix:* brief one trusted third person with the escape-hatch doc and a way to reach you for
genuine emergencies; publish a security contact; pause **new circle creation** for the duration
so the blast radius stops growing while you're unreachable.

### 4.3 Verdict

> **The contracts keep running. The product doesn't — unless you spend a day on §4.2
> before you fly.**

Highest-value single action: **get everyone to prepay the rest of the year.** It turns the
whole six weeks into a no-op, and it's a UI change plus an email, not a redeploy.

---

## 5. Diagnostic for the circles already running

I haven't seen that code. Run these five against it — any **yes** is something to fix or work
around before you leave.

1. **Is there a function only you can call that the monthly cycle depends on?** Grep for
   `onlyOwner`, `onlyKeeper`, `onlyAdmin`, `distribute`, `advanceRound`, `nextRound`,
   `processMonth`, Chainlink Automation / Gelato registration. If the pot moves because *you*
   push a button, the circles stop the month you leave. **This is the failure mode this design
   is built to avoid.**
2. **Does the contract `transfer` the pot during settlement, instead of crediting a balance the
   recipient pulls?** If so, one USDC-blacklisted or reverting recipient wedges the whole circle.
3. **Does the current round come from stored state that a transaction must bump,** rather than
   from `block.timestamp`? Stored round state means a cron nobody is running.
4. **Does a mid-formation circle have a permissionless per-member refund after a deadline?**
   If not, those deposits are stuck until you return.
5. **How much slack is there between the due date and the forfeit?** Under a week is too tight
   for an unattended six weeks — one RPC hiccup becomes a $1,200 loss.

If the contract is immutable and #1 comes back yes, you can't patch it. Realistic options:
(a) hand the keeper key to a Safe with a non-travelling third signer and a written runbook,
(b) if an off-ramp exists, wind those circles down and re-form on the fixed design, or
(c) delay the trip's start for those circles. Migrating a *running* circle is not possible
without members exiting and re-joining — which is precisely why running circles should be
immutable and self-driving from round zero.

---

## 6. Build order from here

1. `SusuCircle` + clone factory, per §3. No owner, no pause, no upgrade on the circle.
2. Foundry: unit + fuzz + the balance invariant + Base fork tests.
3. Audit in a fresh agent context.
4. Frontend: switch-network → approve → contribute, **prepay-the-year as the primary CTA**,
   a clear "what happens if I miss" panel, and honest framing of Case B credit risk.
5. Deploy to Base, verify on Basescan, IPFS + ENS for the frontend, index events for history.
6. Before the trip: run the §4.2 checklist end to end.
