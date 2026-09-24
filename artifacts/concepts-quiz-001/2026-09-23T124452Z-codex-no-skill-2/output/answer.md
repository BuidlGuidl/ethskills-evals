Use a public randomness beacon whose output has an onchain-verifiable proof, and
let anyone in the room relay that proof. Do not use `block.timestamp`,
`blockhash`, `prevrandao`, or a meetup-run commit/reveal ceremony as the final
randomness source. Those all leave some party with timing, withholding, or block
production optionality. If an external verifiable beacon is not allowed at all,
then the stated requirements cannot all be met.

The sequence below assumes the raffle contract can verify the beacon's signature
or proof onchain, and that the beacon round used for the draw is fixed before
entries open.

## Before the night

Deploy a raffle contract with these immutable parameters:

- `entryClose`: Friday 20:00 UTC.
- `prize`: 5 ETH.
- `primaryBeaconRound`: the first beacon round scheduled after `entryClose`
  plus a short safety margin, for example the round scheduled for 20:05 UTC.
- Optional backup beacon rounds, also fixed before entries open, in strict
  order. These are only for beacon non-publication or an invalid proof, not for
  disliking the winner.
- The beacon public key / verifier data needed to check the proof onchain.
- The treasury address and a rule that the treasury cannot withdraw the 5 ETH
  once at least one valid entry exists, except through the contract's explicit
  no-entrant or beacon-failure paths.

Fund the contract with exactly the 5 ETH prize before entries open.

Entrants submit their entry transactions during the week before Friday 20:00 UTC.
The contract stores the entrant wallet addresses in order, rejects duplicate
entries if that is part of the rules, and rejects any entry with
`block.timestamp >= entryClose`.

Have at least two people in the room ready with independent devices and ETH for
gas. Their only job is to relay the public beacon proof to the contract. They do
not need treasury authority and they do not need a paid provider account.

The contract should derive the winner as:

`seed = keccak256(beacon_randomness, chain_id, contract_address, raffle_id, entrant_root)`

Then choose the winner from the frozen entrant list using deterministic rejection
sampling, or an equivalently unbiased method, rather than giving an admin any
choice.

## On the night

1. Entries close automatically at Friday 20:00 UTC.

   No transaction is needed for the close itself. From this timestamp onward,
   `enter()` reverts. This matters because a delayed organizer transaction
   cannot extend or shrink the entrant set.

2. Freeze the entrant set.

   Transaction: `finalizeEntries()`

   Sender: anyone. In practice, the organizer should send it immediately, and
   the backup device should be ready to send it too.

   Window: Friday 20:00 UTC until before the draw transaction. The intended
   operating window is 20:00-20:02 UTC.

   Contract effect: records the final entrant count and entrant root. If nobody
   calls this separately, `settle()` may perform the same finalization lazily,
   using the timestamp-closed entry list. No caller can add or remove entrants.

3. Wait for the fixed beacon round.

   Transaction: none.

   Window: from 20:00 UTC until the precommitted beacon round is publicly
   available, for example about 20:05 UTC.

   Nobody in the meetup can know this value before publication, and nobody in
   the meetup can change which round the contract will accept.

4. Relay the beacon proof and pay the winner.

   Transaction: `settle(round, randomness, proof)`

   Sender: anyone in the room. The organizer can send it, but should not be the
   only prepared sender.

   Window: as soon as the fixed beacon round is published. For the on-stage
   handover, target 20:05-20:15 UTC. The contract should keep accepting the same
   valid round after that; it must not create a new draw merely because nobody
   submitted promptly.

   Contract effect:

   - verifies that `round` is the precommitted primary round, or the first
     still-valid precommitted backup round if the primary was not published or
     cannot be proven valid;
   - verifies the beacon proof against the hardcoded verifier data;
   - freezes the entrant root if it has not already been frozen;
   - computes the seed from the beacon randomness and the frozen raffle data;
   - computes the winner index deterministically;
   - marks the raffle settled before sending ETH;
   - transfers 5 ETH to the winning entrant's wallet;
   - emits an event containing the round, randomness/proof identifier, entrant
     root, winner index, and winner address.

After this transaction, a losing entrant can recompute the entrant list, verify
the beacon proof, recompute the seed, and check that the contract paid the only
address the rules allowed.

## If someone does not do their part

If an entrant misses the entry deadline, `enter()` reverts. There is no manual
override.

If the organizer does not finalize at 20:00 UTC, anyone else can finalize. If
nobody finalizes, `settle()` finalizes from the already timestamp-closed list.
The organizer's delay cannot change the entries.

If the first relay transaction uses the wrong round, bad randomness, or an
invalid proof, it reverts. Anyone can submit the correct proof afterward.

If nobody submits the beacon proof during the stage slot, the contract does not
reroll and does not let the organizer pick a replacement source. The same
precommitted beacon round remains the only valid source, so the same winner will
be paid whenever someone finally calls `settle()`.

If the primary beacon round is genuinely unavailable or unverifiable, the
contract may move only to the next backup round that was fixed before entries
opened. It cannot choose a convenient new round after seeing any randomness. If
all precommitted rounds fail, the raffle is cancelled by rule and the 5 ETH
returns to the treasury or rolls over according to the predeclared contract
logic. There is no ad hoc redraw.

If there are zero entrants at 20:00 UTC, `settle()` reverts and anyone can call
the no-entrant cancellation path. The prize returns to the treasury.

If the winner address rejects a direct ETH transfer, the contract must not pick
a different winner. It records the same winner and makes the 5 ETH withdrawable
by that address.

The important invariant is that every failure path is predetermined and visible
onchain. A missed action can delay or cancel under explicit rules, but it cannot
give the organizer, a relayer, or an entrant a chance to choose among possible
winners after learning which outcome they prefer.
