# The 5 ETH Friday draw — exact run of show

## The design in one paragraph

A tiny immutable contract — no owner, no admin key, no proxy, no upgrade path, and
exactly two ways for ETH to leave: to the computed winner, or back to the treasury
if nobody entered — holds the 5 ETH from before entries open. Entries are just
addresses on a list, accepted only in blocks timestamped before Friday 20:00:00 UTC.
The winning number is `keccak256(blockhash(A) ‖ blockhash(B)) % entrants`, where A
and B are two blocks mined *after* entries close, minutes apart, with different
proposers — hashes nobody, us included, knows or controls when they're cast. Every
draw step is permissionless: the organizer, a volunteer, or a suspicious entrant can
send the identical transaction and get the identical result. No VRF subscription, no
oracle account, no third party to top up: the only inputs are the chain's own blocks
and the people in the room.

## Why this shape

- **Anything a human types in is disqualified.** An organizer-supplied seed, a coin
  flip posted onchain, a "random" number from the mic — the person choosing it can
  foresee or steer the outcome, which fails requirement 1, and a loser reading the
  contract knows it, which fails requirement 2.
- **Paid provable randomness (Chainlink VRF) is the gold standard, but it's out of
  scope here**: it means a funded subscription account with a third-party provider,
  which the treasury has ruled out, plus an external dependency for one evening.
- **Chain-native randomness it is.** Block hashes of future blocks are unknowable
  more than a few seconds in advance. The one party with any influence at all is the
  validator proposing that exact block (they can grind or withhold their own block,
  one shot, at the cost of their block reward). We shrink that residual to noise by
  mixing **two** blocks ~2 minutes apart: rigging now requires the proposer of block
  A *and* the proposer of block B — two independently assigned slots — to collude,
  and the "why" for that on a 5 ETH community prize does not exist.
- **Every step after deployment is permissionless.** Nothing is automatic: contracts
  don't run themselves, there is no cron job, and every function call needs a caller
  who pays gas. So we design every poke to be sendable by *anyone*, and we put the
  contract address on a QR slide so "anyone" includes every entrant in the room.

## What must be in place before entry week opens

1. **Deploy the contract** for this month's edition (immutable constants; redeploy
   fresh each month so every edition's rules are frozen before anyone enters).
   Verified source on the explorer, not a proxy, no `onlyOwner` anywhere:
   - `CLOSE_TIME` — this Friday 20:00:00 UTC, as a unix timestamp
   - `GAP = 10` blocks between the two seed blocks
   - `enter()` — one entry per address, reverts once `block.timestamp >= CLOSE_TIME`
   - `lock1()` — permissionless; requires `block.timestamp >= CLOSE_TIME`; records
     `lockBlock1 = block.number`
   - `lock2()` — permissionless; requires `block.number >= lockBlock1 + GAP`; records
     `lockBlock2 = block.number`
   - `settle()` — permissionless; requires `block.number > lockBlock2`; reads
     `h1 = blockhash(lockBlock1)`, `h2 = blockhash(lockBlock2)`; **requires both
     nonzero** (a zero hash must never pick a winner — it's the manipulation hole in
     naive versions); computes `winner = entrants[uint256(keccak256(h1 ‖ h2)) % n]`;
     pushes the **full contract balance** (checks-effects-interactions, so a hostile
     winner wallet can't reenter); if the push fails, stores the winner for `claim()`
   - `claim()` — winner only, pull-payment fallback, no deadline
   - `relock()` — permissionless re-roll, allowed only when
     `blockhash(lockBlock1) == 0`, i.e. the contract itself can prove the history
     window has expired; resets both lock blocks
   - `refundIfNoEntrants()` — pays the balance to a hardcoded treasury address;
     requires `entrants.length == 0` after close. This is the *only* organizer-facing
     exit, and it's publicly checkable that it's unusable whenever a single entrant
     exists.
2. **Fund it before entries open.** Treasury sends exactly 5 ETH to the contract.
   From that moment the prize is onchain for everyone to see — "the money was already
   there before you entered" is a big part of the anti-rigging story. (Full-balance
   payout means even an accidental later donation just joins the prize; nothing can
   get stuck.)
