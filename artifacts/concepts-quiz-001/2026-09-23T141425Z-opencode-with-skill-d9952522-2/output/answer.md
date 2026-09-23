# Friday-night giveaway: closing entries → prize paid, trustlessly

## The shape of it

The treasury constraint rules out Chainlink VRF (it needs a funded subscription account), so the draw uses **commit–reveal**, which needs nothing but the contract and the entrants:

- To enter, each person submits a **commitment**: `keccak256(theirAddress, secret)`, where `secret` is 32 random bytes they generate locally and keep safe. The commitment hides the secret and binds it to their address, so nobody can copy or front-run anyone else's entry.
- After entries close, everyone **reveals** their secret. The contract checks it hashes to the commitment.
- The winner is drawn from a seed built from **all** the reveals plus the hash of the closing block. No single party — organizer, entrant, or block proposer — can know or steer the outcome: everyone is locked in before any secret is visible, and the proposer of the closing block can't see the secrets when they propose it.

The crucial consequence for the night: **entering is not enough — every entrant must also send a reveal transaction during the reveal window, or they cannot win.** This is the one human obligation the design creates, and it has to be communicated loudly at entry time.

## What has to be in place beforehand

1. **The contract**, deployed and verified on a block explorer well before the week starts, with hard-coded parameters:
   - `entryDeadline` = Friday 20:00:00 UTC (a Unix timestamp, enforced by the contract — nothing needs to be sent at 20:00, `enter()` simply reverts after it and `reveal()` only works after it);
   - `revealDeadline` = e.g. 20:30 UTC (30 minutes is plenty for people in a room with their phones);
   - the treasury address; no owner powers over funds or the draw (see "What an observer can check" below).
2. **The 5 ETH**, transferred from the treasury into the contract *before entries open*. The prize sitting in the contract all week is what lets the payout happen in the same transaction as the draw, with no one authorizing anything on the night.
3. **A small entry deposit** (e.g. 0.01 ETH) paid with each entry, refunded on reveal. See failure modes for why.
4. **Each entrant needs**: an address with a little ETH for gas plus the deposit, and a secret they have actually saved (written down / in their wallet app). Losing the secret = can't reveal = can't win.
5. **On stage**: one laptop/phone with a funded wallet to send the draw transaction (anyone's — the call is permissionless), and a block explorer on the projector so the room can watch it land.

## The sequence on the night

| Time (UTC) | What happens | Who sends the tx | Why they bother |
|---|---|---|---|
| Before Friday | `enter(commitment)` + 0.01 ETH deposit, any time during the week | Each entrant | To be in the draw |
| 20:00:00 | Entries close. **No transaction** — the timestamp check does it. | — | — |
| 20:00–20:30 | `reveal(secret)`. Contract verifies the hash, marks the entrant eligible, refunds the 0.01 ETH immediately. First post-close transaction also pins `blockhash` of the closing block into storage. | **Each entrant, for themselves** | Revealing is the *only* way to be eligible, and it gets their deposit back |
| 20:30+ | `draw()`. Computes `seed = keccak256(allReveals, closingBlockHash)`, winner = `eligible[seed % eligible.length]`, and **sends the 5 ETH in the same transaction**. | Organizer on stage — but permissionless, any entrant (or stranger) can send it | The room wants a result; the call is one cheap tx |
| ~12 seconds later | Prize is in the winner's wallet. Verify on the explorer on the projector. | — | — |

The winner is whichever *address* wins — the person on stage proves it's theirs by showing they control it (e.g. signing a message or sending a dust tx).

## If someone doesn't do their part

- **An entrant doesn't reveal by 20:30.** They are excluded from the draw and forfeit their deposit. Crucially, withholding can never *help* them: the last person to reveal can compute both outcomes (reveal / don't reveal), but "don't reveal" excludes them entirely, so their best move is always to reveal honestly. The deposit is belt-and-braces — it makes pure griefing (withholding just to annoy) cost money. Forfeited deposits can sweep back to the treasury or pay the `draw()` caller's gas.
- **The organizer never calls `draw()`.** Does not matter — it's permissionless. Any entrant can call it, and the contract pays the winner in that same call. There is no step in the whole sequence that only the organizers can perform.
- **Nobody calls `draw()` for a long time.** Nothing expires and nothing is stuck: the closing block hash was pinned in storage by the first post-close transaction (without that pin, `blockhash` is only retrievable for 256 blocks — ~51 minutes at mainnet's 12s block time, ~27 hours via the EIP-2935 history contract — so pinning removes that cliff entirely). `draw()` stays callable until someone sends it.
- **Zero people reveal by 20:30.** The draw can't run with no entropy contributors, so the raffle is void: anyone can call `cancel()`, which returns the 5 ETH to the treasury and lets each entrant withdraw their deposit (the forfeiture only applies when a draw actually happened).

## What an observer can check afterwards (the "was it rigged?" test)

A losing entrant can verify, entirely from public onchain data:

1. The 5 ETH was in the contract before entries opened — nobody could have withdrawn or redirected it.
2. Every commitment was timestamped before the 20:00 deadline, and no entry landed after it.
3. Their own reveal is in the revealed set, and the seed is a published function of exactly those reveals plus a block hash from before any of them were visible.
4. Re-running `seed % eligibleCount` themselves gives the address that was paid.
5. The contract has **no owner functions** that touch funds, entries, or the draw — nothing to pause, upgrade, or override. The only privileged address is the treasury, and only as the refund destination in the cancel path.

What the design gives up, in plain terms: **everything is public** — the set of entrant addresses is visible forever (though commitments hide secrets until reveal), and the winner's address and payout are on the public record. And the one operational burden is real: entrants must show up (in person or online) during the reveal window, or they silently lose their chance and their deposit.
