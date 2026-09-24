# Susu — onchain savings circle

## 0. What I could and couldn't see

This repo contains only `TASK.md` and an empty `package.json`. There is no contract
source for the circles that are already running, so I can't tell you directly whether
*your* deployed code survives six weeks unattended.

So this document does two things:

1. **The design** — how I'd build it, with the unattended-operation requirement treated
   as a first-class constraint rather than an afterthought.
2. **The answer to your actual question** — a concrete test you can run against the
   deployed contract in an afternoon (§5), what breaks under each failure mode, and what
   to do about it before you leave (§6, §7).

If you paste the deployed contract (or an address) I can run §5 against it for real
instead of leaving it as a checklist.

---

## 1. The rule that doesn't work as written

> "If someone misses a payment they forfeit their turn, and their earlier contributions
> cover the shortfall for that month's recipient."

In a pure flow-through contract this is not implementable, because **the earlier
contributions are already gone**. Month 1's $1,200 went to month 1's recipient. When a
member misses their payment in month 5, there is no pile of their past money sitting in
the contract to draw from — every dollar they paid in months 1–4 was paid out to the
recipients of months 1–4 the day it arrived.

The rule works in your family because the ledger is social: the defaulter's past money
"covers" the shortfall in the sense that everyone agrees they've lost it, and somebody
fronts the cash this month. A contract can't front cash.

Worse, the rule protects you least against the failure that actually happens. Consider
the member who receives the pot in **month 1** and then stops paying. They've
contributed $100. They've taken $1,200. Their "earlier contributions" cover exactly one
month of the eleven they now owe. The forfeiture penalty is strongest against
late-position members (who need it least, since they've paid the most and taken
nothing) and nearly zero against early-position members (who have the most reason and
the most opportunity to walk).

This is the fundamental ROSCA problem and it isn't solved by moving onchain — onchain
makes it *harder*, because you lose the social collateral that made the informal version
work. You have three honest options:

| Option | What it means | Cost |
|---|---|---|
| **A. Accept the credit risk, size it, disclose it** | Small bond (one month) + the contract never promises a pot it doesn't hold | A recipient can receive less than $1,200 |
| **B. Full collateral** | Members escrow their whole remaining obligation up front | Defeats the point — nobody needs a susu if they already have the money |
| **C. Position-priced bonds** | Early slots require a bigger bond (slot 1 posts ~$1,100, slot 12 posts ~$100) | Turns it into a lending product; kills the "order is fixed, everyone's equal" feel |

**I recommend A**, because this is a family circle where the real collateral is that
these people see each other at Thanksgiving. But the contract must be built so that the
disclosure is structural, not a sentence in a README:

> **Core invariant: the recipient receives what the contract actually holds for that
> round. The contract never promises $1,200.**

That single decision removes an entire class of failures. A contract that promises a
fixed $1,200 payout has to revert, stall, or go insolvent when $1,200 isn't there —
and a stall while you're both on a plane is exactly the scenario you're asking about.
A contract that pays out the round's balance always has a valid next state.

---

## 2. Contract design

### 2.1 Shape

- **One immutable contract per circle**, deployed by a minimal-proxy factory.
- **No owner. No pause. No proxy. No upgrade path.** Non-negotiable — see §4.
- The factory has zero privileges over deployed circles; it only clones and indexes.
- Solidity ^0.8.24, OpenZeppelin `SafeERC20` + `ReentrancyGuard`, nothing else.

### 2.2 State

```solidity
// all immutable, set at deploy
IERC20  public immutable token;          // USDC
uint256 public immutable contribution;   // 100e6
uint256 public immutable bond;           // 100e6 (see §1)
uint256 public immutable roundLength;    // 30 days
uint256 public immutable startTime;
uint8   public immutable memberCount;    // 12
address[] public order;                  // payout order, fixed at start

struct Member {
    bool    enrolled;
    bool    defaulted;     // missed a round -> turn forfeited, permanently
    bool    bondPosted;
    uint256 credit;        // prepaid / unspent funds, usable for future rounds
}
mapping(address => Member) public members;

mapping(uint8 => uint256) public roundCollected; // round => USDC received
mapping(uint8 => bool)    public roundClosed;
mapping(address => bool)  public paid[round];    // (nested mapping, elided)

uint256 public reserve;                          // bonds + forfeited credit
mapping(address => uint256) public claimable;    // pull-payment balances
```

