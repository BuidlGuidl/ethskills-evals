# Friday-night raffle: commit–reveal + future blockhash

Paid VRF is out (no third-party accounts, ETH-only treasury), and a bare
`blockhash` draw is out too (a block proposer can skip or grind blocks). The
design that satisfies both "nobody can foresee the winner" and "nobody can
credibly claim it was rigged" is **commit–reveal by the entrants themselves,
mixed with a future blockhash that nobody in the room controls**.

## Why this design

- **Commit phase**: each entrant locks in `keccak256(secret, address)` before
  entries close. Nobody's choice can be changed or selectively copied after
  the deadline.
- **Reveal phase**: entrants open their commitments on the night. The entropy
  comes from *every* revealer, so no single person (organizers included)
  chooses the outcome.
- **Future-blockhash mix-in**: removes the "last revealer" problem — the final
  person to reveal cannot compute the result and quietly abort, because the
  seed also depends on a block that doesn't exist yet.
- **Everything is onchain and deterministic**: any loser can recompute the
  winner from the published commitments, reveals, and the blockhash. The
  contract source is verified beforehand, so there is nothing to take on
  trust.

## What must be in place beforehand

1. **Contract deployed and source-verified** on a public explorer, with:
   - `enter(bytes32 commitment)` — open until Friday 20:00:00 UTC
     (hard-coded `ENTRY_DEADLINE`), requires a small deposit (e.g. 0.02 ETH,
     refunded on reveal; see "if someone doesn't do their part").
   - `reveal(bytes32 secret)` — open from the deadline until
     `REVEAL_DEADLINE` (say 21:15 UTC); checks the hash, refunds the deposit.
   - `finalize()` — callable by anyone after `REVEAL_DEADLINE`; snapshots the
     revealed entrant list and sets `drawBlock = block.number + 2`.
   - `draw()` — callable by anyone once `drawBlock` is mined; computes
     `seed = keccak256(allRevealedSecrets) ^ uint256(blockhash(drawBlock))`,
     picks `winner = revealed[seed % revealed.length]` and transfers the
     5 ETH in the same transaction.
   - `cancel()` — only usable if fewer than 2 reveals happened; refunds
     revealers' deposits and returns the prize to the treasury.
   - No admin function that touches entries, the seed, or the prize.
2. **Treasury sends exactly 5 ETH to the contract** before entries open.
3. **Entrants told, in writing, before they enter**: keep your secret safe,
  you must be able to send one transaction between 20:00 and 21:15 UTC on
  Friday, deadlines are enforced by the contract, not by us.
4. **Gas plan**: entrants may not hold ETH for gas. Beforehand we fund one
  organizer-run relayer wallet with ~0.1 ETH from the treasury; entrants sign
  an EIP-712 message off-chain and the relayer submits `reveal()` on their
  behalf. (Relayer can only submit valid signed reveals — it cannot forge or
  censor selectively without the signature check failing, and entrants with
  their own gas can always self-submit.)
5. **A laptop on stage** with a block explorer open on the contract page, so
  the room watches each transaction land.

## The exact sequence on the night

| # | Step | Who sends it | Window |
|---|------|--------------|--------|
| 1 | Entries close automatically — `enter()` starts reverting at 20:00:00 UTC. No transaction needed. | — | 20:00 UTC |
| 2 | Each entrant reveals: `reveal(secret)` (self-sent, or signed off-chain and relayed). Deposit refunded per reveal. | Each entrant (or relayer for them) | 20:00–21:15 UTC |
| 3 | `finalize()` — snapshots the revealed list, sets `drawBlock = block.number + 2`. | Anyone (organizer does it on stage) | Any time after 21:15 UTC |
| 4 | Wait ~2 blocks (~24 s) for `drawBlock` to be produced. | — | minutes after step 3 |
| 5 | `draw()` — computes the seed, selects the winner, and sends 5 ETH to their wallet **in the same transaction**. | Anyone (organizer on stage) | After `drawBlock` is mined and before it ages out of blockhash range (8191 blocks ≈ 27 h; we do it within minutes) |

The prize lands in the winner's wallet the moment step 5 confirms — live, on
stage, on the projector.

## If someone doesn't do their part

- **An entrant doesn't reveal by 21:15** (forgot the secret, left early):
  their deposit is forfeited into the prize pot for next month, and they are
  excluded from the draw. This is what the deposit is for — without it, the
  last person to reveal could compute whether revealing loses them the prize
  and abort strategically. With the deposit plus the future blockhash,
  aborting costs money and buys nothing predictable.
- **Fewer than 2 reveals total**: `finalize()`/`draw()` revert; anyone calls
  `cancel()`, revealers get deposits back, and the 5 ETH returns to the
  treasury. A draw needs at least two independent entropy contributors or it
  isn't a draw.
- **Nobody calls `finalize()`**: nothing moves; the function is permissionless
  and has no deadline, so anyone can trigger it at any later point and the
  sequence simply resumes. Same for `draw()`.
- **`draw()` isn't called within ~27 h of `drawBlock`** (blockhash no longer
  retrievable): the contract falls back to a re-arm function — anyone calls
  `rearm()`, which sets a fresh `drawBlock = block.number + 2`, and the draw
  proceeds from there. Practically irrelevant since we draw within minutes.
- **A block proposer tries to grind `drawBlock`**: they'd have to (a) know
  every revealed secret, (b) find a block whose hash flips the outcome, and
  (c) be the proposer of that exact slot — and the revealed-secrets hash
  still dominates the seed. The cost and coordination required dwarf 5 ETH,
  and every input they could have used is publicly auditable afterwards.
- **Dispute afterwards**: the loser recomputes it themselves — commitments
  (pre-deadline), reveals, `drawBlock`, blockhash, index arithmetic are all
  onchain. There is no off-chain step in the critical path except generating
  a secret, and each entrant generated their own.
