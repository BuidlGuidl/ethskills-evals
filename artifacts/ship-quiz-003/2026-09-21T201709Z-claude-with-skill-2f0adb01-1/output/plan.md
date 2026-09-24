# Onchain Susu — Contract Design & Six-Week Absence Review

**Date:** 2026-09-21 · **Away window:** ~2026-09-21 → ~2026-11-02 (42 days)

---

## TL;DR — the answer to your actual question

**The circles keep running while you're gone if, and only if, no state transition in
the contract requires you.** That is a design property, not a hope. It is achievable
here, because the most valuable action in the system — taking the $1,200 pot — is
performed by the person who wants it most. If the recipient pays their own gas to pull
their own pot, the circle needs no team, no bot, and no cron job for twelve months.

Four things, if present in your current contracts, break that. Grep for them today:

| If your contract has… | What happens while you're away |
|---|---|
| `onlyOwner` on `distribute()` / `advanceRound()` / `nextMonth()` | **Hard stall.** 42 days spans 1–2 payouts. Every running circle freezes at the first month you're not there to poke it. Funds are safe but locked until you land. |
| A `for` loop that *pushes* USDC to members | **Random failure.** One blacklisted or reverting recipient bricks the whole distribution for everyone in that circle. Needs a code change to fix — you can't ship one from a plane. |
| A claim **deadline** or expiry on the pot | **Silent loss.** A recipient on holiday misses the window; the pot goes somewhere, or nowhere, and only you can adjudicate. |
| `Pausable` with a 1-of-2 EOA guardian | **The worst case.** Anyone or anything triggers a pause and there is nobody to unpause. ~$14k per circle frozen for six weeks. |

If your contracts are clean of all four, the answer is: **yes, they run untouched.**
What does *not* survive your absence is listed in §6 — and none of it is the contract.
It's the frontend, the RPC key, and the human exceptions.

One correction to the spec before the design, because it changes the code: **"their
earlier contributions cover the shortfall" cannot work as literally stated.** In a
susu, each month's $1,200 is paid out in full — so by month 6 a member's five earlier
$100 contributions are already gone, sitting in recipients 1–5's wallets. There is no
pile of their money left to draw on. The only way to make that rule real onchain is
collateral held back from the start. §3 uses a **$100 bond posted at join, refunded at
the end if you never miss.** That covers exactly one missed month per member, which is
what the family rule actually needs. Flagging it rather than quietly redefining it.

---

## 1. Architecture

**One contract.** `SusuCircles.sol` — a registry holding many circles in internal
accounting, not a factory deploying one contract per circle. Twelve people and $14k
do not justify a deployment per circle, and one contract keeps every circle's USDC in
a single balance with per-circle ledgers. No token, no governance, no upgrade proxy.

**Onchain:** the member roster, the fixed payout order, who paid which month, bonds,
and the pot transfers. All of it is trustless value transfer and permanent commitment
— textbook onchain.

**Offchain:** names, phone numbers, reminder texts, the group chat, "who is Auntie
Ama in this list". Nicknames and notifications are a database problem. The contract
should never know a display name.

**Chain: Base.** Not for cost — mainnet at ~$0.004 a transfer would be fine at a
$100 ticket. For **onboarding**: your users are family, not DeFi natives. Base gives
you Coinbase fiat→USDC→app in one app they may already have, native USDC (not a
bridged variant), and Smart Wallet / passkey accounts so an aunt doesn't have to
manage a seed phrase to receive $1,200. That distribution advantage is the actual
product constraint. Transfers run ~$0.0003.

---

## 2. State transition audit — the whole point

Every function, with the question that matters answered for each.

| Function | Who calls it | Why they would | If nobody ever calls it |
|---|---|---|---|
| `createCircle(members[], amount, period)` | Any member, once, at setup | They want the circle | No circle exists. Harmless. |
| `joinAndBond(id)` | Each of the 12, from their own wallet | Can't participate otherwise | Circle never starts; §3 lets everyone pull their bond back. |
| `contribute(id)` | Each member, monthly | Keeps their turn and their bond | *They* default. Contained, by design — see §3. |
| `claim(id, round)` | That round's recipient only | **$1,200.** | That one pot waits, forever, for them. Nothing else is blocked. |
| `withdrawRefund(id, round)` | Any contributor to a forfeited round | Gets their own $100 back | Their own money waits for them. |
| `withdrawBond(id)` | Any member who finished clean | Gets their $100 bond back | Their own money waits for them. |

