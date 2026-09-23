# The scheme: commit–reveal raffle

Paid randomness (Chainlink VRF) is out because of the treasury constraint, and
on-chain "free" randomness (blockhash, `block.prevrandao`, timestamps) is out
because it is either predictable to participants or influenceable by block
proposers — a loser could credibly argue it was gamed. The thing that works
with only the contract and the people in the room is **commit–reveal**:

- Every entrant locks in a hidden secret *before* entries close (commit phase).
- After entries close, entrants publicly disclose their secrets (reveal phase).
- The winner is derived by hashing **all** revealed secrets together, so no
  single party — including us — can know or steer the outcome in advance. Any
  one honest entrant's secret makes the result unpredictable to everyone else.
- Afterwards, anyone can recompute the winner from public chain data and
  confirm the contract followed the rules. That is what makes "it was rigged"
  non-credible.

## What must be in place beforehand

1. **Deployed, verified raffle contract** with immutable parameters set at
   deployment:
   - `entryDeadline` = Friday 20:00 UTC (a fixed Unix timestamp).
   - `revealDeadline` = Friday 21:00 UTC (one-hour reveal window, during the event).
   - `deposit` = e.g. 0.01 ETH per entry (refunded on a valid reveal).
   - `minReveals` = e.g. 2 (minimum reveals for a draw to be valid).
   - `treasury` = the treasury address (refund destination on cancellation).
   - Source published and verified on a block explorer so entrants can read the
     rules before committing.
2. **Treasury funds the contract with exactly 5 ETH** before entries open, so
   everyone can verify onchain that the prize is real and locked.
3. **Announced rules**: entry requires a commitment `keccak256(secret, msg.sender)`
   plus the deposit; entrants must keep their secret safe and be able to send a
   transaction (their own wallet, or a laptop/phone in the room) during the
   reveal hour.
4. **A projected UI / script** for the night: shows entry count, reveal count,
   and calls the draw — but it is only a convenience; every step is a plain
   contract call anyone can make from a block explorer.

## Exact sequence on the night

### Step 0 — Entry week (before Friday 20:00 UTC)
- **Who:** each entrant, any time during the week.
- **Tx:** `commit(bytes32 commitment)` with the deposit attached.
- **Window:** must be mined in a block with timestamp `< entryDeadline`. The
  contract rejects anything after. At 20:00 UTC the entry list is frozen
  automatically by the timestamp check — no one (including us) has to do
  anything, and no late entry is possible.

### Step 1 — Reveal phase (Friday 20:00–21:00 UTC)
- **Who:** each entrant who wants to stay in the draw (from their own wallet in
  the room; the secret can also be submitted by anyone they trust, but only the
  entrant knows it).
- **Tx:** `reveal(uint256 secret)`. The contract checks
  `keccak256(secret, msg.sender)` equals the stored commitment; if so it marks
  the entrant as revealed and refunds the 0.01 ETH deposit immediately.
- **Window:** block timestamp `>= entryDeadline` and `< revealDeadline`.
  Outside this window reveals revert.

### Step 2 — Draw and payout (on stage, right after 21:00 UTC)
- **Who:** the MC/organizer sends it live on stage — but crucially the function
  is **permissionless**, so anyone in the room can send it. We cannot withhold
  or delay the draw.
- **Tx:** `draw()`, callable only after `revealDeadline`, only once.
- **What the contract does in that single transaction:**
  1. Requires `revealedCount >= minReveals`.
  2. Computes `seed = keccak256(abi.encodePacked(secret_1, secret_2, ..., secret_n))`
     over all revealed secrets, in stored order.
  3. `winnerIndex = uint256(seed) % revealedCount`.
  4. Transfers the full 5 ETH to the winner's address (the address that
     committed), and emits an event with the seed, index, and winner.
- **Window:** any time after 21:00 UTC; in practice within a minute of the
  deadline, on stage. The prize lands in the winner's wallet in the same
  transaction the audience watches being confirmed.

### Step 3 — After the fact (verification, no tx needed)
- Anyone (especially losers) can independently recompute: take all revealed
  secrets from the event logs, hash them in order, mod by the reveal count,
  and check it matches the paid-out winner. The contract had no discretion and
  no hidden inputs — the result was fully determined the moment the reveal
  deadline passed, by data no single party controlled.

## If someone doesn't do their part

- **Entrant doesn't reveal by 21:00 UTC:** they are simply excluded from the
  draw and forfeit their 0.01 ETH deposit (retained in the contract, sweepable
  to the treasury — e.g. rolled into next month's prize). This is the key
  anti-griefing measure: without it, a participant who sees during the reveal
  phase that the partial result won't favour them could withhold their reveal
  to bias the outcome. With the deposit plus loss of eligibility, withholding
  costs money and forfeits any chance at the 5 ETH, so the only rational move
  is to reveal. The contract enforces all of this automatically — there is no
  one to appeal to and nothing we can override.
- **Too few reveals (`revealedCount < minReveals` at the deadline):** `draw()`
  permanently reverts. After a further grace deadline (e.g. 24 h), anyone can
  call `cancel()`, which returns the 5 ETH to the treasury and lets the
  entrants who *did* reveal withdraw their remaining funds. Honest
  participants are made whole; only no-shows lose deposits.
- **Organizer (us) doesn't call `draw()`:** doesn't matter — it's
  permissionless, any entrant or audience member can trigger it. We have no
  privileged role after deployment, which is exactly what makes "the
  organizers rigged it" an argument no loser can credibly make.
- **Someone tries to reveal a secret that doesn't match their commitment:**
  the tx reverts; only the exact preimage committed during the entry week is
  accepted, so no one can change their contribution after seeing others'.

## Why this satisfies the two hard requirements

- **Unpredictable / uninfluenceable:** before the reveal deadline, every
  secret is hidden behind a hash; after it, the outcome is already locked.
  Neither we nor any entrant can know the winner earlier, and steering it
  would require controlling *every* revealed secret.
- **Auditable:** commitments, reveals, the seed, the index math, and the
  payout are all onchain and deterministic. A loser with a block explorer and
  five minutes can verify the whole thing end to end; there is no step that
  requires trusting us.
