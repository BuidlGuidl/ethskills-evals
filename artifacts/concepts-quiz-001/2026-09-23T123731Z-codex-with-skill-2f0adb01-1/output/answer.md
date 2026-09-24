Use an all-or-abort commit-reveal draw, with the entropy coming from people in
the room rather than from a paid randomness provider.

The important rule is this: if any required reveal is missing, the contract must
not draw from the remaining reveals. Drawing from a subset gives the missing
person influence over the winner. A missing reveal may be allowed to kill or
delay the round, but it must not be allowed to change which entrant wins.

## What must be in place beforehand

Deploy and verify the giveaway contract before the entry week starts. Fund it
with the 5 ETH prize, plus any small ETH caller bounties you want to pay for the
close/draw transactions. The contract should have immutable parameters:

- `entryClose = Friday 20:00 UTC`
- `prize = 5 ETH`
- a fixed reveal deadline, for example 20 minutes after `closeEntries()`
- the fixed list of draw witnesses and their commitment hashes
- no owner function that can change entries, witnesses, deadlines, the seed, or
  the winner

Before entries close, pick several draw witnesses who are present on the night
and are not entrants. Five is a reasonable minimum. Each witness privately
generates a high-entropy secret and salt, then posts an onchain commitment:

`commitment = keccak256(secret, salt, witnessAddress, witnessIndex, chainId, contractAddress)`

The witness list and commitment order are fixed before entries close. The final
seed later uses that fixed order, not reveal transaction order.

Each witness should also post a bond if you want an onchain penalty for failure
to reveal. The bond should be large enough that failing to reveal is painful.
The bond is not randomness; it is only the incentive that makes the ceremony
reliable.

Entrants enter onchain during the week before the deadline. The contract accepts
entries only while `block.timestamp < entryClose`. If one-person-one-entry
matters, the in-room check-in process must issue one credential per person and
the contract must enforce that credential. Otherwise the contract can only
promise one entry per address or per submitted credential, not one per human.

## Sequence after entries close

1. `closeEntries()`

Who sends it: anyone. In practice the host should have a funded wallet ready,
and an attendee should also be ready as a backup.

Window: as soon as possible after Friday 20:00 UTC, ideally 20:00-20:03 UTC.

What the contract does: freezes the entrant count and entrant root/list, rejects
all later entries, records the reveal deadline, and emits the frozen entrant
set. This transaction does not choose randomness and does not pick a winner.

2. `reveal(secret, salt, witnessIndex)`

Who sends it: each draw witness, or any relayer/attendee if the witness gives
them the secret and salt in the room.

Window: after `closeEntries()` and before the reveal deadline, for example
20:00-20:20 UTC if `closeEntries()` was mined at 20:00.

What the contract does: verifies that
`keccak256(secret, salt, witnessAddress, witnessIndex, chainId, contractAddress)`
matches the precommitted hash for that witness. Each valid reveal is stored once.
Late reveals, duplicate reveals, and reveals that do not match the commitment
are ignored or reverted.

After all but one witnesses have revealed, the last unrevealed witness can
compute what their reveal would do. That is why the contract is all-or-abort:
the last witness can refuse to reveal and get slashed, but cannot reveal one
value for one winner and a different value for another, because the commitment
was already fixed onchain.

3. `drawAndPay()`

Who sends it: anyone. The host should be ready to send it on stage, and the
contract can pay a small ETH bounty to the caller so an attendee has a reason to
do it too.

Window: immediately after all required reveals are recorded. For an on-stage
handover, this should be called the same evening as soon as the final reveal is
mined.

What the contract does:

`seed = keccak256("monthly-meetup-draw", chainId, contractAddress, frozenEntrantRoot, orderedCommitments, orderedReveals)`

`winnerIndex = uint256(seed) % frozenEntrantCount`

The contract marks the draw complete, records the winning address, and transfers
5 ETH to that address in the same transaction. If the winning address is a
contract that rejects ETH, the contract must not redraw; it records the 5 ETH as
claimable by that same winner instead.

## If someone does not do their part

If nobody calls `closeEntries()`, nothing happens automatically. The contract
still rejects entries after Friday 20:00 UTC, but the reveal phase does not
start until someone sends `closeEntries()`. Anyone can send it later; the cost is
that the on-stage schedule slips.

If a witness does not reveal before the deadline, the contract must not pick a
winner from the partial set of reveals. Anyone may call `abortRound()` after the
deadline. The missing witness's bond is slashed according to the rules set in
advance, and the 5 ETH prize either stays locked for a new draw using the same
frozen entrant set and a new precommitted witness set, or returns to the treasury
if the published rules say a failed round is cancelled.

If all witnesses reveal but nobody calls `drawAndPay()`, the prize simply remains
in the contract. Smart contracts do not wake themselves up. The winner is already
determinable from the public reveals, but the ETH does not move until someone
sends the transaction.

If there are zero entrants, `drawAndPay()` must revert and the contract should
return the prize to the treasury or mark the round cancelled under the published
rules.

The fairness tradeoff is deliberate: the contract allows a non-cooperating
witness to stop the same-night payout, but it does not allow that witness, the
organizers, or a transaction caller to steer the prize to a chosen entrant.
