# Susu (ROSCA) onchain — design + six-week absence assessment

Written 2026-09-21. There is no contract source in this repo, so Part 1 is the
design as I'd build it and Part 2 answers the absence question against that
design, with a concrete audit you can run against whatever is actually deployed.

---

## Part 0 — The honest headline

**The contract can keep running unattended for six weeks. Almost nothing else
will.** A correctly built circle needs no operator: rounds advance on a clock,
money moves only when a member calls a function, and defaults resolve lazily.
What breaks while you're gone is the RPC key, the frontend build, the deadline
that nobody can extend, the person who sends USDC to the contract address
instead of calling `contribute()`, and the admin key that one of you is holding
on a laptop in another timezone.

There is also a design problem worth surfacing before anything else, because it
determines what "keep working" even means. See Part 1.2.

---

## Part 1 — Contract design

### 1.1 Shape

One immutable contract per circle, deployed as an EIP-1167 minimal clone from a
`SusuFactory`. Per-circle isolation means a bug or a stuck member in one circle
cannot touch another, and it keeps accounting trivially auditable. No proxy on
the circle itself (see §1.7).

```
SusuFactory
  createCircle(token, contribution, period, graceWindow, members[], bondBps)
    -> clone, emits CircleCreated
  pause()   // stops NEW circles only; cannot touch running ones
```

Immutables per circle: `token` (USDC), `contribution` (100e6), `n` (12),
`period` (30 days — fixed length, not calendar months), `grace`, `members[]` in
payout order, `startTime`.

### 1.2 The part the stated rules don't cover

> "If someone misses a payment they forfeit their turn, and their earlier
> contributions cover the shortfall for that month's recipient."

This is solvent in a family circle and insolvent onchain, for two reasons:

1. **Earlier contributions have already been paid out.** Every dollar collected
   in month k goes to month k's recipient. When Dana defaults in month 5, there
   is no pot of Dana's past money sitting anywhere — it's in months 1–4's
   recipients' wallets. "Their earlier contributions cover the shortfall" is an
   accounting narrative, not a balance.
2. **A default is not a one-month event.** Dana defaulting in month 5 leaves
   *every* remaining month short $100, not just month 5. Even if you had held
   her four prior payments ($400) in escrow, it covers four of the eight
   remaining months.

And the worst case is the opposite direction: a member takes the $1,200 pot in
month 1 and never pays again. Their "earlier contributions" total $100. The hole
is $1,100. Offchain, the family enforces this. Onchain, nothing does.

**So: collateral is not an optional hardening step, it is the product.** The
exposure a member represents is exactly `(months they still owe) − (months
they've paid, if they haven't received yet)`, which at circle start is
`(n − position) × contribution` — $1,100 for slot 1, $0 for slot 12.

Three ways to price it, pick per circle at deploy:

| `bondBps` | Bond for slot 1 | Property |
|---|---|---|
| 10000 (100%) | $1,100 | Fully trustless, zero loss possible, but locks $6,600 across the circle and kills the credit benefit that makes a susu useful |
| ~2500 | $275 | Covers ~3 months of one default; residual loss is real and must be shown in the UI |
| 0 | $0 | Pure trust circle. Legitimate for actual family. Must be labelled as such |

Bond is position-scaled: `bond_i = (n − pos_i) * contribution * bondBps / 10000`.
Deposited at join, returned at circle end if never delinquent. This also makes
the value of an early slot explicit and priceable, which is the right primitive
if you ever want slot auctions.

**Recommendation:** ship `bondBps` as a required deploy parameter with no
default, and make the creation UI print the literal sentence "if one member
defaults after taking the pot, members later in the order can lose up to $X."
Family circles will choose a low number knowingly. Public circles must be at
10000 or you are running an undercollateralized lending protocol by accident.

### 1.3 Residual loss is shared pro-rata, not first-come-first-served

The naive implementation pays each claimant whatever is in the contract, so
early recipients get whole pots and the last recipient eats the entire loss.
That is the single most unfair possible allocation and it is what you get by
default if you don't think about it.

