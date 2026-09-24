# Meetup 5 ETH Draw

The contract cannot produce honest randomness by itself. With no VRF subscription or funded oracle, the workable ceremony is a bonded commit-reveal draw using ETH only.

The important rule is that every person whose secret can affect the winner must have more ETH at risk than the 5 ETH prize. Otherwise the last revealer can look at the partial seed, decide whether revealing helps, and withhold to change the result. If a 5 ETH-plus bond is not acceptable, then the requirement that nobody can influence the winner is not achievable under these constraints.

## Before the night

- Deploy a raffle contract with the following fixed parameters:
  - `entryClose = Friday 20:00 UTC`.
  - `revealClose`, for example Friday 21:00 UTC.
  - `prize = 5 ETH`.
  - `entropyBond > 5 ETH`, paid in ETH.
  - `minEntropyRevealers`, for example 3.
  - A permissionless `finalize()` function and a small ETH caller reward so nobody has to trust the organizers to send the final transaction.
- Fund the contract from the treasury with:
  - 5 ETH for the prize.
  - The finalizer reward.
  - Any ETH needed for failed-draw handling, if the design refunds entrants or pays caller rewards there.
- During the week before the meetup, entrants call `enter()` from the wallet that should receive the prize. Entries close automatically at `entryClose`; the owner cannot add, remove, or edit entrants after that.
- Before entries close, select public entropy volunteers from people who will be in the room. They may be organizers, attendees, or entrants, but each one must call `commitEntropy(commitment)` before `entryClose` and lock `entropyBond`.
  - `commitment = keccak256(abi.encode(chainid, raffleAddress, roundId, revealerAddress, secret, salt))`.
  - Each volunteer keeps `secret` and `salt` private until the reveal window.
  - Binding the commitment to the chain, contract, round, and revealer address prevents copying or replaying another person's commitment.
- Publish the entrant list, entropy revealer addresses, commitments, close time, reveal deadline, and contract source before the draw starts.

## Sequence After Entries Close

1. At Friday 20:00 UTC, entries are closed by time.
   - Transaction: none required.
   - Who sends it: nobody.
   - Window: exactly at and after `entryClose`.
   - Contract behavior: `enter()` and `commitEntropy()` revert once `block.timestamp >= entryClose`. The entrant set and entropy commitment set are frozen.

2. Anyone calls `sealEntries()`.
   - Who sends it: anyone in the room, an organizer, or any outside caller.
   - Window: from Friday 20:00 UTC until the first valid reveal.
   - Contract behavior: records the final entry count and moves the round to `Revealing`. This function must be permissionless. If nobody calls it, the first `revealEntropy()` call can seal implicitly before processing the reveal.

3. Entropy volunteers reveal their secrets onchain.
   - Who sends it: each committed entropy volunteer sends their own `revealEntropy(secret, salt)` transaction from the address that committed.
   - Window: Friday 20:00 UTC through `revealClose`, for example 20:00-21:00 UTC.
   - Contract behavior: verifies the hash matches the stored commitment, marks that revealer as revealed, and mixes the secret into the round seed. A revealer cannot reveal twice or reveal from a different address.

4. Anyone calls `finalize()`.
   - Who sends it: anyone; usually an organizer on stage, but it must not be organizer-only.
   - Window: after `revealClose`, or earlier only if every committed entropy volunteer has revealed. This prevents the finalizer from choosing to exclude a late-but-still-on-time reveal.
   - Contract behavior:
     - Computes `seed = keccak256(abi.encode(roundId, entryRoot, revealedSecretsHash))`.
     - Computes `winnerIndex = uint256(seed) % entryCount`.
     - Pays exactly 5 ETH directly to the winner's entry wallet.
     - Refunds the entropy bonds for revealers who revealed on time.
     - Pays the finalizer reward to `msg.sender`.
     - Emits the winner, the seed inputs, the entry count, and the revealed entropy contributors.

5. The winner receives the ETH in the same transaction as `finalize()`.
   - Who sends it: no separate winner action is required.
   - Window: immediately when `finalize()` is mined.
   - Contract behavior: uses a direct ETH transfer/call to the winner address and then marks the round finalized so it cannot be drawn again.

## If Someone Misses Their Window

If an entrant misses the entry deadline, their transaction reverts. They are not in the draw, and nobody can manually add them.

If nobody calls `sealEntries()`, nothing important is stuck. The first reveal can seal the entry count permissionlessly before processing the reveal.

If an entropy volunteer does not reveal by `revealClose`, anyone can call `slashMissedReveal(revealer)`.

- Who sends it: anyone.
- Window: after `revealClose`.
- Contract behavior: the non-revealer's bond is forfeited. They do not contribute entropy. They do not get their bond back. The slashed ETH should be paid pro rata to entrants, added to a future community treasury bucket, or otherwise distributed by a rule fixed before the round; it must not be paid to the organizers by discretion.

If at least `minEntropyRevealers` reveal on time, the draw still finalizes using only the valid revealed secrets. The public record shows exactly who failed to reveal and what it cost them.

If fewer than `minEntropyRevealers` reveal on time, the draw must not fall back to `block.timestamp`, `block.prevrandao`, organizer choice, or a private offchain draw. Instead, anyone can call `cancelRound()`.

- Who sends it: anyone.
- Window: after `revealClose`.
- Contract behavior:
  - Marks the round canceled.
  - Slashes all missed-reveal bonds.
  - Returns the 5 ETH prize to the treasury or rolls it into a newly created replacement round, according to the rule fixed at deployment.
  - Leaves an auditable event trail explaining that the randomness threshold was not met.

If the finalizer transaction fails because the winner address rejects ETH, the contract should not let that block the ceremony. Prefer recording the winner and crediting a withdrawal balance for that address, then allow the winner to call `withdrawPrize()` later. If the winner is an ordinary wallet, the 5 ETH lands during `finalize()`; if it is a contract wallet with unusual receive logic, the winner still owns an onchain claim to the exact 5 ETH.

## Why A Losing Entrant Cannot Credibly Call It Rigged

The entrant list is frozen before any secrets are revealed. The commitments are public before entries close, but the secrets are not known until after entries close. The final seed is derived only from committed secrets revealed onchain, so anyone can recompute the winner from the event log.

The only practical way for a revealer to influence the result is to withhold their reveal after seeing other reveals. The contract answers that by making withholding cost more than the whole prize and by canceling rather than improvising if too few independent secrets appear. That does not make entropy appear from nowhere; it makes cheating visible, expensive, and unable to produce a discretionary organizer-picked winner.
