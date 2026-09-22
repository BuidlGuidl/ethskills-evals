# Susu — onchain savings circle

12 members · 100 USDC/month · 12 monthly rounds · fixed payout order set at start.

Two questions are answered here: how the contract works, and whether circles that
are already running survive six weeks with neither of you around. The short answer
to the second is **the contract does, the product around it probably doesn't** —
details in the last section.

---

## 1. What goes onchain

Onchain, because it is money and commitment:

- Member set and payout order for a circle (fixed at start, never mutable).
- Every contribution, as a payment, not a record of one.
- The bond (see §3) and its slashing.
- Payout entitlement and the claim.
- Default marks, because they change who gets paid.

Offchain, because it changes or is just presentation:

- Names, avatars, the circle's display name, the "who is this person" context.
- Reminders, emails, push. Best-effort only — see §7.
- Any view of "who has paid this month" — read it from events, don't store a
  dashboard in contract storage.
- History, receipts, PDF exports.

Nothing here needs a score, ranking, or leaderboard in storage. `Contributed`,
`Defaulted`, `PaidOut` events are enough to render everything.

## 2. Contracts

**One.** `SusuCircles` — a single deployed contract holding many circles keyed by
`circleId`.

No factory (one deployment per circle buys nothing and costs you a deploy each
time), no escrow contract (the circle contract *is* the escrow), no fee splitter
(there is no fee). USDC is the existing audited primitive; we use it directly,
no wrapper.

```solidity
struct Circle {
    address[] order;        // payout order, index == round number
    uint64  startTime;      // set when the last member joins
    uint32  period;         // 30 days
    uint128 contribution;   // 100e6 (USDC has 6 decimals)
    uint128 bond;           // 100e6
}

// circleId => round => member => paid?
mapping(uint256 => mapping(uint256 => mapping(address => bool))) public paid;
// circleId => round => USDC collected for that round's recipient
mapping(uint256 => mapping(uint256 => uint256)) public pot;
// circleId => member => bond still posted (0 once slashed or withdrawn)
mapping(uint256 => mapping(address => uint256)) public bondOf;
mapping(uint256 => mapping(address => bool)) public defaulted;
mapping(uint256 => mapping(uint256 => bool)) public claimed;
```

Round number is **derived**, never stored as a cursor someone has to advance:

```solidity
function currentRound(uint256 id) public view returns (uint256) {
    return (block.timestamp - c.startTime) / c.period;   // 0..11
}
```

This one line is most of the answer to the six-week question. There is no
"advance the month" transaction for anyone to forget to send.

## 3. The rule that does not survive contact with a ledger

You wrote: *"If someone misses a payment they forfeit their turn, and their
earlier contributions cover the shortfall for that month's recipient."*

The first half is implementable. The second half is not, as literally stated, and
this is the one place the design has to differ from the kitchen-table version.

In a susu, a member's earlier contributions are **not sitting anywhere**. They were
handed to the recipients of months 1 through 5 the day they were paid. By the time
someone defaults in month 6, there is nothing of theirs left to draw on. A contract
that promises the month-6 recipient a full pot out of the defaulter's past
contributions would be promising money it does not hold. Offchain, the rule works
because the aunt running the circle covers the gap out of her own pocket and
collects later. That aunt is exactly the operator you are trying not to have.

So we make the rule true by construction: **every member posts a one-month bond
(100 USDC) when they join, and it stays in the contract for the whole year.** It is
the only money of theirs that is still in the pot to draw on.

- Miss a payment → your bond is transferred into that month's pot. The recipient
  is made whole. Economically this *is* "your earlier money covers the shortfall" —
  we just had to hold it back instead of assuming it.
- Finish the year clean → your bond comes back. A member who never defaults pays
  1,200 and receives 1,200, same as the paper version. The bond is float, not cost.
- Default → you also forfeit your turn (§4).

