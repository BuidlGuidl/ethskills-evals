# Providerless onchain giveaway sequence

With the treasury constraint, do not pretend this is Chainlink VRF. A contract,
the entrants, and the people in the room can give you a public, auditable
commit/reveal draw whose result the organizers and entrants cannot know in
advance. It cannot remove the residual Ethereum block-proposer risk entirely:
the proposer of a future block can always choose not to publish a block. If the
requirement is literally "no person anywhere can influence the draw", the
requirements are impossible without an external randomness service or beacon.

The practical design I would use is:

- Entrants commit during the entry week, reveal after entries close, and the
  final seed also includes the hash of a future block chosen before that block
  exists.
- The organizer never supplies a random seed, never picks a winner, and never
  gets a redraw button.
- Every transition after 20:00 UTC is permissionless and pays a small ETH caller
  fee, so the state machine does not depend on one operator key.
- If the reveal ceremony fails, the contract fails closed: no improvised draw,
  no owner-selected fallback, and no payout.

## Things to have in place before Friday 20:00 UTC

Deploy and verify a non-upgradeable raffle contract with immutable parameters:

- `entryClose = Friday 20:00:00 UTC`.
- `revealClose = Friday 20:20:00 UTC`, or whatever stage window you want.
- `minReveals`, for example 8, so the draw does not depend on one person's
  secret.
- `drawDelayBlocks`, for example 5 mainnet blocks after the draw request.
- `finalizeDeadlineBlocks`, comfortably below `blockhash` expiry, for example
  180 mainnet blocks after the draw block. If the target chain supports the
  EIP-2935 blockhash history contract, the deadline can be longer, but do not
  rely on it unless you have confirmed support on that chain.
- `prize = 5 ETH`, already deposited from the treasury before entries open.
- A small ETH keeper budget in the same contract for the close/request/finalize
  caller fees.
- A refundable reveal bond on each entry. It does not need to equal the prize if
  the draw also uses a future block, but it should be enough that people do not
  casually grief the stage ceremony.

Each entry during the week is `enter(commitment, payoutAddress)` where:

```text
commitment = keccak256(raffleId, entrantAddress, payoutAddress, secret)
```

The UI must generate and save the entrant's `secret` locally and give the
entrant a QR/reveal link for Friday. The contract stores the commitment, the
entrant address, and the payout address. It must not let the owner add entries,
delete entries, change commitments, change the prize, pause payout, upgrade the
logic, or select a replacement winner.

Have at least three funded backup caller accounts in the room. They are not
trusted for randomness; they only push permissionless transactions.

## Exact onchain sequence after entries close

1. **Close entries**

   Transaction: `closeEntries()`.

   Sender: anyone; normally the stage operator sends it, with two backup callers
   ready.

   Window: first block after Friday 20:00:00 UTC, ideally 20:00-20:03 UTC.

   Contract behavior: records `closeBlock`, emits the final entry count, and
   pays the close caller fee. `enter()` itself must already reject calls with
   `block.timestamp >= entryClose`, so the caller does not provide entropy and
   cannot choose the entrant list; the timestamp gate does that.

2. **Reveal entrant secrets**

   Transaction: `reveal(secret)`.

   Sender: each entrant, from the same address that entered.

   Window: Friday 20:00-20:20 UTC.

   Contract behavior: checks the secret against the stored commitment, marks the
   entrant eligible, returns the entrant's reveal bond, and folds the reveal into
   an entropy accumulator:

   ```text
   entropy = keccak256(previousEntropy, entrantAddress, payoutAddress, secret)
   ```

   The important detail is that the final seed is not known yet, because the
   future draw block has not happened. A revealer cannot wait, compute whether
   they like the winner, and then decide whether to reveal.

