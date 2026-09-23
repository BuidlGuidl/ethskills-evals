# The 5 ETH giveaway: how the night runs

## The shape of it

No paid randomness provider, no LINK, no oracle account — so the draw is a
**commit–reveal raffle**, the one construction that works with nothing but the
contract and the people in the room:

- During entry week everyone **commits** `keccak256(secret, salt, their address)`
  plus a small refundable **bond**.
- After entries close on Friday, on stage, everyone **reveals** their
  `(secret, salt)` from their phones.
- The seed is `keccak256(revealed secrets in entry order ‖ blockhash of the
  first-reveal block)`. That blockhash is unknowable to anyone at commit time
  and fixed before the last reveal, so nobody could steer their own commit
  toward it, and the block proposer who made it knew no secrets — there was
  nothing for them to grind.
- Anyone settles with one transaction, and that transaction pays the winner.

Why not the shortcuts: `block.prevrandao` or a blockhash the settling
transaction picks itself can be re-rolled or biased by whoever produces the
blocks — fine for a party game, not for 5 ETH. And Chainlink VRF would mean an
account and a token balance with a third party, which the treasury ruled out.
Commit–reveal costs entrants one extra transaction on the night, and the room
makes that practical: the revealers *are* the people standing in front of you.

**The one attack commit–reveal has to price out:** the person who reveals last
can see the outcome coming and simply not send their reveal, choosing between
the two draws their secret produces. That is why the bond exists — an entry
that never reveals forfeits it.

All timing below assumes **mainnet, 12 s blocks**, so the `blockhash` lookback
of 256 blocks is **~51 minutes of wall clock**. If this deploys on a 2 s L2,
that window is ~8.5 minutes and the reveal window must shrink to a few minutes
or settle must read the EIP-2935 history contract
(`0x0000F90827F1C53a10cb7A02335B175320002935`, 8191 blocks) instead — check
it's actually deployed there first. Resize everything below if the chain
changes; the structure doesn't.

## What has to be in place beforehand

1. **The contract, deployed before entry week opens**, with the whole schedule
   baked into immutable code: commit window, close at Friday 20:00 UTC (the
   contract reads block timestamps, so the deadline is exact onchain), reveal
   deadline 20:25 UTC, bond size, caller bounty, and the treasury address for
   the refund path. **No admin keys, no owner functions, no upgrade path** —
   once it's funded, not even you can touch the ETH. That is the backbone of
   the "it wasn't rigged" story: the prize moves only when the draw logic says
   it moves.
2. **Funded with 5 ETH plus a small caller bounty** — say 5.01 ETH total. The
   extra 0.01 is what guarantees a stranger's phone will send the settle
   transaction even if nobody else bothers.
3. **Source code verified on the explorer before entries open.** A losing
   entrant who reads the contract must find: one deterministic path from
   public inputs to a winner, and no key that shortcuts it. Verify early so
   the whole entry week happens under published code.
4. **A way for attendees to enter**: a simple page or just the verified
   contract's "Write" tab on the explorer. Entrants need a wallet, gas money,
   and the bond (suggested **0.05 ETH** — see "what it gives up" for why that
   number), and they must keep `(secret, salt)` somewhere they'll have them
   on Friday — they're worthless to anyone else and the holder of the prize
   chance is whoever can produce them.
5. **Someone owns the on-stage moment** — MC or a volunteer sends the settle
   transaction at ~20:30. Not because the system needs them, but because
   it's a ceremony. The system's backstops are: the future winner (5 ETH of
   reason to send it) and any attendee (the 0.01 bounty).

## The exact sequence, Friday night

| # | Step | Who sends it | Window |
|---|------|--------------|--------|
| — | Commits | each entrant, for themselves | entry week, hard close 20:00:00 UTC |
| 1 | Reveals | each entrant — or anyone they've handed `(secret, salt)` to | 20:00:00 → 20:25:00 UTC |
| · | *(not a transaction)* the contract records the **first-reveal block**; its blockhash is the draw's second input, fixed the moment it's mined | — | — |
| 2 | **Settle** — computes the seed, picks the winner, **pushes the payout** | **anyone** — MC, future winner, or a stranger for the bounty | 20:25:00 → first-reveal block + 256 (~20:51 if reveals started on time) |
| 3 | Nothing | the winner sends no transaction — the ETH arrives in their wallet inside the settle transaction itself | — |

Concretely:

- **20:00** — commits close; contract starts accepting reveals. Each reveal
  checks the preimage against a commit, marks that entry "in the draw", and
  **refunds its bond immediately**. Because the check is on the preimage, not
  the sender, an entrant with a dead phone can whisper their secret to a
  friend and the friend's reveal works.