Instead: each round's claim pays `min(available, target)` and records any
shortfall in `deficit[member]`. At circle end, everything left — unused bonds of
delinquents, seized collateral, dust — is distributed pro-rata against recorded
deficits. Everyone who lost, lost the same percentage.

### 1.4 Lifecycle — every step is permissionless

```
FORMING
  join()                 member deposits bond; anyone may call joinFor()
  start()                callable by ANYONE once all n bonds are in; sets startTime
  abort()                callable by ANYONE after formingDeadline; refunds all bonds

RUNNING  (round r = (block.timestamp - startTime) / period, derived, never stored)
  contribute()           pays current round
  contributeFor(member)  pays on someone else's behalf — see §2.3
  prefund(months)        escrow N months up front; rounds auto-debit — see §2.3
  claim(r)               recipient pulls their pot after round r's grace window
  settle(r)              callable by ANYONE; marks non-payers delinquent, seizes
                         bond into reserve, credits reserve to round r's recipient
                         (also runs implicitly inside claim(r))

ENDED
  finalize()             callable by ANYONE after the last round
  withdraw()             each member pulls bond refund + pro-rata deficit share
```

The rule that makes the absence question answerable: **no function on the
monthly critical path, and no function on the path to the terminal state, has an
access modifier.** No `onlyOwner`, no keeper, no cron, no bot, no multisig. Time
advances rounds; users move their own money.

### 1.5 Default handling

At `settle(r)`, after the grace window:
- Anyone who didn't pay round r is marked `delinquent`, loses their future turn,
  and their bond is seized into `reserve`.
- Round r's recipient is paid `min(collected + reserve, n * contribution)`;
  the balance goes to `deficit[recipient]`.
- `activeCount--`. Delinquents are not asked to contribute again.
- If round r's scheduled recipient is themselves delinquent, the round is a
  **skip**: no contributions are due, nothing is claimable, the clock still
  advances. Honest members save a payment rather than paying into a void.
- A delinquent who already received their pot keeps it. Their bond is seized.
  Whatever remains uncovered is the loss Part 1.2 is about. There is no clever
  mechanism that makes it disappear.

### 1.6 Token handling

- `SafeERC20` everywhere. USDC's `transfer` predates the bool-return convention
  on some deployments; don't assume.
- Token is immutable per circle. No fee-on-transfer or rebasing tokens.
- **Circle can blacklist addresses.** If a member is blacklisted, a push-payment
  design bricks the whole circle. Pull-based `claim()`/`withdraw()` contains the
  damage to that one member's own funds. This is a second, independent reason
  the design is pull-only.
- Contributions are credited by an internal ledger inside `contribute()`. A raw
  USDC transfer to the contract address credits nobody. This *will* happen and
  it will happen while you're away — see §2.6.

### 1.7 Upgradeability and keys

Circle logic is **immutable**. The factory has a `pause()` that only blocks new
circle creation and provably cannot touch a running circle's funds — the running
circles don't read the factory after construction.

This is a deliberate trade: you give up the ability to fix a running circle in
exchange for the guarantee that no key anywhere can drain one. Before you leave
for six weeks, that trade is strongly the right one. A 1-of-1 upgrade key on
twelve live circles, unattended, is a worse risk than any bug it could fix.

The factory pause key goes on a 2-of-3 Safe: you, your co-founder, and one
trusted third person who is *not* travelling.

---

## Part 2 — Do the running circles survive six weeks?

Six weeks = 42 days. With 30-day rounds every running circle crosses **one**
round boundary, and a circle whose boundary falls in the first ~12 days crosses
**two**. So the blast radius is 1–2 settlements per circle — but a bad settlement
is unrecoverable and compounds for the rest of the year.

### 2.0 First, verify the claim

Before trusting any of this, run this against the *deployed* source, not the
design above:

```bash
# 1. Any access control on the monthly path?
grep -rnE 'onlyOwner|onlyAdmin|onlyRole|require\(msg\.sender == (owner|admin)' src/

# 2. Is the round derived from time, or stored and bumped by someone?
grep -rn 'currentRound\|roundNumber\|advanceRound\|nextRound' src/

# 3. Is anything pushed rather than pulled?
grep -rn 'transfer(\|safeTransfer(' src/   # look for these inside loops

# 4. Is there a terminal state only an owner can reach?
grep -rn 'finalize\|closeCircle\|withdrawAll' src/
```

