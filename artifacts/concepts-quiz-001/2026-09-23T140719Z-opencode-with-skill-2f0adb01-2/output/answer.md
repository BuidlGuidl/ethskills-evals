# On-Stage Raffle: Entries Close → 5 ETH in the Winner's Wallet

## The scheme in one paragraph

Commit–reveal, anchored to a future blockhash. Every entrant commits a hash of a
secret when they enter; on the night, entrants reveal their secrets on stage;
after the reveal window closes, the contract pins a *future* block as the
randomness anchor; one transaction mixes that block's hash with all the revealed
secrets, picks the winner, and pushes the 5 ETH. No one — organizers included —
ever has a privileged role: the organizers never touch a secret, and the
entrants reveal *before* the anchor block exists, so nobody can compute the
outcome in advance. The whole thing is enforced by timestamps and permissionless
functions, so it also survives people not doing their part.

This is deliberately not Chainlink VRF or any third-party randomness service:
those need a paid/LINK-funded subscription, and the treasury holds ETH only.
Everything below runs on the contract plus the people in the room.

---

## What must be in place beforehand

1. **The contract, deployed and source-verified on a block explorer.** This is
   the foundation of "a loser can't credibly claim it was rigged": anyone can
   read the exact code that ran. It must have **no owner, no admin functions,
   no upgradeability, no pause** — any privileged key *is* the credible
   rigging case.
2. **Immutable parameters, set at deployment and published in advance:**
   - Entry window: opens immediately, closes **Friday 20:00:00 UTC**
     (`enter()` simply reverts after that timestamp).
   - Reveal window: **Friday 20:00 – 20:30 UTC** (during the meetup).
   - Refundable deposit per entrant (e.g. 0.02 ETH) — this is what makes
     "not doing your part" costly instead of free.
   - The treasury address (receives forfeited deposits back).
3. **Funded with exactly 5 ETH** from the treasury, in one visible transaction,
   before entries open. Anyone can verify the prize is really sitting in the
   contract.
4. **Entry mechanics:** entrants call `enter(bytes32 commitment)` with the
   deposit, where `commitment = keccak256(abi.encode(secret, theirAddress))`.
   The secret is a random 32-byte value generated locally. Binding the address
   into the hash means a revealed secret is useless to anyone else.
5. **Tell every entrant, at entry time, two things:** keep your secret safe
   (the frontend should show it, store it locally, and offer a printable/QR
   backup), and you must reveal it during the Friday reveal window or you're
   out and your deposit is forfeit. Losing the secret = same as not revealing.
6. **On the night:** a laptop/phone on stage with a wallet holding a little ETH
   for gas, and a projected page showing the contract's public state (eligible
   list, anchor block, and the winner computation) so the room can watch the
   draw resolve from inputs they can independently recompute.

---

## The sequence, Friday evening (all times UTC)

**Step 0 — 20:00:00. Entries close. No transaction.**
The cutoff is enforced passively: any `enter()` after the timestamp reverts.
Nothing needs to be poked, so there is nothing to forget and nobody to blame.
The entrant list and all commitments are now frozen onchain.

**Step 1 — 20:00–20:30. Reveals. Sender: each entrant, from their own wallet.**
On stage or from their seat, each entrant calls `reveal(secret)`. The contract
checks it against the stored commitment, marks the entrant eligible, and
refunds their deposit in the same transaction. Window: must land by the
**20:30 deadline**. (Anyone, anywhere can reveal — being in the room just makes
it a ceremony.)

**Step 2 — ~20:30–20:35. Pin the anchor. Sender: anyone.**
Once `block.timestamp` is past the reveal deadline, anyone calls `finalize()`.
We have the organizer do it on stage, but it is permissionless by design — any
attendee, or any stranger on the internet, could send it. The contract counts
the eligible revealers and records `anchorBlock = block.number + 2`. That
block does not exist yet: its hash is unknown to every person on Earth,
including the organizers, the entrants, and the validator who will propose it.