There is no seventh row. **No owner, no pause, no upgrade, no keeper, no admin.**
That is what makes the six-week answer a "yes".

Two design moves do most of the work:

**Time is read, never poked.** The current round is a pure function of the clock:

```solidity
function currentRound(uint256 id) public view returns (uint8) {
    Circle storage c = circles[id];
    if (block.timestamp < c.startTime) return 0;
    uint256 r = (block.timestamp - c.startTime) / c.period + 1;
    return r > c.size ? c.size + 1 : uint8(r); // size+1 == finished
}
```

Months advance because time passes, not because someone paid gas to say so. There is
nothing to forget to call. A stored `currentRound` counter incremented by a monthly
transaction is the single most common way this design dies while you're on a plane.

**Defaults are settled lazily, inside `claim()`.** Nobody will ever pay gas to mark
someone else delinquent — that's an unfunded transition and it will simply never
happen. So don't make it a transition. The recipient, who is already motivated by
$1,200, does the accounting as a side effect of getting paid:

```solidity
function claim(uint256 id, uint8 round) external nonReentrant {
    Circle storage c = circles[id];
    require(msg.sender == c.order[round - 1], "not your turn");
    require(currentRound(id) > round, "round not over");   // window must be closed
    require(!claimed[id][round], "already claimed");
    require(!defaulted[id][msg.sender], "turn forfeited");

    uint256 pot = roundFunded[id][round];
    for (uint256 i = 0; i < c.size; i++) {                 // bounded: 12
        address m = c.order[i];
        if (paid[id][round][m] || defaulted[id][m]) continue;
        if (bond[id][m] >= c.amount) {                     // bond covers the gap
            bond[id][m] -= c.amount;
            pot += c.amount;
        }
        defaulted[id][m] = true;                           // forfeits their turn
        emit Defaulted(id, round, m);
    }

    claimed[id][round] = true;                             // effects…
    emit Claimed(id, round, msg.sender, pot);
    IERC20(c.usdc).safeTransfer(msg.sender, pot);          // …then interaction
}
```

The loop is bounded at 12 — a circle size, not an unbounded array. `size` is capped
at 32 at creation so this can never exceed the gas limit.

---

## 3. The rules, made precise

Immutable once the circle starts. No admin can alter any of it.

- **Bond.** $100 USDC at `joinAndBond`, on top of the monthly $100. Refunded in full
  after round 12 to anyone who never missed. This is the money that makes "earlier
  contributions cover the shortfall" actually true.
- **Start.** The circle starts only when all 12 have bonded from their own wallets.
  If they haven't by `startDeadline`, anyone can `abort` and each member pulls their
  own bond back. **This one rule kills your biggest support-ticket class** — a typo'd
  address in the roster can never reach a live circle, because a typo'd address can't
  sign `joinAndBond`. An immutable contract with a wrong member address is otherwise
  a $1,200 pot sent into the void that only a redeploy fixes.
- **Contribution window.** Round N accepts `contribute` only during round N's 30 days.
  No retroactive payment after settlement. Deterministic, no judgment call, nobody has
  to decide whether a late payment counts.
- **Default.** Miss a month → bond covers that month's recipient, you're marked
  `defaulted`, you forfeit your turn, you owe nothing further and receive nothing
  further. Your bond is gone.
- **A forfeited turn.** If a defaulted member's month arrives, nobody can claim that
  pot. Each contributor to that round pulls their own $100 back via `withdrawRefund`.
  No windfall, no lost money, no admin decision, no push loop.
- **The honest part:** after a default, later rounds have 11 payers, so later
  recipients receive $1,100, not $1,200. Making every recipient whole regardless would
  require full $1,200 collateral upfront, which defeats the purpose of a susu. Late
  positions carrying more risk is inherent to every ROSCA ever run; the contract's job
  is to make it visible and automatic, not to pretend it away. Surface the shortfall
  prominently in the UI at join time.

