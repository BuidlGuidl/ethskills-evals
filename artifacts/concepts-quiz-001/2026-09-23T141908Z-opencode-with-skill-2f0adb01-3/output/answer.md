# Meetup giveaway: 5 ETH draw, fair and unfakeable

## The core problem

A contract is a state machine: it does nothing until someone pokes it, and
every result it computes is deterministic. So "pick a random winner" really
means two separate problems:

1. **Where does the randomness come from?** Nothing already onchain at draw
   time works on its own — `block.timestamp` and past blockhashes are visible
   or grindable, and a validator proposing the "randomness block" can withhold
   a block it doesn't like (cheap to do when 5 ETH is at stake).
2. **Who sends each transaction, and why would they?** Nothing happens at
   20:00 "automatically." Every step below names a sender and a window.

The scheme that fits your constraints (ETH only, no paid provider, no one
trusted) is **commit-reveal by the entrants, mixed with a future blockhash**:

- Every entrant locks in a secret *before* entries close. Nobody can change
  their secret afterwards, and nobody can see anyone else's.
- The final seed mixes **all revealed secrets** with the **blockhash of a
  block that doesn't exist yet** when the last secret is revealed. So even the
  very last person to reveal cannot compute the outcome before deciding
  whether to reveal, and the organizers contribute *nothing* to the seed.
- Chainlink VRF would be the other honest answer, but it needs a funded
  subscription in LINK — you've ruled that out, and for a one-evening event
  commit-reveal with the room full of entrants is stronger socially anyway:
  the randomness comes from the people standing there.

## What has to be in place beforehand

1. **The contract, deployed and source-verified** days before entries open.
   It is deliberately simple: `enter(bytes32 commitment)`, `reveal(bytes32
   secret)`, `draw()`, `claim()/payout()`, plus a permissionless re-roll path
   (below). Fixed constants baked in at deploy:
   - `ENTRY_CLOSE` = Friday 20:00 UTC (timestamp).
   - `REVEAL_CLOSE` = Friday 20:45 UTC.
   - `SEED_BLOCK` = first block with timestamp > REVEAL_CLOSE, plus 5 blocks
     (~1 min) of safety margin.
2. **The 5 ETH is sent from the treasury to the contract before entries
   open.** This is half your credibility: the prize is locked in the code
   everyone can read, not promised by a person. Contract holds exactly
   5 ETH; entrants can verify on a block explorer.
3. **Organizers ideally do not enter.** Not required for safety (their secret
   can't bias anything), but it removes even the appearance of a conflict.
4. **Entrant instructions:** at entry time each person generates a random
   32-byte secret, submits `keccak256(secret)` as their commitment, and saves
   the secret (the UI/wallet stores it locally; losing it = losing your
   ticket). They must be reachable during the 45-minute reveal window — fine,
   since they're in the room.
5. **On the night:** a laptop on a known-good RPC, a wallet with a little ETH
   for gas, and the meetup page open. That's it — the organizer's role is
   purely ceremonial.

## The exact sequence, Friday evening

**Step 0 — Entries close.**
No transaction needed. `enter()` simply reverts after `ENTRY_CLOSE`
(20:00 UTC). The committed list of entrants is now frozen and publicly
readable.

**Step 1 — Reveal. 20:00–20:45 UTC.**
*Sender: each entrant, individually.* They call `reveal(secret)`; the
contract checks `keccak256(secret)` against their stored commitment, marks
them eligible, and mixes the secret into an accumulator (e.g. XOR). Their
incentive: revealing is the only way to stay in the draw. Do this live from
the stage or from people's phones as they arrive — it doubles as the evening's
entertainment.

**Step 2 — Wait for the seed block. ~20:45–20:50.**
No transaction. The chain just needs to pass `SEED_BLOCK`. At this point the
outcome is fully determined but not yet *known* to anyone, because
`blockhash(SEED_BLOCK)` didn't exist while reveals were open.

**Step 3 — Draw. ~20:50–21:40 (within 256 blocks of SEED_BLOCK, ~51 min).**
*Sender: anyone.* In practice the organizer calls `draw()` live on stage, but
it is permissionless — the winner (or literally anyone) can call it if the
organizer doesn't. The contract computes

```
seed   = keccak256(revealedSecretsAccumulator, blockhash(SEED_BLOCK))
winner = eligibleEntrants[seed % eligibleCount]
```

and records the winner. The 256-block limit matters: `blockhash()` returns
zero for blocks older than 256, so `draw()` must land inside that window. On
stage around 21:00, you're comfortably inside it.

**Step 4 — Payout. Same transaction or one more.**
Simplest: `draw()` pushes 5 ETH to the winner immediately — prize lands in
their wallet while they're on stage, verifiable on the projector. If you
prefer pull-over-push, `draw()` records the winner and `payout()` (callable
by anyone, funds only ever go to the recorded winner) sends the 5 ETH.
*Sender: anyone; window: none — it sits there until claimed.*

## Why a loser can't build a rigging case

- The prize was locked in the contract before anyone entered.
- Every entrant's influence on the outcome was fixed at commit time, before
  entries closed, and hidden until they chose to reveal.
- No single party — including the organizers — could compute the outcome
  before the seed block existed, because the seed needs a blockhash from the
  future. Withholding your reveal doesn't help either: you can't tell whether
  the altered outcome favors you, since the blockhash is still unknown, and
  withholding definitely eliminates you.
- The organizer sends at most one transaction (`draw()`), which any other
  person could have sent with identical effect. There is no admin input to
  the result.
- Everything is checkable afterwards: commitments, reveals, the seed block,
  the modular arithmetic, the payout. Anyone can recompute the winner by hand
  from onchain data.

One honest caveat: the validator proposing `SEED_BLOCK` could theoretically
discard their block to force a re-roll, at the cost of their block reward.
They'd have to be an entrant, get lucky enough to be picked as proposer for
that exact slot, and burn money for a blind re-roll. If you want to shrink
this further, mix in blockhashes of several consecutive blocks (e.g.
SEED_BLOCK through SEED_BLOCK+4) so an attacker must control multiple slots.

## What happens if someone doesn't do their part

- **An entrant never reveals (by 20:45):** they're silently excluded — not
  eligible, their secret contributes nothing. They can't hold the draw
  hostage or bias it (see above). No one else has to do anything; the draw
  proceeds over whoever revealed. Optional hardening: charge a small ETH
  bond at entry, refunded on reveal, forfeited into the pot otherwise — but
  exclusion alone is sufficient here, so keep it simple.
- **Nobody reveals at all:** `draw()` reverts on an empty eligible set. The
  5 ETH stays locked. For this pathological case, include an escape hatch
  with a long delay: e.g. 30 days after REVEAL_CLOSE, a `refundToTreasury()`
  callable by anyone sends the balance back to the treasury address. The
  delay keeps it from being usable to interfere with the live event.
- **The organizer doesn't show up / their laptop dies:** nothing is lost.
  `draw()` and `payout()` are permissionless. The winner has 5 ETH of
  incentive to poke the contract themselves.
- **Nobody calls `draw()` within the 256-block window:** `blockhash` of
  SEED_BLOCK is no longer readable, so a permissionless `reseed()` sets
  SEED_BLOCK to a fresh near-future block (current + 5). Same fairness
  properties as before, repeat until a draw lands in time. All revealed
  secrets stay locked in — nobody gets a second chance to change theirs.
- **Someone tries to reveal a different secret than they committed:** the
  hash check fails and the transaction reverts. Commitments are immutable;
  there is no edit path.
