The clean way to do this without a paid randomness provider is a committed
entropy ceremony with an abort path. It gives an unbiased payout only on the
assumption that at least one committed witness secret stays private until the
reveal phase and that every witness reveals on time. If those conditions fail,
the contract must fail the raffle rather than manufacture randomness.

The contract must never fall back to `blockhash`, `block.prevrandao`, "owner
redraw", or "use whoever revealed"; those all give somebody a credible argument
that timing or withholding changed the winner.

## Before Friday night

Have the raffle contract deployed and funded with exactly the prize amount,
5 ETH, plus any separately handled operating gas outside the prize pool.

The contract needs these fixed parameters:

- `entryClose = Friday 20:00 UTC`.
- A short reveal window, for example `20:00:00` to `20:15:00 UTC`.
- A fixed list of entropy witnesses who will be in the room and are not
  entrants in this raffle.
- A meaningful ETH bond from each witness, posted to the raffle contract.
- A rule that the draw is valid only if every listed witness reveals on time.
- A rule that if any witness misses the reveal deadline, the draw is aborted,
  late/missing witnesses lose their bonds, and the 5 ETH prize stays locked for
  treasury recovery or for a new raffle under a new ceremony.

Before entries open, each witness privately chooses a high-entropy secret and
sends a commit transaction with their ETH bond:

```text
commit = keccak256(raffleId, witnessAddress, secret)
```

The contract records one commitment per witness and then opens entries. The
witnesses must not reveal their secrets before entries close. Making the
commitments before entries open avoids an argument that witnesses chose secrets
after seeing the entrant list.

Entrants enter onchain during the entry period. The contract should close
entries by timestamp, not by an owner transaction. At or after `20:00 UTC`, no
new entry is accepted.

## On-stage sequence

1. Entries close automatically

   No transaction is needed. From `Friday 20:00:00 UTC` onward, the contract's
   `enter()` function reverts.

2. Freeze the entrant set

   Transaction sender: anyone.

   Window: as soon as possible after `20:00:00 UTC`, before reveals are used.

   The transaction calls `freezeEntries()`, or the equivalent draw-preparation
   function. The contract records the final entrant count and, if applicable,
   the entry Merkle root or array length. This prevents anyone arguing later
   that the entrant list changed between entropy reveal and payout.

3. Witnesses reveal their secrets

   Transaction senders: each listed entropy witness sends their own `reveal`
   transaction.

   Window: `20:00:00` through `20:15:00 UTC`.

   Each witness calls:

   ```text
   reveal(secret)
   ```

   The contract checks that:

   ```text
   keccak256(raffleId, msg.sender, secret) == storedCommit[msg.sender]
   ```

   Valid reveals are stored. Invalid or duplicate reveals revert.

4. Draw and pay the winner

   Transaction sender: anyone.

   Window: immediately after all required witnesses have revealed, ideally on
   stage before the reveal window ends. It may also be allowed after the reveal
   window, as long as every reveal arrived on time.

   The caller invokes `draw()`. The contract computes:

   ```text
   seed = keccak256(
       raffleId,
       address(this),
       chainid,
       frozenEntrantCount,
       frozenEntrantRootOrHash,
       secret1,
       secret2,
       ...,
       secretN
   )
   winnerIndex = uint256(seed) % frozenEntrantCount
   winner = entrants[winnerIndex]
   ```

   The contract marks the raffle drawn before making any external call, then
   sends the 5 ETH prize to `winner`.

   If direct payment to the winner succeeds, the prize has landed in the
   winner's wallet in this transaction.

   If the winner address is a contract that refuses ETH, the contract must not
   redraw. It records the same winner with a withdrawable 5 ETH balance, and
   only that winner can later claim it.

## Why this is defensible

No witness can foresee the final seed before reveal unless every witness has
leaked their secret. Because the commitments were made before reveal, no witness
can change their secret after seeing the entrant set or other reveals.

This is not the same as a VRF. If all entropy witnesses collude and share their
secrets early, they can know the result early. That is why the witnesses should
be unaffiliated, public, non-entrants, and bonded, and why the contract's only
safe response to missing entropy is cancellation rather than a fallback draw.

The important contract rule is all-or-nothing reveal. A witness who withholds
must not cause the contract to use the partial set of reveals, because the last
revealer could otherwise choose between "include my secret" and "exclude my
secret". That is enough to make the draw look rigged. With the all-or-nothing
rule, withholding can only kill the draw and forfeit the bond; it cannot select
a different winner.

## If someone misses their window

If an entrant tries to enter after `20:00 UTC`, `enter()` reverts. They are not
part of the frozen entrant set.

If nobody calls `freezeEntries()` immediately, that is not fatal as long as the
contract derives the entrant set only from entries accepted before
`20:00 UTC`. Freezing can be called later by anyone. Reveals and draw should use
only that frozen set.

If a witness fails to reveal by the reveal deadline, `draw()` reverts forever
for this raffle. The contract exposes a `cancel()` or `finalizeFailed()` function
callable by anyone after `20:15:00 UTC`. That function:

- marks the raffle failed;
- slashes the bonds of witnesses who did not reveal valid secrets on time;
- leaves the 5 ETH prize unavailable for a winner from this failed draw; and
- allows the treasury, after any advertised grace period, to recover the prize
  or roll it into a newly deployed/newly parameterized raffle.

If a witness reveals the wrong secret, their reveal reverts and they are treated
as not having revealed unless they submit the correct secret before the
deadline.

If all witnesses reveal on time but nobody calls `draw()` immediately, anyone
can still call it later. The winner is already determined by the committed
secrets and the frozen entrant set; the caller and call time do not get to pick
a different winner.

If there are zero valid entrants at close, `draw()` reverts and the raffle is
cancelable; the prize returns to the treasury under the same advertised recovery
rule.