3. **Seal the reveal set and request the draw block**

   Transaction: `sealAndRequestDraw()`.

   Sender: anyone; normally a backup caller if the stage operator has not done
   it by 20:21 UTC.

   Window: Friday 20:20-20:23 UTC.

   Contract behavior: requires `block.timestamp >= revealClose`, requires at
   least `minReveals`, freezes the eligible entrant list and entropy accumulator,
   sets:

   ```text
   drawBlock = block.number + drawDelayBlocks
   ```

   emits `DrawRequested(drawBlock)`, and pays the caller fee. No one supplies a
   seed in this transaction. The caller can make the draw happen, but cannot know
   the future block hash.

4. **Finalize and pay**

   Transaction: `finalizeDraw()`.

   Sender: anyone; normally the stage operator or first backup caller.

   Window: after `drawBlock` has been mined and after the chosen confirmation
   buffer, but before `drawBlock + finalizeDeadlineBlocks`. On mainnet, a good
   stage window is roughly 20:25-20:50 UTC if the draw was requested around
   20:20 UTC.

   Contract behavior: reads `blockhash(drawBlock)`, computes:

   ```text
   seed = keccak256(raffleId, address(this), entropy, blockhash(drawBlock))
   winnerIndex = uint256(seed) % eligibleEntrantCount
   ```

   Then it records the winner permanently and sends 5 ETH to the stored
   `payoutAddress`. If the payout address is a contract and the ETH transfer
   reverts, the raffle still records the winner and escrows the 5 ETH for that
   winner only; the winner can call `claimPrize()` later. For a normal wallet,
   the prize lands in the winner's wallet in the `finalizeDraw()` transaction.

## If someone does not do their part

- If nobody calls `closeEntries()` right at 20:00 UTC, nothing magical happens;
  contracts do not run themselves. Late entries are still rejected because
  `enter()` checks `entryClose` directly, and any funded caller can send the
  close transaction. The caller fee is there so this does not depend on one
  organizer.

- If an entrant does not reveal by `revealClose`, that entry is ineligible and
  its reveal bond is forfeited. The forfeited bond should either go to the keeper
  pool or be split among successful revealers. The contract must not let the
  entrant reveal late after seeing the future block hash.

- If fewer than `minReveals` happen by `revealClose`, the raffle enters
  `FAILED_INSUFFICIENT_REVEALS`. No one can draw a winner, the 5 ETH remains in
  the treasury/raffle escrow according to the published rules, and revealed
  entrants can withdraw any refundable entry amounts. This is the right failure
  mode: a bad ceremony is cancelled, not rescued by an organizer-provided random
  number.

- If nobody calls `sealAndRequestDraw()`, the draw is merely delayed. Anyone can
  still call it after `revealClose` as long as the raffle has enough reveals.
  The prize will not land until this transaction and the later finalize
  transaction happen.

- If nobody calls `finalizeDraw()` while the block hash is still available, the
  contract must not allow the organizer to invent a seed. The clean options are:
  use the chain's verified blockhash history contract if available, or mark that
  draw request stale and require a fresh `sealAndRequestDraw()` using a new
  future block. The stale path should be public, permissionless, and rate-limited
  by time so it cannot be used as a private redraw button during the normal
  finalize window.

- If the winner's payout transaction cannot deliver ETH because the payout
  address rejects ETH, the contract records the same winner and switches that
  winner to pull payment. Nobody else can claim or redraw.

## Why a losing entrant cannot credibly call this rigged

After the event, they can verify from the contract and logs:

- The entry list closed by timestamp, not by organizer discretion.
- Every eligible entrant revealed the secret matching a pre-close commitment.
- The reveal set was frozen before the future draw block existed.
- The draw block number was fixed before its block hash existed.
- The winner was computed by a published formula.
- No owner function could replace the entropy, choose another block, exclude an
  eligible entrant, pause the payout, upgrade the implementation, or redraw after
  seeing the result.

The one caveat they can still point to is the public-chain residual: the proposer
of the chosen future block could theoretically skip its own block. That is not
organizer rigging, but it is why a paid VRF or comparable external beacon is the
right tool when the requirement is literally no influence by anyone.