3. **Publish the rules**: contract address (also on a QR slide on the night), close
   time, the draw sequence below, and one sentence: *"Every draw step can be sent by
   anyone — don't take our word for it, watch it happen live."* Being explicit that
   multiple wallets per person means multiple entries, because onchain can't count
   humans (a door list is the only fix, and it's offchain).
4. **Chain choice, stated honestly.** Recommend mainnet: seed hashes come from
   randomly assigned proposers (the two-block mix actually bites), and the 256-block
   history window is ~51 minutes — a comfortable runway for the evening. On a
   single-sequencer L2 the hashes all come from one operator and the window shrinks
   (Base ~8.5 min at 2s blocks; Arbitrum about a minute) — workable, but the anti-rig
   argument becomes "the sequencer has no reason to touch a community raffle," not
   "nobody can." Whatever you pick, put it in the published rules.
5. **Three designated callers** (organizer + two volunteers), each with a wallet that
   holds gas ETH. The contract cannot pay anyone's gas — callers pay it themselves,
   which is exactly why the calls must be cheap and why no single person may be a
   bottleneck.

## The sequence: entries close → prize lands

Mainnet timing (12s blocks). Who "sends" each tx is the designated person; who *may*
send it is anybody.

| # | Clock | Call | Sender | Window |
|---|-------|------|--------|--------|
| 0 | 20:00:00 UTC | — | nobody | **Closing is a rule, not a transaction.** Each `enter()` checks its own block's timestamp, so the list just stops accepting. |
| 1 | ~20:00:15 | `lock1()` | organizer | Any block with timestamp ≥ 20:00; no deadline. Starts the clock for everything after it. |
| 2 | ~20:02:30 | `lock2()` | volunteer #1 | ≥ 10 blocks after `lock1`'s block; must land while `lock1`'s hash is still readable. |
| 3 | ~20:03:00 | `settle()` | organizer | Any block after `lock2`'s block, and **no later than 255 blocks after `lock1`'s (~51 min on mainnet)**. |
| 4 | only if push failed | `claim()` | winner only | No deadline. |

What the crowd sees:

- **20:00:00 — entries close themselves.** No tx needed; the last enterable block is
  the last block stamped before 20:00. Honest footnotes for the rules: a tx sent at
  19:59:58 can still land in a 20:00:01-stamped block and revert — it never entered;
  and the entrant list and count `n` are now frozen and readable by anyone. Put `n`
  and the balance on the projector.
- **~20:00:15 — `lock1()`.** One ordinary gas-paid tx. The contract stamps the block
  number. At broadcast time not even the caller knows this block's hash — the
  proposer sets it when building the block. This is the moment the die is cast.
- **~20:02:30 — `lock2()`.** Same thing, ~10 blocks later. The GAP guarantees the
  two seed blocks have different, independently assigned proposers. Nobody on earth
  controls both halves of the seed.
- **~20:03:00 — `settle()`.** The contract pulls the two hashes, checks both are
  nonzero, computes `keccak256(h1 ‖ h2) % n`, and tries to push the full 5 ETH to
  `entrants[seed % n]`, emitting an event with `h1`, `h2`, the seed, and the winner —
  that event goes on the projector. Wait two or three confirmations before the
  handshake (a reorg of the seed blocks after payout would change the winner; the
  two-minute GAP plus a couple of confirmations makes that a non-issue in practice).
- **~20:04 — prize lands in the winner's wallet.** Winner doesn't even have to be in
  the room to be paid; if they are, their phone shows +5 ETH on stage.
- **If the push reverted** (winner uses a contract wallet that refuses plain ETH
  sends): `settle()` has still recorded the winner and emitted the event; the winner
  calls `claim()` and pulls the 5 ETH whenever their wallet is ready.

Runway check: steps 1–3 use ~3 minutes of the ~51-minute window. Everything is done
before the first talk ends.

## If someone doesn't do their part in time

The design principle: since nothing is automatic, "someone didn't do their part" must
collapse into "someone else did it instead." No step ever waits for a specific
person.

- **Organizer's wallet dies at 20:00** (no gas, lost seed phrase, dead laptop): a
  volunteer, or *any* attendee with the address from the QR slide, sends the same
  calls from their own wallet. Identical transactions, identical outcome. This is
  why the address is public and why three people are prepped.
- **Nobody in the room calls anything at all:** nothing happens — the contract sits
  in its state until poked. There is no timeout that forfeits the prize and no
  reversion to the treasury while entrants exist. The draw can be completed
  Saturday morning: `lock1`, `lock2`, `settle` on fresh post-close blocks. The
  hashes were just as unknowable, the result just as valid — the evening's theater
  is lost, the guarantee isn't. (The prize is permissionlessly *claimable* by the
  winner only via the computed result, so late ≠ rigged.)
