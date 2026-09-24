# Meetup ETH giveaway sequence

Use a commit-reveal raffle whose final seed also includes a future blockhash. Do not use an organizer-supplied number, `block.timestamp`, the current blockhash, or a draw transaction that lets the caller choose from already-known randomness.

There is one hard boundary: with no VRF or other external randomness provider, the contract cannot remove validator/proposer bias against the chosen future block. The sequence below prevents the organizers and entrants from foreseeing or choosing the winner. If the requirement literally includes every possible block proposer, then the constraints are incompatible and the giveaway should not be run this way.

## What must be in place before Friday

- A verified, non-upgradeable raffle contract deployed with immutable parameters:
  - `entryClose = Friday 20:00 UTC`.
  - `revealClose = Friday 20:20 UTC` or another short window that still gives attendees enough time to reveal from the room.
  - `drawDelayBlocks`, for example 5 to 10 mainnet blocks, so the draw block is still in the future when it is fixed.
  - `prize = 5 ETH`.
- The treasury funds the contract with the 5 ETH prize before entries open.
- The contract has no owner ability to add, remove, reorder, pause, redraw, or pick entrants after deployment.
- Anyone can call the operational functions. They should pay a small ETH caller reward so an attendee has a reason to move the contract along. The reward can come from entry bonds, forfeited bonds, or a small extra ETH amount funded up front.
- During the entry week, each attendee enters with:
  - their payout address,
  - a commitment `keccak256(raffleId, entrantAddress, payoutAddress, secret, salt)`,
  - a small refundable ETH bond.
- The entrant keeps `secret` and `salt` private until reveal time. The commitment is bound to their address and payout address so nobody can copy it into a different entry.
- The entry list is append-only and public. Late entries revert after `entryClose`.

## From close to prize payment

1. **Entries close automatically at Friday 20:00 UTC.**

   No transaction is required for this state change. From the first block whose timestamp is at or after 20:00 UTC, `enter()` reverts.

2. **Entrants reveal: Friday 20:00-20:20 UTC.**

   Each entrant sends `reveal(secret, salt)`.

   The contract checks the reveal against the stored commitment and, if it matches, adds that entrant to the revealed set and updates a running entropy accumulator, for example:

   `revealEntropy = keccak256(revealEntropy, entrantAddress, payoutAddress, secret, salt)`.

   Reveals before 20:00 UTC or after 20:20 UTC revert. Non-revealed entries are not eligible to win.

3. **Fix the future draw block: immediately after 20:20 UTC, ideally by 20:22 UTC.**

   Anyone in the room sends `lockDrawBlock()`.

   The contract requires `block.timestamp >= revealClose`, requires at least one valid reveal, freezes the final revealed count and entropy accumulator, and sets:

   `drawBlock = block.number + drawDelayBlocks`.

   This transaction does not choose the winner because `blockhash(drawBlock)` is not known yet.

4. **Wait for the draw block to be mined.**

   Nobody sends a transaction during this wait. The important fact is that the future block was fixed before its hash existed.

5. **Settle and pay: after `drawBlock` is mined, before its blockhash expires.**

   Anyone sends `settle()`. On Ethereum mainnet this must happen within 256 blocks of `drawBlock`, roughly 51 minutes. For an on-stage draw, send it as soon as the draw block has at least one confirmation.

   The contract computes:

   `seed = keccak256(revealEntropy, blockhash(drawBlock), address(this), raffleId)`.

   Then:

   `winnerIndex = uint256(seed) % revealedCount`.

   The contract marks the raffle settled and transfers 5 ETH to the stored payout address for that winner. If the direct ETH transfer fails, the contract records the 5 ETH as claimable by the winning payout address, and the winner sends `claimPrize()` from that address to pull it.

## What happens if someone misses their part

- **An entrant does not reveal by 20:20 UTC.**

  They are ineligible. Their bond is forfeited or used for caller rewards. The contract does not let them reveal late, because a late reveal would let someone react to more information than everyone else had.

- **Only one entrant reveals.**

  That entrant wins when `settle()` runs. This is not a randomness failure; it means only one entered address completed the public eligibility process.

- **No entrant reveals.**

  `lockDrawBlock()` reverts. There is no winner. After a fixed cancellation delay, the treasury can recover the 5 ETH prize and entrants can recover any bonds that the rules say are refundable. The contract must not invent a fallback winner from unrevealed entries.

- **Nobody calls `lockDrawBlock()` right after 20:20 UTC.**

  Nothing happens automatically. Any attendee can still call it later, and the caller reward is there to make that worthwhile. The prize can still be awarded, just late. The contract should not give the organizer a special-only function here.

- **Nobody calls `settle()` before the blockhash is available.**

  If the target chain only exposes the last 256 blockhashes and that window is missed, the raffle should fail closed: no redraw, no organizer override, and no alternate randomness. Redrawing after everyone can look up what the missed block would have produced creates exactly the kind of rigging argument you are trying to avoid. The contract should allow cancellation and treasury recovery only after the settlement window is gone.

- **The winner's payout address cannot receive ETH.**

  `settle()` records the winner and the owed 5 ETH. The winner can later call `claimPrize()` if their address can execute the receive path. The contract must not pick a different winner because payment failed.

- **The organizers disappear.**

  The raffle still works as long as attendees transact. Entrants reveal, anyone locks the draw block, and anyone settles. The contract moves only when someone sends a transaction, so have at least two funded attendees ready to send the operational calls on the night.

This gives a losing entrant a clean audit trail: the entry set was closed before reveals, each eligible entrant revealed before the future draw block was fixed, the draw block hash did not exist when reveals were made, the winner index is a deterministic calculation from public data, and there is no owner path to replace the result.