- **The first reveal's block** is recorded. Nobody chose it, nobody could
  foresee its hash during entry week, and the proposer who built it had no
  secrets to grind against — the outcome depended on reveals that didn't
  exist yet.
- **20:25** — reveals close; the entrant set is frozen. From this moment
  *anyone in the room can compute the winner offline* from public data:
  revealed secrets plus that blockhash. Whoever that is has until roughly
  20:51 — after that the blockhash falls out of the `blockhash` lookback,
  reads as zero, and is **gone for good**.
- **~20:30, on stage** — MC sends `settle()`. The contract reads the stored
  blockhash, hashes it with the revealed secrets in entry order, takes the
  seed modulo the number of revealed entrants, pays **5 ETH to that wallet**
  in the same transaction, pays the settler the 0.01 bounty, and splits any
  forfeited bonds among the other entrants. Twelve seconds later the winner's
  balance has changed. Hand over the mic.

Why each transaction actually happens with nobody "running" the raffle:
the entrant reveals because 5 ETH is riding on a few cents of gas; the settler
settles because they either just won or are collecting the bounty. No
scheduled transaction exists that depends on an organizer being sober.

## When someone doesn't do their part

- **Committed after 20:00** — not entered. The contract reverts. Nothing
  further; they never had a bond at risk.
- **Doesn't reveal by 20:25** — their entry is void and their bond is
  **forfeited, split among the entrants who did reveal**. The draw proceeds
  without them, without delay or damage: the seed simply hashes the secrets
  that arrived. Forfeiting is not free and not private — the whole room can
  see onchain who withheld, on the night. Note the forfeit goes to the other
  *entrants*, not to the prize: if it fed the prize, a colluding pair could
  withhold into their friend's win and get their bond back inside the payout.
- **Nobody settles in time** — if the window lapses (first-reveal block + 256)
  with no winner set, `settle()` can no longer read the blockhash and the draw
  is dead. Anyone can then call `void()` — open from 21:30 UTC, safely past
  any possible window expiry on this schedule — which sends the 5 ETH **back to
  the treasury** and refunds every remaining bond. The giveaway is called
  off, and nobody can steal anything through it. This failure can only
  happen through *total* inaction: settle is permissionless, so no attacker
  can block it — they'd have to outbid every attendee's phone for half an
  hour while the future winner watches. The realistic causes are a chain halt
  or the room forgetting, and the contract's answer to both is the same:
  money goes home, nothing sticks.
- **Zero entrants reveal** — same `void()` path from 21:30; prize and bonds
  refund.
- **The winner is asleep** — irrelevant. Payout is pushed, not claimed; the
  ETH lands whether they're watching or not.
- **One entrant total** — they win by default; worth knowing before you're
  surprised on stage.

## What a losing entrant finds when they read the contract

Everything that decided their loss is public and replayable: the commit
hashes, the revealed secrets, the stored block number, its blockhash, the
exact hash-and-modulo, the payout. They can recompute the winner from the
explorer in five minutes and get the same address. What they will *not* find
is any discretion: no owner key over funds, no upgrade, no pause, no way for
the organizers to have known the outcome before it happened. The only parties
with any theoretical influence are (a) whoever withholds a reveal — public,
and priced out by the bond, and (b) the proposer of the first-reveal block —
who built it before any secret existed, so there was nothing to aim at.

## What this design gives up (the honest list)

- **Last-reveal collusion is priced, not made impossible.** Anyone whose
  reveal is still pending can compute both draws and pick. A bond of ~0.05
  ETH makes one withheld flip cost more than a 1-in-40-ish expected gain on
  5 ETH; a lower bond makes entry friendlier and the flip cheaper to buy —
  pick where you want to sit. Multiple entrants withholding together select
  among many outcomes at a cost of one bond each. For a room of people who
  meet monthly and can all see who withheld, that residual is a reasonable
  one to accept — but it is a residual.
- **The contract cannot check attendance.** Anyone can enter several addresses
  from home; free entry means more tickets per person. The room polices this
  socially, the chain can't.
- **Everything is public forever.** The entrant list is the meetup's
  attendance record, onchain permanently. Revealed secrets are visible — tell
  people to use throwaway values, nothing personal or reusable as a password
  elsewhere.
- **Censorship:** a builder could in principle smother settle transactions
  for the whole window. The result is the void path — refunds, no theft —
  not a stolen prize.
- **No rescue hatch.** No admin keys means no fix, no pause, no mercy if the
  schedule or the code is wrong. Get the contract reviewed before funding it
  with 5 ETH, and remember any audit is a point-in-time review of that exact
  code, not a standing guarantee.
- **The stack is one contract.** No server, no indexer, nothing of ours that
  has to stay up: anyone with a wallet and a block explorer can run the
  entire raffle, this month and every month after, without us.