### 2.3 Lifecycle

**Enrollment** (before `startTime`): each member calls `join()`, transferring
`bond`. Once all 12 slots are filled and `startTime` passes, the order is frozen and
the contract is closed to changes forever. If the circle isn't full by `startTime`,
`abort()` becomes callable by anyone and every joiner pulls their bond back.

**Round `r`** runs from `startTime + r*roundLength` to `startTime + (r+1)*roundLength`.
The entire month is the payment window — there is no narrow settlement window to miss
(§6.6).

- `contribute(uint8 r)` — **push model**. The member sends their own USDC. Accepts
  payment for the current round or **any future round** (prepay; see §6.2 — this is the
  single most useful feature for your situation).
- Contributions land in `roundCollected[r]`. Prepayments for a round further out are
  held in `credit` and swept into the round when it opens.

**Closing round `r`** — `closeRound()`, callable by **anyone**, any time after the
round's window ends:

1. If `order[r]` is already `defaulted`, the round is a **skip**: no contributions were
   due, no payout, no defaults recorded. Advance. (The calendar does not compress —
   the circle still ends at a fixed date, and every remaining member's obligation drops
   by one month, which is the fairest cheap allocation of the defaulter's absence.)
2. Otherwise, mark every enrolled, non-defaulted member who didn't pay round `r` as
   `defaulted`. Their `bond` and any unspent `credit` move into `reserve`. Their turn is
   forfeited forever. (This is the family rule, made real: the thing that funds the
   shortfall is money the contract is actually still holding.)
3. `pot = roundCollected[r] + min(reserve, contribution*memberCount - roundCollected[r])`
   — top up from reserve, never above a full pot.
4. `claimable[order[r]] += pot`. **Do not transfer here.**

**Claiming** — `withdraw()` transfers `claimable[msg.sender]`. Pull payments, CEI
ordering, `nonReentrant`.

**Final settlement** — after the last round closes, non-defaulted members reclaim their
bond and split any remaining `reserve` pro rata. Defaulters get nothing; their prior
contributions are the penalty, exactly as in the family version.

### 2.4 Design decisions worth defending

**Permissionless close.** Nothing in the happy path requires you, a keeper, a backend,
or a key. The state is a pure function of `block.timestamp` and who has paid. The
recipient is the person most motivated to call `closeRound()` and they can — this is
the property that answers your six-week question.

**Late close is harmless.** If nobody calls `closeRound()` for three weeks, the round
closes correctly when someone eventually does — the default set is determined by the
window that already elapsed, not by when the call happens. A quiet contract is not a
broken contract.

**Pull payments, never push.** If round settlement pushed USDC to the recipient, one
recipient who got blocklisted by Circle, or whose wallet is a contract that reverts on
receive, would revert `closeRound()` and **brick the circle for all twelve people**. With
pull payments that member simply can't withdraw; everyone else is unaffected. This is
the difference between one person's problem and a stalled circle you can't fix from
abroad.

**Push contributions, not `transferFrom` pulls.** If the contract pulls with
`transferFrom`, every member needs a live allowance every month. Members who approved
exactly $100 once will silently fail to pay in month 2 and get marked as defaulters
through no fault of their own — and with you unreachable, that's unrecoverable. Having
the member initiate removes the allowance-staleness failure entirely.

**The pot is variable.** Covered in §1. It also means `closeRound()` has no revert path
on the money side.

**No emergency withdraw / no rescue function.** Tempting for a six-week absence, but it
is a key that can drain the circle, held by people who are not reading their phones. The
permissionless close is what makes it unnecessary: there is no state the contract can
reach where the money is stuck pending a human.

**Events on everything** (`Joined`, `Contributed`, `RoundClosed`, `Defaulted`,
`Skipped`, `Claimed`, `Settled`) so the frontend and the indexer can be rebuilt from
chain data by someone who isn't you.

---

## 3. The test for "does it survive unattended"

A circle keeps running with nobody watching **if and only if** all four hold:

1. **Every state transition is callable by someone who wants it to happen** — not by an
   owner, a keeper, or a backend signer.
2. **No happy path touches an admin key.**
3. **Every offchain dependency is a convenience.** If the frontend, the RPC provider, the
   indexer and the reminder bot all die on the same day, members must still be able to
   pay and get paid.
4. **Money can always leave.** There is no reachable state where funds are stuck pending
   a human decision.

The design in §2 satisfies all four by construction. **Most first drafts of this contract
do not**, which is why §5 matters more than §2.

---

## 4. Answer: probably not, and here's the specific shape of "no"

The contract logic is the part most likely to be fine. The things that break in a
six-week absence, in rough order of likelihood:

### 4.1 The layer that almost certainly breaks: everything that isn't the contract

Six weeks is long enough for all of these, and none of them are hypothetical:

- **RPC key** hits a rate limit or a free-tier monthly cap and the frontend goes blank.
  Nobody can pay. Everyone assumes the circle is dead.
- **Frontend hosting** — a preview deploy expires, a build fails on a dependency bump, a
  domain or an SSL cert lapses.
- **Indexer/subgraph** falls out of sync or gets deprecated; the UI shows wrong balances,
  which is worse than showing none because people act on it.
- **WalletConnect project ID / API keys** rotate or expire.
- **The monthly reminder** — if "ping everyone on the 1st" is currently a thing one of
  you does by hand, it stops. Members who would have paid will miss, and under your rules
  a missed payment is *permanent forfeiture of their turn*. That's a real financial loss
  to a family member caused by your vacation.
- **Nobody notices.** No alerting means a problem in week 1 is discovered in week 7.

### 4.2 The contract-level breaks — check these first (§5)

If any of the following are true of the deployed code, **the live circles do not
survive** and you have a hard problem, not a soft one:

- `closeRound()` / `payout()` / `startNextRound()` is `onlyOwner` or gated to a keeper
  address → **the circle halts on the first month boundary after you leave.** Money sits
  in the contract; nobody gets paid; the next round can't open.
- A backend cron signs the settlement transaction → same halt, plus the key is sitting on
  a server nobody is patching for six weeks.
- The contract is behind a **proxy with an EOA admin** → six weeks of an unwatched
  upgrade key controlling everyone's savings. Even if nothing happens, this is the
  largest risk on the list.
- `onlyOwner pause()` exists and can block withdrawals → one compromised or fat-fingered
  call and the funds are frozen until you land.
- Settlement **pushes** USDC to the recipient → one bad recipient address bricks the
  round permanently.
- Contributions are pulled via `transferFrom` → allowance staleness silently creates
  defaulters (§2.4).
- A round closes in a **narrow window** (e.g. "must be settled on the 1st") → an L2
  sequencer outage or a busy day turns honest members into defaulters.
- The payout is a **fixed** `1200e6` transfer → the first default makes `closeRound()`
  revert on insufficient balance and the circle halts.

### 4.3 The break you cannot engineer away

Someone loses a wallet, bridges USDC to the wrong chain, or pays a day late because
they were in hospital. In the family version, you talk about it. Onchain with no admin,
nothing can be done — and that is the *correct* design, but only if everyone knows it in
advance. Tell the members before you go: **there is no undo, and for six weeks there is
no one to ask.** A named human who can at least answer "what happened" is worth a lot
even if they can't change anything.

---

## 5. Do this first: audit the deployed contract (half a day)

Against the verified source of the live circles:

```
grep -nE "onlyOwner|owner\(\)|Ownable|_pause|whenNotPaused|upgradeTo|initializer" Susu.sol
```

1. List every state-changing external function and, for each, **who can call it**. Any
   function on the happy path that isn't callable by an interested member is a halt.
2. `getAdmin()` on the proxy, if there is one. Who holds it? Where is that key?
3. Does settlement `transfer` to the recipient, or credit a `claimable` balance?
4. Do contributions use `transferFrom`? If so, check each live member's current USDC
   allowance to the contract — anyone with `allowance < remaining obligation` is a
   default waiting to happen.
5. Is the payout amount fixed or derived from the balance?
6. Fork-test the live circles at current state: roll time forward six weeks with **no
   transactions from your addresses at all**, and assert that each round still closes
   and each recipient can withdraw. This is the whole question, answered empirically.

---

## 6. Remediations, in the order I'd do them

### 6.1 If the audit is clean

Do §6.2–§6.6 and go. The circles are fine.

### 6.2 Ship prepayment (highest value, lowest risk)

Let members pay several months at once. If every member prepays their next two rounds
before you leave, the unattended window has **no required member action at all** — the
only thing that has to happen is a permissionless `closeRound()`, which the recipient
will happily call because they're the one getting paid.

If the deployed contract can't accept prepayment, this can be approximated socially: ask
everyone to set a calendar reminder and confirm they've paid, before you go.

### 6.3 If a trigger is admin-gated — three options, ranked

1. **Don't ship a new contract on your way out the door.** Migrating live circles days
   before a six-week absence is how you turn a halt risk into a loss. Only migrate if you
   have a week of runway to watch it, and migrate one circle first.
2. **Make the trigger redundant.** Automation (Gelato / OZ Defender / Chainlink
   Automation) *plus* the key held by one named, briefed person *plus* alerting. Fund the
   automation for 10 weeks, not 6, and verify the gas balance the day you leave. Scope the
   human's key to the narrowest role the contract allows — a settle-only role, never the
   proxy admin.
3. **If neither is possible, pause new rounds and say so.** Tell members the cycle
   resumes on your return. A deliberate, announced pause beats a silent halt where twelve
   people are wondering where their $1,200 is.

### 6.4 Make the offchain layer optional

- Verify every live contract on Etherscan/Blockscout, so paying via the block explorer
  works when the frontend doesn't.
- Write a one-page **"how to pay without our app"** — contract address, function,
  amount in base units (`100000000`), screenshots — and send it to all twelve members.
- Pin a static fallback frontend to IPFS with a public RPC endpoint hardcoded.
- Check every API key's quota and expiry against a 10-week horizon.

### 6.5 Alerting, so someone notices

Tenderly or Defender alerts to both your phones *and* one person who isn't travelling:
round not closed within 48h of its deadline; any `Defaulted` event; any contract balance
change outside the expected pattern; any admin-role or upgrade event (should be zero).

### 6.6 Widen every time window

Contribution window = the full month. Closing = any time after the deadline, forever. No
transition should have a deadline measured in hours; sequencer outages, holidays, and
travel all exist.

---

## 7. Pre-departure checklist

- [ ] Audit per §5, including the six-week no-touch fork test
- [ ] Every happy-path transition is permissionless, or §6.3 is fully in place
- [ ] Proxy admin (if any) moved to a multisig, or the contract frozen
- [ ] Payouts are pull-based; no fixed-amount push
- [ ] Automation funded for 10 weeks; balance verified on departure day
- [ ] All API keys / hosting / domains verified good past your return date
- [ ] Alerts firing to at least one person who is not on a plane
- [ ] "How to pay without the app" sent to all members, receipt confirmed
- [ ] Members told, in plain words: no undo, no admin, no support for six weeks
- [ ] Prepayment offered (§6.2) and ideally taken up by everyone
- [ ] Nothing new deployed in the final week

---

## 8. Build order for the contract itself

1. `SusuCircle` with the §2 state machine; no owner, no pause, no proxy.
2. Foundry tests: happy path; default in month 1 / month 6 / month 12; the early-receiver
   walkaway (assert the loss lands where §1 says it does, spread across post-default
   recipients); skipped round; blocklisted recipient can't brick others; late
   `closeRound()`; reentrancy on `withdraw()`.
3. Invariant tests: contract balance ≥ sum of `claimable` + `reserve` + unswept credit;
   no member receives more than one pot; a defaulted member never becomes undefaulted.
4. `SusuFactory` (minimal proxy, no privileges).
5. Frontend last, and built so that losing it is an inconvenience rather than an outage.