**Be clear-eyed about what the bond does not cover.** One bond covers one missed
month. The member who takes the pot in month 1 and disappears has taken 1,100 and
left 100 behind; the remaining eleven rounds each come up 100 short and only the
first is covered. No onchain mechanism fixes this without full collateral (which
defeats the purpose — if you could lock 1,200 you wouldn't need the circle). The
real mitigation is social and it belongs in the product, not the contract:
**order the circle by trust, least-trusted last.** Say that out loud in the UI when
the order is being set. If a family wants stronger protection, the knob is a bigger
bond, and the contract takes it as a parameter for exactly that reason.

## 4. Forfeiting a turn, and what the pot is actually worth

When a member defaults, their scheduled round is **cancelled**, not reassigned:

- In round `r`, everyone active except `order[r]` owes one contribution.
- If `order[r]` has defaulted, that round collects nothing and pays nothing. The
  other eleven simply don't pay that month.
- The payout for round `r` is `pot[r]` — **what the circle actually collected**,
  plus any bonds slashed for that round. Not a hardcoded 1,100.

That last point matters. The contract never promises a number it cannot pay. In a
clean year every recipient gets 1,100 (their own 100 is netted out rather than
cycled through — economically identical to "everyone pays and the pot is 1,200",
one less transfer). In a year with an uncovered default, the loss lands on the
specific recipients whose months were short, and it lands visibly. Any other design
either lies or needs someone with a chequebook.

Consequence worth stating to users: a default late in the year is absorbed by
whoever is still waiting to be paid. That is the same unfairness the paper susu
has; it's just no longer hidden.

## 5. State transitions

Every one of these is called by the person who benefits from it. There is no
owner, no keeper, no cron, no pause, no upgrade proxy.

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `createCircle(members[], contribution, bond, period)` | organizer | wants the circle | no circle exists; **running circles unaffected** |
| `join(id)` — posts bond | each member | reserves their slot; circle can't start without them | circle never starts, bonds already posted are withdrawable via `abortBeforeStart` |
| `abortBeforeStart(id)` | any member who joined | gets their bond back from a circle that never filled | their bond sits in the contract, still theirs, no deadline |
| `contribute(id)` | member | avoids default, keeps their turn, keeps their bond | **they default — deterministically, from the clock alone.** No transaction is needed to mark this |
| `contributeAhead(id, n)` | member | pre-pays up to n future rounds before travelling | nothing; ordinary path still open |
| `claimPayout(id, round)` | that round's recipient | receives the pot | **funds stay in the contract, claimable forever.** No expiry, no forfeiture, no sweep |
| `claimPayoutTo(id, round, to)` | that round's recipient | same, to a different address | as above |
| `withdrawBond(id)` | member, after final round | gets 100 USDC back | it sits there, still theirs, no deadline |

Two properties do the heavy lifting:

1. **Defaults need no transaction.** `paid[id][r][member] == false` after the round
   window closes *is* the default. `claimPayout` settles it lazily: it loops the
   twelve members, slashes bonds for non-payers, marks them defaulted, then pays.
   Twelve iterations is a few thousand gas — no pagination, no keeper.
2. **Rounds are independent.** Round 7's contributions do not require round 6 to
   have been settled or claimed. Nothing queues behind an unclaimed payout. One
   member going silent for six weeks stalls nothing but their own money.

Payouts are **pull, never push**. A single member whose address cannot receive USDC
(§7, blacklist) must not be able to brick anyone else's month.

## 6. Chain and deployment

**Base.** The reason is distribution, not gas price:

- Native USDC issued by Circle — not a bridged variant, so there is no wrapper to
  explain and no depeg story to a family member.
- Coinbase on/off-ramp is where non-crypto relatives can actually get 100 USDC in
  and cash 1,100 out. For a product whose users are chosen by kinship rather than
  crypto-nativeness, that is the whole ballgame.
- Coinbase Smart Wallet (passkeys, no seed phrase) plus paymaster-sponsored gas, so
  a member's monthly action is "approve, confirm," not "acquire ETH first."

Fees are incidental at this size (one transfer a month per person) but **measure
before you deploy rather than trusting a remembered number** — `cast gas-price
--rpc-url $BASE_RPC` and price the `contribute` and `claimPayout` calls from the
Foundry gas report.

Addresses go in `script/addresses.json` and get copied from Circle's and Base's
official docs at deploy time. Do not let anyone paste a USDC address from memory or
from a block-explorer search result — a wrong token address routes every approval
to an attacker.

### Runbook

```bash
# .env
BASE_RPC=https://mainnet.base.org        # plus a paid fallback, see §7
DEPLOYER_KEY=...                          # hot key, deploy only, no ongoing role
BASESCAN_API_KEY=...
USDC=<from Circle's official docs for Base mainnet>

forge test -vvv                           # unit
forge test --fork-url $BASE_RPC --match-path test/fork/*   # against real USDC

forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BASE_RPC --broadcast --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

**Ownership: none.** `SusuCircles` has no owner, no admin role, and no upgrade
path. The deployer key has no ongoing privilege and can be discarded after
verification. This is a deliberate trade — see §7, item 4.

Post-deploy smoke test, on mainnet, before announcing anything:

```bash
# 2-member circle, 1 USDC contribution, 10-minute period — real money, tiny amounts
cast send $SUSU "createCircle(address[],uint128,uint128,uint32)" "[$A,$B]" 1000000 1000000 600 ...
cast send $USDC "approve(address,uint256)" $SUSU 2000000 --private-key $A_KEY
cast send $SUSU "join(uint256)" 0 --private-key $A_KEY
# ... join B, contribute, wait one period, claimPayout, withdrawBond
cast call $USDC "balanceOf(address)" $A        # confirm the money actually moved
```

Do not skip the withdraw legs. "Deposits work" is not the same as "the exit works,"
and the exit is the half nobody can fix for you later.

### Tests that must exist before a real circle starts

- Full clean 12-round cycle; every member nets zero.
- Default before own turn: bond slashed, recipient whole, turn cancelled, later
  rounds collect from 11 not 12.
- Default *after* own turn (take-and-run): loss is bounded to the bond and lands
  on the specific short rounds. Assert the exact shortfall — this is the scenario
  you will be asked about.
- Two defaults in one round, bonds insufficient: payout is reduced, not reverted.
- Claim a payout six months late; claim out of order; claim round 9 before round 3.
- Pay twice in one round → reverts, no double-charge.
- Fork test against real USDC, including a blacklisted-recipient path.

---

## 7. Six weeks with nobody home

**The contract keeps working.** There is no function in §5 that only you can call,
no scheduled job, no cursor to advance, no oracle, no price, no pause. Round number
falls out of `block.timestamp`; defaults are the absence of a transaction; payouts
sit claimable indefinitely. About 1.5 rounds happen while you're away, and all of
it is members transacting with a contract that does not know you exist.

**The product around it is what breaks.** In rough order of how likely it is to
actually bite you:

**1. The frontend and its RPC key. Most likely failure, and it looks like a
contract failure to your users.** If the hosting build expires, the RPC key hits a
monthly quota in week three, the indexer stops syncing, or the domain auto-renew
fails on a card that expired, then members cannot see that they owe 100 USDC and
they will default. The contract will faithfully slash bonds and cancel turns for
people who *wanted* to pay and had no way to.

*Before you go:* check the RPC plan's quota against six weeks of real traffic and
pay for headroom; put two or three RPC endpoints in the client's fallback list, at
least one of them public and keyless; confirm the domain and hosting renewals both
land outside the window; build the frontend as a static export and pin a copy to
IPFS behind an ENS name; and write a one-page "how to pay if the website is down"
with the contract address, the Basescan write-tab steps, and the exact arguments.
Send that page to all twelve people in every running circle *before* you leave, not
as a link to your own site.

**2. Reminders stop, silently.** If notifications come from a free-tier cron, a
GitHub Action whose token expires, or a trial email plan, they will stop and you
won't know. A susu runs on the nudge; a missed nudge becomes a slashed bond.

*Before you go:* make the contribution window the whole month, not a five-day
cutoff, so a missed reminder costs nothing. Tell every member to `contributeAhead`
for the next two rounds before you leave — it's one transaction that makes them
immune to the entire category. And check that no default can ever be *caused* only
by a missing email.

**3. USDC is not neutral infrastructure.** It is upgradeable and it has a
blacklist. A blacklisted address makes `transfer` revert, so that member's
`claimPayout` reverts forever and the pot is stuck; a USDC-wide pause stops
contributions. Neither is fixable by anyone, including you, and neither is
hypothetical enough to ignore for a year-long commitment.

*Mitigation, already in §5:* pull payments so one frozen member cannot brick the
others, and `claimPayoutTo` so they can direct funds to a clean address.

**4. Nobody can fix a bug — and that is the deliberate trade.** With no owner and
no upgrade path, a flaw in the loop math or the bond accounting is unfixable for
six weeks and arguably forever.

The tempting fix is a pause switch or a guardian key. **Don't add one to live
circles.** A key that can move or freeze other people's savings, sitting unattended
for six weeks while you're both unreachable, is a larger risk than the bug it might
one day mitigate, and it re-creates the operator you set out to remove. The right
response is upstream: don't start new circles you haven't tested, keep the member
loop at twelve with no unbounded iteration, and get the §6 test list green — the
take-and-run and insufficient-bond cases especially — before you leave. If you
want any valve at all, scope it to circles that have **not started**
(`abortBeforeStart`, already permissionless and already in the design). Once round
0 begins, the contract is on its own. That's the point.

**5. New circles stop, if creation depends on you.** Running circles are fine.
But if `createCircle` needs a backend to assemble the member list, a whitelist, or
a signed invite from you, then nobody starts a susu for six weeks. That may be
fine — decide it on purpose. If it isn't, make creation fully permissionless
before you leave; it's a smaller change now than in week four.

**6. Support has no one behind it.** Wrong address, lost passkey, "can I swap my
month with my cousin," "I paid and it didn't show." None of these have an onchain
remedy and the true answer is often "nothing can be changed."

*Before you go:* write that FAQ, say plainly which things are permanent, and name
one non-technical person per circle who has the page and can repeat it. Set the
support inbox to an autoresponder with a real return date rather than silence.

**7. Base sequencer downtime near a deadline.** A month-long window makes a
multi-hour outage harmless. This is a second reason not to use a tight cutoff.

**8. Calendar drift.** A 30-day period drifts off the calendar month — by round 12
the "monthly" payment is about five days early, and no one can adjust it. Not a
bug; just say so in the UI and show the actual next deadline rather than "the 1st."

### The honest summary

Running circles survive six weeks **because of specific design choices** — derived
round numbers, no settlement cursor, lazy default handling, pull payouts with no
expiry, no admin. Keep those and the money is safe without you.

What won't survive on its own is everything that tells a member it's time to pay.
The work before you leave is not contract work: pre-pay, pre-notify, publish the
no-frontend fallback, buy RPC headroom, and check your renewal dates. Budget a day
for it.

The bond in §3 is also load-bearing here and worth re-reading before you commit to
it — it's the difference between "their earlier contributions cover the shortfall"
being a rule the contract enforces and being a promise someone has to keep.
