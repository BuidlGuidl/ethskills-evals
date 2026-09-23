# The giveaway: how the night actually runs

## The shape of it

No paid randomness provider, so the randomness comes from the entrants
themselves: **commit–reveal**. Each entrant commits a hash of a secret during
the entry week and reveals the secret on the night, after entries close. The
contract XORs all revealed secrets into a seed and picks the winner from it.
As long as even one entrant chose a secret nobody else knows, nobody — us
included — can predict or steer the outcome. Every commitment is timestamped
onchain before entries close, every reveal is checked against its commitment,
and the winner formula is three lines of verified code, so a loser auditing
afterwards finds nothing to point at.

A future blockhash or `prevrandao` would be simpler, but a block proposer can
bias those, and "the validators rigged our raffle" is exactly the kind of
credible-sounding claim we don't want to leave open. Commit–reveal closes it.

## What has to be in place beforehand

- **The contract, deployed and source-verified** on a public explorer well
  before entries open, with these constants baked in at deploy:
  - `ENTRY_DEADLINE` = Friday 20:00 UTC (a Unix timestamp, so no daylight-saving
    arguments).
  - `REVEAL_DEADLINE` = Friday 20:45 UTC — a 45-minute reveal window, sized to
    fit "on stage, same evening."
  - `ENTRY_DEPOSIT` = a small amount (e.g. 0.01 ETH), refunded on reveal.
- **The 5 ETH, sent from the treasury to the contract** before entries open, so
  everyone can see the prize is real and already locked.
- **An entry flow for attendees**: a simple page (or even a documented `cast`
  command) that generates a random secret, stores it in the attendee's wallet
  browser / on their phone, and sends `enter(commitment)` where
  `commitment = keccak256(abi.encodePacked(secret, msg.sender))`. The secret
  must survive until Friday night — the UI should make them back it up.
- **Each entrant needs a wallet with a little ETH for gas** — two transactions
  total (enter, reveal).
- **One laptop + the venue's wifi** on the night. That's the whole
  infrastructure.

## The sequence on the night

**1. Entries close — Friday 20:00 UTC. No transaction.**
`enter()` simply reverts after `ENTRY_DEADLINE`. Nothing needs to be sent;
closing is a timestamp check, not an event someone has to trigger. The entry
list and all commitments are now frozen and publicly readable.

**2. Reveal window — 20:00 to 20:45 UTC. Each entrant sends their own
`reveal(secret)`.**
On stage, everyone who entered pulls out their phone and reveals. The contract
checks `keccak256(secret, msg.sender)` against the stored commitment, refunds
the 0.01 ETH deposit, and folds the secret into the running seed. The
incentive is built in: **only addresses that reveal are eligible to win, and
only revealers get their deposit back.** Nobody needs to chase anyone —
revealing is each entrant's only chance at 5 ETH.

**3. The draw — any time after 20:45 UTC. One permissionless transaction,
`draw()`, sent by literally anyone.**
In practice the MC sends it from the stage laptop, or the likely winner sends
it themselves — they're the most motivated person in the room. `draw()`
requires the reveal deadline to have passed, computes
`winnerIndex = uint256(seed) % revealCount`, and pushes 5 ETH straight to the
winner's address in the same transaction. The prize lands while everyone is
still standing there; the tx hash goes up on the projector.

Total on the night: one transaction per entrant, plus one.

## If someone doesn't do their part

- **An entrant loses their secret or doesn't reveal by 20:45:** they're
  excluded from the draw and forfeit their deposit. Forfeited deposits join
  the prize, so the winner gets 5 ETH plus the no-shows' deposits. Crucially,
  the draw does not block on them — it runs over whoever revealed.
- **The person who would reveal last tries to game it:** they can see every
  other reveal and compute the outcome before sending their own transaction.
  But withholding can never make them win — non-revealers are ineligible — so
  their only choices are "reveal and maybe win" or "withhold, definitely lose,
  and lose the deposit." Revealing is always their best move. This is why the
  eligibility rule matters; without it the last revealer gets a free re-roll.
- **Nobody calls `draw()`:** it stays callable forever and the winner has
  5 ETH of motivation to call it themselves. No operator needed.
- **Nobody reveals at all (everyone went home):** the giveaway is void.
  After a 7-day grace period, an `onlyOwner` sweep returns the 5 ETH and the
  forfeited deposits to the treasury. That sweep is the one operator power in
  the contract — it cannot touch anything before `REVEAL_DEADLINE + 7 days`,
  and it should be called out as such so nobody mistakes it for a backdoor.
  There is no pause, no blacklist, no upgradeability, and no way for us to
  redirect the prize once entries close.

## Why a loser can't credibly call it rigged

Their own commitment is onchain, timestamped before entries closed. Every
other commitment is too. The reveals either match their commitments or revert.
The seed is a public XOR they can recompute by hand, the winner index is a
modulo they can recompute by hand, and the payout is a single visible
transaction. The only thing anyone ever kept private was their own secret —
and the only person who could have lost by revealing it is them.