- **Everyone stalls past the ~51-minute history window** (`blockhash(lockBlock1)`
  now reads as zero): `settle()` reverts rather than ever accepting a zero seed —
  a zero seed would deterministically pick a known entrant, which would be a
  manipulation hole, so the contract refuses it outright. The remedy is `relock()`:
  permissionless, and gated on the contract *itself* proving expiry
  (`blockhash(lockBlock1) == 0`), so nobody can use it as a retry button after
  peeking at a draw they disliked. It resets both seed blocks and the sequence runs
  again. Crucially, the first roll's result was never revealed — `settle` reverted
  instead of paying — so letting the window lapse gains an attacker nothing but a
  delay, and the re-roll is a fresh fair roll, not a mulligan: the relocker still
  can't choose or foresee the new blocks' hashes.
- **`lock2` never gets sent** (the room forgot step two, or it lands >255 blocks
  after `lock1`): same terminal state — `settle()` can't read a valid pair; the
  `relock()` path applies. Until then, nothing is lost: `lock1` has no expiry of
  its own.
- **Winner's wallet can't accept ETH:** push fails inside `settle()`, winner is
  recorded anyway, event emitted, `claim()` pulls later. On stage the moment still
  works: the event names the winner, the money moves when their wallet cooperates.
- **Zero entrants:** `seed % 0` reverts, so `settle()` can never run — the draw is
  unwinnable by construction. The treasury (or anyone — the destination is
  hardcoded) calls `refundIfNoEntrants()`, which pays out only when the list is
  publicly empty. With even one entrant, there is no organizer exit. That asymmetry
  is the point.
- **A last-second entrant lands in a block stamped 20:00:01:** their `enter()`
  reverts; they are not in the list. The boundary is the block timestamp, not the
  send time — publish that rule before the week starts and it can't be called foul
  play.

## Why a losing entrant reading the contract can't build a rig case

1. **The rules were frozen before anyone entered.** Immutable code, no proxy, no
   admin key, verified source. After entries open we could not change one byte of
   the draw logic, even if we wanted to.
2. **The money was locked in first.** 5 ETH onchain before the entry window opened,
   with exactly two exits: the computed winner, or refund-if-nobody-entered. There
   is no back door to point a finger at.
3. **The seed came from blocks mined after entries closed.** Not typed in by us —
   produced by the chain. The accuser can recompute the whole thing themselves:
   pull the two block hashes from any node, keccak them, take mod `n`, land on the
   same winner. Their case must instead be "two independently assigned block
   proposers, minutes apart, colluded with an entrant for a 5 ETH meetup prize" —
   which is not a credible case.
4. **Every step is permissionless with a public address.** Had we wanted to rig it,
   we'd have needed an exclusive power somewhere — an admin key, a privileged
   caller, a secret input. There is none, and the transaction history shows ordinary
   calls replayable by anyone.

## Honest limits — say these out loud

Undisclosed weaknesses are how credibility dies; these belong in the published
rules:

- **Validator bias exists and is bounded.** The proposer of a seed block could grind
  its hash offline or withhold the block once — one shot, at the cost of their block
  reward, and they'd need to be the proposer of that exact block *and* hold or
  collude with an entry. Controlling both seed blocks to guarantee a win requires
  two independently assigned slots. This residual is what Chainlink VRF eliminates —
  and VRF is exactly what the treasury constraint rules out. State it; it's the
  price of "the contract and the people in the room" only.
- **On a single-sequencer L2**, all block hashes come from one operator; the
  anti-rig argument there is incentive-based (a major infra operator won't touch a
  community raffle), not impossibility-based. Prefer mainnet for the draw if entry
  gas (~a few dollars, once per person) is tolerable.
- **Sybils:** one entry per address, not per human. Three wallets = three entries.
  Onchain can't see people; a door list is an offchain fix if it matters.
- **Modulo bias:** `seed % n` is non-uniform by about `n/2^256` — zero for any
  realistic crowd size.
- **Finality:** the announced winner is final after a few confirmations; a deep
  reorg of the seed blocks past that point would change the result. Mainnet deep
  reorgs are effectively history, but "final after ~30 seconds" is the honest phrasing.