**Safety basics:** `SafeERC20` throughout; USDC is **6 decimals** so `amount` is
`100e6`, never `100e18`; checks-effects-interactions plus `ReentrancyGuard` on every
function that moves tokens; an event on every state change; the USDC address is
immutable per circle.

**Per-round isolation is load-bearing.** Round 7's claim touches no state that round 8
needs. If a recipient is USDC-blacklisted, loses their keys, or is simply away longer
than you are, their pot sits and everything else proceeds. No head-of-line blocking
anywhere in the system.

---

## 4. Hyperstructure check

> *Could this run forever with no team behind it?*

For a circle already started: **yes.** Every transition is funded by the self-interest
of the person who benefits from it, the clock advances itself, and there is no
privileged key anywhere in the contract. If both of you vanished permanently — not for
six weeks — every running circle would still pay out all twelve months correctly.

For *new* circles: also yes at the contract level, but a new group can't discover or
join without a working frontend. That is the real dependency, and it's §6.

---

## 5. Before you leave — build/verify order

1. **Audit the existing deployed circles against the four-row table in the TL;DR.**
   Do this first; it's the only item that's actually urgent. `grep -rn "onlyOwner\|
   Pausable\|deadline\|for (" src/`.
2. Foundry tests: happy path all 12 rounds; default in round 1 / mid / last; two
   defaults; defaulter's own turn arrives; recipient never claims; claim out of order;
   double claim; non-recipient claims; abort before start. Fuzz the round math across
   the full timestamp range.
3. Fork test on Base against **real USDC** — 6 decimals, and confirm behaviour against
   a blacklisted address.
4. `slither .`
5. **Hand the code to a fresh agent with `audit/SKILL.md`** — a separate context, no
   memory of having written it. Worth the hour before you're unreachable for six weeks.
6. Deploy, verify on Basescan. There's no owner to hand to a multisig, which is the
   point.

---

## 6. What actually breaks while you're gone

The contract is fine. These are not, and they're what you should spend today on.

**Infrastructure — the real risk.** Six weeks is long enough for an Alchemy free-tier
key to hit its limit or rotate, a WalletConnect project to lapse, a Vercel build to
fail on a transitive dependency bump, a domain to auto-renew against an expired card,
or a subgraph to fall over. A live contract nobody can reach is indistinguishable from
a dead one for your users. Before you go: pin the frontend to IPFS and point an ENS
name at it, hard-code a public fallback RPC, freeze the dependency lockfile, disable
auto-deploy on `main`, and check every API key's expiry and quota against the
2026-11-02 date.

**The escape hatch.** Write one page — "how to contribute and claim from Basescan
directly" with the contract address and exact function arguments — and put it in the
group chat before you leave. If the frontend dies, the circles still work; people just
need to know that, and how.

**Human exceptions — genuinely unfixable, and that's fine.** A member dies. Two people
want to swap turns. The group agrees to forgive a late payment because of a hospital
bill. None of this can be automated and none of it should be: an admin function that
could reassign turns is a rug vector that would be live 24/7 to protect against a rare
event. These stay social. Tell your circles plainly before you leave: *the contract
will run the rules exactly as written for the next six weeks, and we cannot override
it for anyone.* People running a susu already understand that — it's how the offline
version works too.

**Base sequencer downtime.** Historically hours, not days. Contribution windows are 30
days and claims never expire, so an outage is a non-event. Long windows are what buy
you that immunity — another reason not to add deadlines.

**Support.** Somebody will message you. Nothing they message about will be fixable by
you, which is the design working as intended. Set an autoresponder pointing at the
escape-hatch page.

---

## 7. One thing to consider changing before you leave

Nothing in this design needs it — but if you're nervous, the highest-value 30 minutes
is **not** a guardian pause. It's writing §6's escape-hatch page and pinning the
frontend to IPFS. A pause you can't lift from a plane is strictly worse than no pause:
it converts a UI outage into $14k frozen per circle with no one holding the key.

If you want *some* emergency lever, the only safe shape is one that affects **new**
circles only — a flag that blocks `createCircle` while leaving every in-flight circle
untouchable. Even that, I'd skip for six weeks.