If `advanceRound()` or `distribute()` is owner-gated, **the answer is no, the
circles stop**, and §2.1 is what you do about it. If they're permissionless and
time-derived, the contract is fine and everything below §2.1 is the real work.

### 2.1 If the deployed contract has an operator-gated step

You cannot fix this from a beach. Options, in order of preference:

1. **Ship the permissionless version and migrate before you leave.** Running
   circles mid-year can't be "migrated" in place — you'd deploy a new circle,
   have members settle out of the old one, and re-form. That is a 2–3 week
   project with heavy member coordination. Start it now or don't.
2. **Leave a keeper.** A funded bot calling `advanceRound()` monthly. This is a
   liability: it's a key that must stay online for six weeks with no one
   watching, and if it can advance rounds it can probably also grief them. If
   you do this, scope the key to exactly one function, fund it with 3× expected
   gas, and put the private key in the 2-of-3 Safe's custody, not in a repo.
3. **Hand the button to a member.** Socially honest, technically fine if the
   function is genuinely non-custodial. Requires a written runbook and one
   person per circle who agrees to it.

Do not choose "it'll probably be fine."

### 2.2 What keeps working (given the §1 design)

Rounds advance on `block.timestamp`. Contributions, claims, settlements, bond
refunds and circle finalization are all permissionless and pull-based. A circle
whose members all behave needs nothing from you for six weeks, or for six years.
Immutable contracts also mean nothing silently changes under the members.

### 2.3 What breaks: accidental defaults

This is the highest-severity thing that can actually happen. A member misses a
deadline by four hours because the frontend was down, or they were on a flight,
or they forgot. The contract slashes their bond, voids their turn for the year,
and there is nobody with the authority to reverse it. The contract is working
exactly as designed and the outcome is unjust.

**Three changes to make before you go, in priority order:**

1. **`prefund(months)`** — a member escrows several months of contributions in
   one transaction; each round auto-debits from their escrow at settlement.
   Then tell every member in every running circle: *prepay the next two months
   before September 30.* This reduces six weeks of absence to zero default risk
   for anyone who does it, and it is the single highest-value hour of work on
   this list.
2. **`contributeFor(address member)`** — anyone can pay on anyone's behalf. A
   member's spouse, or another member, can cover them. No trust assumption; it's
   a gift to the ledger.
3. **A grace window of at least 5 days**, on-chain, immutable. If the current
   grace is 24 hours or zero, that is a bug for an unattended period. Check it.

If you cannot ship these, at minimum send the prepay-by-hand instructions (12
separate `contribute()` calls won't work if the contract only accepts the
current round — which is exactly why item 1 matters).

### 2.4 What breaks: everything that isn't the contract

The contract is autonomous. Your product isn't.

- **RPC provider.** A free-tier Alchemy/Infura key that rate-limits or expires
  takes the app down. Upgrade to a paid plan covering 6 weeks, set billing to a
  card that doesn't expire, and configure a second provider as fallback.
- **Frontend hosting.** Vercel/Netlify free-tier build minutes, a failed
  redeploy triggered by a dependency, an expiring domain. Pin all dependencies
  with a lockfile, disable auto-deploy on `main` while you're away, and renew
  the domain now.
- **Indexer/subgraph.** If the UI reads circle state from a subgraph, that's a
  second thing that can fall behind or get deprecated. Make the UI able to read
  member/round state **directly from the contract** as a fallback, even if it's
  slower. A read-only view function like `getCircleState()` returning everything
  in one call makes this easy.
- **Gas sponsorship.** If you run a paymaster or relayer for gasless UX, it runs
  out of funds and every member is bricked simultaneously. Top it up for
  12 circles × 12 members × ~3 tx × 6 weeks with 3× headroom, or turn
  sponsorship off and tell members to hold ETH.
- **WalletConnect project ID, ENS records, CDN scripts** — anything with an
  expiry or a remote dependency. Audit for them.