**Step 3 — ~20:35, about a minute later. Draw and payout. Sender: anyone.**
Anyone calls `draw()` — again, the organizer sends it live on stage, but any
attendee can. The contract requires `block.number > anchorBlock`, reads
`blockhash(anchorBlock)`, computes
`seed = keccak256(anchorBlockHash, hashOfAllRevealedSecrets)`, takes
`winnerIndex = seed % eligibleCount`, and **transfers the full 5 ETH to the
winner in that same transaction**. The prize lands in the winner's wallet
while everyone's still watching — call the winner up.
Hard window: `draw()` must be called within **256 blocks (~51 minutes) of
anchorBlock**, because `blockhash()` returns zero for older blocks. On the
night this is a non-issue; see failure modes for the contingency.

That's the whole evening: one batch of reveals, two permissionless
transactions, prize paid.

### Why this satisfies your two hard requirements

- **Nobody can foresee or influence the outcome.** Organizers hold no keys and
  no secrets — the contract gives them no functions anyone else doesn't have.
  Entrants reveal before the anchor block is mined, so at reveal time the
  blockhash half of the seed is unknowable; no entrant can time or withhold a
  reveal to their advantage (and withholding costs a deposit, so even blind
  griefing isn't free). Because the seed mixes many independent secrets *and*
  the blockhash, no single party — not even a room-wide collusion — can fix
  the result.
- **A loser can't build a credible rigging case.** The code is verified and
  immutable, the prize was verifiably locked in advance, every commitment is
  timestamped before the cutoff, and the winner is a pure function of public
  inputs (anchor blockhash + revealed secrets) that anyone can recompute off a
  block explorer in five minutes. There is no step where "trust us" is required.

---

## If someone doesn't do their part

**An entrant doesn't reveal by 20:30.**
They're excluded from the draw and their deposit is forfeit. No transaction is
needed to make this happen — `reveal()` reverts after the deadline and
`finalize()` only counts revealed entrants. The draw proceeds normally with
whoever revealed. After the draw, anyone can call `sweep()` to return all
forfeited deposits to the treasury. Note the ordering is what makes this safe:
since the anchor block doesn't exist during the reveal window, a non-revealer
cannot know whether revealing would have made them win — there is no informed
last-revealer attack, only uninformed self-exclusion at the cost of a deposit.

**Nobody calls `finalize()` or `draw()`.**
Nothing is automatic onchain, so the contract never pokes itself — but it
doesn't need an operator either. Both functions are permissionless, and every
entrant is incentivized to see the draw happen (the eventual winner most of
all); gas is a few cents. In practice the organizer sends both on stage, but if
they fell ill mid-sentence, any attendee's phone could do it from the projected
contract address.

**`draw()` isn't called within 256 blocks of anchorBlock (~51 minutes).**
`blockhash(anchorBlock)` starts returning zero. The contract must revert on a
zero blockhash rather than drawing from a known seed. Recovery: anyone calls
`reanchor()`, which sets a fresh `anchorBlock = block.number + 2`, and
`draw()` works again within the next 256 blocks. Re-anchoring introduces no
bias — the new anchor is exactly as unpredictable as the old one, so no caller
gains anything by triggering or delaying it.

**Almost nobody reveals (fewer than 2 eligible entrants).**
A one-person raffle is a farce, so `draw()` reverts. After a long backstop
timeout (e.g. 7 days), the contract opens a void path: each committed entrant
reclaims their deposit via `refund()`, and the treasury reclaims the 5 ETH via
the same permissionless `sweep()`. Nothing is ever stuck in the contract.

**The honest limitation, so nobody oversells it.**
The validator who happens to propose the anchor block can compute the outcome
before publishing and could withhold their block for a single blind re-roll —
at the cost of their block reward, with no control over what the re-roll
produces. That is not available to the organizers or to anyone in the room, it
costs money to attempt, it cannot pick a winner, and for a 5 ETH community
prize it is roughly break-even economics. If you ever scale this up
meaningfully, that's the point at which you'd revisit a VRF-style scheme and
the treasury would need to hold something other than ETH.
