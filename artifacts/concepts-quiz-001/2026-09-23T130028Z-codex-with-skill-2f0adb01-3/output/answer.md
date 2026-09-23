Use an all-or-abort commit/reveal draw. The important rule is that the
contract must never fall back to "draw from the people who revealed" or
"let the organizers pick a new random source". If the required ceremony is not
completed in time, the giveaway aborts or rolls over. That is the price of
making the awarded draw defensible without a paid randomness provider.

Before Friday
-------------

Have these things in place before entries close:

1. Deploy and verify an immutable giveaway contract.

   It should have:

   - `entryClose = Friday 20:00 UTC`
   - `prize = 5 ether`
   - a fixed reveal length, for example about 75 blocks after close
   - a fixed settlement window short enough that the contract can still read the
     selected future blockhashes
   - no owner/admin function that can add, remove, reorder, pause, redraw, or
     redirect the prize after deployment
   - one entry per eligible wallet or ticket
   - a commitment stored for each entrant:
     `commitment = keccak256(entrantAddress, secret, salt)`
   - a small ETH reveal bond if you want a penalty for no-shows; it is refunded
     only when that entrant reveals correctly

2. Fund the contract from the treasury with exactly the 5 ETH prize, plus any
   optional ETH reserved for caller rewards or reveal-bond accounting.

3. During the entry week, each entrant generates their own secret locally and
   calls `enter(commitment)` from the wallet that will receive the prize if they
   win. The contract rejects duplicate entries and rejects entries at or after
   Friday 20:00 UTC.

4. Publish the contract source, the entry list, and the exact timing rules
   before the event, so every entrant can independently recompute the result
   afterwards.

Sequence after entries close
----------------------------

1. Close entries.

   Transaction: `closeEntries()`

   Sender: anyone. In practice, the meetup team should send it immediately, and
   at least one attendee should be ready to send it too.

   Window: any time at or after Friday 20:00 UTC, ideally within the first few
   minutes.

   Contract behavior: freezes the entry list forever, records the final entrant
   count and entry root, opens the reveal phase, and schedules the future
   entropy blocks by formula. For example:

   - `firstEntropyBlock = block.number + 90`
   - `lastEntropyBlock = firstEntropyBlock + 31`

   The reveal phase ends just before `firstEntropyBlock`. The entropy blocks are
   fixed before any reveals happen, and they are still in the future, so the
   organizers, entrants, and caller cannot know their hashes. The contract must
   not let anyone add, delete, or reorder entries after this point.

2. Entrants reveal.

   Transaction: `reveal(secret, salt)`

   Sender: every entrant, from the same wallet used to enter.

   Window: after `closeEntries()` and before `firstEntropyBlock`. With the
   example numbers above, this is roughly the first 15 minutes after entries are
   closed.

   Contract behavior: checks that
   `keccak256(msg.sender, secret, salt)` matches the stored commitment, marks
   that entrant as revealed, stores or accumulates the revealed entropy in a
   deterministic order, and refunds that entrant's reveal bond if one was used.

   The reveal happens before the final randomness blocks exist, so no entrant
   can know whether revealing helps or hurts them.

3. Wait for the entropy blocks to be mined.

   Transaction: none.

   Sender: nobody. The contract does not run by itself; people are only waiting
   for Ethereum to produce the already scheduled blocks.

4. Settle and pay the winner.

   Transaction: `settle()`

   Sender: anyone. The team should send it on stage, with backup attendees ready
   to send the same transaction if needed.

   Window: after `lastEntropyBlock` is mined, only if every entrant revealed
   before `firstEntropyBlock`, and before the relevant blockhashes expire. With
   the ordinary `blockhash()` opcode, that means before the oldest entropy block
   is more than 256 blocks old, so treat this as a short operational window and
   do it immediately.

   Contract behavior:

   - checks the draw was scheduled
   - checks all required blockhashes are still available
   - computes:
     `seed = keccak256(entryRoot, revealAccumulator, blockhash(firstEntropyBlock), ..., blockhash(lastEntropyBlock))`
   - computes `winnerIndex = uint256(seed) % entryCount`
   - reads the winner address from the frozen entry list
   - transfers exactly 5 ETH to that address in the same transaction
   - marks the giveaway settled so it can never be redrawn

What if someone misses their part?
---------------------------------

If nobody calls `closeEntries()` at 20:00 UTC, nothing happens automatically.
The contract just sits there. Anyone can still call it later, but the event team
should have multiple prepared callers because every state transition needs a
transaction.

If an entrant does not reveal before the reveal deadline, the contract must not
draw from the remaining entrants. After the deadline, anyone can call
`abortMissingReveal()`. The contract marks the giveaway aborted, forfeits that
entrant's reveal bond if one was required, and leaves the 5 ETH for the
treasury/next meetup according to the prepublished rollover rule. This is
annoying, but it is what prevents a missing reveal from becoming a way to bias
the winner.

If not all entrants reveal, there is no same-night winner. Do not add a
"manual override", "admin redraw", or "use the last blockhash instead" escape
hatch. Those are exactly the hooks a losing entrant can point to afterwards.

If nobody calls `settle()` before the blockhashes expire, the contract must not
invent replacement randomness. Anyone can call `expireDraw()`, which marks the
draw expired and rolls the 5 ETH according to the prepublished rule. The right
failure mode is "no prize awarded", not "someone gets to choose a new entropy
source".

One caveat to state publicly
----------------------------

With no paid VRF/oracle, you cannot get perfect mathematical randomness with a
guaranteed same-evening payout under every failure case. Ethereum validators can
always have a tiny amount of influence over block production, and people can
always fail to send required transactions. This design makes the successful
path publicly recomputable and removes organizer discretion; when the required
steps are not completed, the contract refuses to award a potentially biased
prize.