**Fallback that costs an hour and removes most of this risk:** verify every
circle contract on Etherscan/Sourcify, publish a static IPFS build of the app
pinned to a paid service, and write a one-page "how to pay your susu without the
website" doc — the contract address, the function name, the exact argument, and
a screenshot of the Etherscan write tab. Send it to every circle's group chat
before you leave.

### 2.5 What breaks: nobody notices

A missed contribution is silent. The first anyone learns of it is when a
recipient claims a short pot.

Set up a read-only monitor before you go — Tenderly alerts, OpenZeppelin
Defender, or a $5 cron box polling the RPC. It posts to each circle's group
chat: *"Round 6 closes in 3 days. 4 of 12 have paid: [list]."* Non-custodial,
holds no keys, cannot break anything, and it converts a silent unrecoverable
default into a nudge. Highest value-per-effort item on this page after §2.3.1.

### 2.6 What breaks: humans

Someone will send USDC directly to the contract address instead of calling
`contribute()`. Someone will lose a wallet. Someone will ask where their money
is. None of these are contract failures and all of them need a person.

- Direct transfers credit nobody and are stuck. If the design has a
  permissionless `sweepUnaccounted()` that routes stray balance into `reserve`,
  the money at least isn't burned — but it won't go back to the sender. Document
  loudly: **only pay through the app or the `contribute()` function.**
- A lost wallet is a lost slot. There is no recovery in an immutable contract
  and you should not pretend otherwise. Say so in the terms, now.
- **Name a human on call.** They don't need any keys — they need the runbook,
  read access to circle state, and the authority to say "yes that's expected."
  Pay them if you have to. Six weeks with no one answering a message about
  $1,200 of someone's family's money is the thing that kills the product, not a
  smart contract bug.

### 2.7 Don't start anything new

- **Pause the factory** for the six weeks. No new circles form while nobody can
  support them.
- **Freeze deploys.** No code changes to a live frontend that nobody can roll
  back.
- **Don't start a circle in the last week before you leave.** Formation is the
  phase with the most member confusion and the most support load.
- **Check whether any running circle's final round lands in the window.**
  If so, verify `finalize()` and `withdraw()` are permissionless and walk that
  circle's members through the end-of-circle flow *before* you go. A circle
  ending unattended with a bond-refund step nobody knows how to call is a
  guaranteed support incident.

---

## Pre-departure checklist

Ship:
- [ ] `prefund(months)` + `contributeFor(address)` deployed for running circles
- [ ] Grace window confirmed ≥ 5 days on every running circle
- [ ] `getCircleState()` view so the UI can run without an indexer
- [ ] Factory paused

Verify:
- [ ] `grep` audit in §2.0 returns no owner-gated step on the monthly path
- [ ] All circle contracts verified on Etherscan/Sourcify
- [ ] No running circle's final round falls in the window (or it's been walked)
- [ ] Upgrade keys: circle logic immutable, factory pause on a 2-of-3 with one
      non-travelling signer

Operational:
- [ ] RPC on a paid plan, second provider configured, billing card valid
- [ ] Domain renewed, auto-deploy disabled, lockfile pinned
- [ ] Paymaster funded with 3× headroom, or sponsorship off
- [ ] Read-only monitor posting payment reminders to each circle's group chat
- [ ] Static IPFS build pinned + "pay without the website" doc sent to members
- [ ] Named on-call human with the runbook, plus what they are and aren't
      authorized to say

Communicate:
- [ ] Every member told: prepay two months before Sep 30
- [ ] Every member told: we are away Sep 22 – Nov 3, here's who to contact
- [ ] Loss-sharing and lost-wallet rules stated in writing, not just in code

---

## Bottom line

With the design in Part 1, the circles keep running. Nothing in the monthly
cycle needs you. But "the contract is autonomous" and "the product survives six
weeks" are different claims, and the gap between them is the RPC key, the
unextendable deadline, and the absence of anyone to answer a message. Of the
work above, three items carry most of the risk reduction: **`prefund()` plus a
prepay instruction to members**, **a read-only payment-reminder monitor**, and
**a named human on call.** Those three are roughly two days of work. Do them
even if you skip everything else.

And before any of it: resolve Part 1.2. "Earlier contributions cover the
shortfall" does not hold onchain, and the circles currently running are exposed
to it today, whether or not you are in the country.
