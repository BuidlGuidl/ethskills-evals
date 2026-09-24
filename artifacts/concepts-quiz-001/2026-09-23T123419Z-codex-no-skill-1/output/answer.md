# Defensible raffle sequence

For the September 2026 meetup, entries close on Friday 2026-09-25 at
20:00 UTC. The contract should not try to get randomness from the organizers,
from a block chosen by the organizers, or from a paid VRF subscription. Under
the stated constraints, the defensible design is an all-reveal commit/reveal
raffle: every entrant contributes hidden entropy before entries close, and the
winner is paid only if every entrant reveals on time.

The important consequence is that the contract must prefer "no draw" over "draw
with missing reveals". Continuing after a missing reveal gives the last
non-revealer a choice between two outcomes, which is enough for a losing entrant
to say the winner was influenceable.

## What must be in place beforehand

- Deploy a raffle contract with:
  - `entryDeadline = 2026-09-25 20:00:00 UTC`.
  - `revealDeadline`, for example 20:20:00 UTC the same evening.
  - The 5 ETH prize already escrowed in the contract from the treasury.
  - A fixed `raffleId`, the chain id, and the contract address included in every
    commitment, so old secrets cannot be replayed into this raffle.
  - An `enter(commitment)` function open only before 20:00 UTC.
  - A `reveal(secret)` or `revealFor(entrant, secret, signature)` function open
    only from 20:00 UTC through 20:20 UTC.
  - A `drawAndPay()` function that succeeds only after all entrants have
    revealed, computes the winner deterministically, and transfers 5 ETH in the
    same transaction.
  - A `voidRaffle()` or `finalizeFailed()` function callable after 20:20 UTC if
    at least one entrant failed to reveal.
- Each entrant must enter during the week by submitting:
  - Their entrant address.
  - `commitment = keccak256(raffleId, chainId, raffleContract, entrant, secret)`.
  - Optionally, a reveal bond. The bond is useful to deter no-shows, but it is
    not what makes the draw unbiased. The no-biased-fallback rule does that.
- Entrants must keep their `secret` private until entries have closed.
- The meetup should have several funded wallets in the room ready to submit
  transactions. If the contract supports `revealFor`, entrants can sign a reveal
  message locally and a designated attendee can pay gas to submit it; the
  transaction sender still has no say in the randomness.
- The entry list and all commitments should be visible before 20:00 UTC, ideally
  on a simple page that reads directly from the contract.

## Onchain sequence after entries close

1. Entries close automatically at 20:00 UTC.

   Sender: no transaction is required if `enter` checks `block.timestamp <
   entryDeadline`.

   Window: exactly at and after 20:00 UTC, `enter` must revert. The entrant set
   is frozen.

2. Each entrant reveals their secret.

   Sender: the entrant sends `reveal(secret)`, or any attendee sends
   `revealFor(entrant, secret, signature)` if the entrant signed an authorization
   for this raffle.

   Window: 20:00:00 UTC through 20:20:00 UTC.

   Contract behavior: the contract recomputes
   `keccak256(raffleId, chainId, raffleContract, entrant, secret)` and checks it
   equals the commitment submitted during entry. If it matches, the entrant is
   marked revealed and the secret is included in the entropy transcript. If it
   does not match, the transaction reverts.

3. Once every entrant has revealed, pay the winner.

   Sender: anyone in the room can send `drawAndPay()`. It should not be limited
   to the organizers.

   Window: as soon as the last reveal lands, ideally immediately after that and
   before going on stage. If all reveals arrive at 20:08 UTC, `drawAndPay()` can
   be called at 20:08 UTC; there is no need to wait until 20:20 UTC.

   Contract behavior: the contract verifies that entries are closed, every
   entrant has revealed, and the raffle has not already been paid or voided. It
   computes a seed from the complete public transcript, for example:

   `seed = keccak256(raffleId, chainId, raffleContract, orderedEntrants,
   orderedCommitments, orderedRevealedSecrets)`

   The winner is:

   `winner = orderedEntrants[uint256(seed) % orderedEntrants.length]`

   The same transaction transfers exactly 5 ETH to `winner` and marks the
   raffle paid. The contract emits the winner, seed, and transcript hash.

## If someone does not do their part in time

- If an entrant does not reveal by 20:20 UTC, `drawAndPay()` must never fall back
  to "draw among the revealers" or "ignore the missing secret". That fallback is
  biasable: the missing entrant had the option to reveal or not after learning
  other reveals.
- After 20:20 UTC, anyone can call `finalizeFailed()`/`voidRaffle()`.
- The contract marks the raffle failed, emits the addresses that did not reveal,
  and permanently disables `drawAndPay()` for this raffle.
- If reveal bonds were required, non-revealers forfeit their bonds according to
  the published rules, for example to the treasury or pro rata to revealers.
- The 5 ETH prize is not awarded from this failed raffle. It should either remain
  locked for the next month's raffle or return to the treasury, depending on the
  rule hard-coded before entries opened.
- Late reveals after 20:20 UTC revert or are recorded only for evidence; they do
  not revive the raffle.

This is the tradeoff the contract has to make explicit. With no paid randomness
provider and no pre-existing threshold randomness setup, the contract can give
you an unbiased, auditable draw if everyone reveals, or it can give you a
guaranteed same-evening payout with a biasable timeout rule. It cannot honestly
guarantee both. For this meetup's stated priorities, the correct timeout
behavior is to fail visibly rather than pick a winner from manipulable entropy.
