# Friday-night giveaway: entries close to prize paid

## The construction

Commit–reveal. It's the only design that fits both hard requirements — nobody
can influence or foresee the winner, and the result survives hostile
after-the-fact scrutiny — with nothing but a contract and ETH. Chainlink VRF is
the other standard answer, but it needs a funded subscription with a third
party, which the treasury constraint rules out. Anything read straight from the
block (`block.timestamp`, `blockhash(block.number - 1)`, `block.prevrandao`)
is out: it's either already known to the caller (who can simulate and only send
winning transactions) or biasable by the block proposer, which is exactly the
kind of thing a loser can point at afterwards and call rigged. For 5 ETH,
"probably fine for a raffle" isn't good enough.

How it works: every entrant commits a hash of a secret when they enter, before
the deadline. After entries close, the contract seals in the hash of a block
mined after the deadline, entrants reveal their secrets, and the winner is a
pure function of the revealed secrets plus that sealed blockhash. Because the
seed can't be known by anyone — including us, including all the entrants
colluding together — until after entries are locked, and because the selection
is deterministic code anyone can re-execute from public data, there is no
credible rigging story to tell afterwards.

## What has to be in place beforehand

All of this happens during the week, before Friday 20:00 UTC:

1. **Contract deployed and source verified on the block explorer.** The
   "read the contract afterwards" requirement means the verified source is
   part of the product. It must have no pause switch, no owner-only draw, no
   upgradeability — our only privileged role is funding it, which happens up
   front.
2. **Funded with exactly 5 ETH from the treasury.** The prize sits in the
   contract before entries open, so the payout on the night is a single atomic
   transfer from the contract — no one has to send ETH live on stage, and
   entrants can verify the prize is real and locked before they bother
   entering.
3. **Entry function live.** `enter(bytes32 commitment)` where
   `commitment = keccak256(secret, msg.sender)`, rejected after the Friday
   20:00 UTC timestamp. Each entrant generates their secret client-side and
   **must save it** (wallet backup, written down, printed). A lost secret is a
   forfeited entry — say this out loud at entry time.
4. **Chain and timings pinned down.** Times below assume Ethereum mainnet
   (12s blocks). The seed blockhash is *stored* at seal time, so the 256-block
   `blockhash` lookback (~51 min on mainnet) never bites us — but only because
   seal() stores it; don't "simplify" the contract to read it lazily at draw
   time.
5. **Someone in the room able to send two transactions** (seal and draw) from
   a phone or laptop, with a little ETH for gas. These are permissionless, so
   this is a convenience, not a dependency — but don't leave it to chance.

## The sequence on the night

| # | Step | Who sends the tx | Window |
|---|------|------------------|--------|
| 1 | Entries close | Nobody — the 20:00 UTC deadline is a timestamp check inside the contract. `enter()` simply starts reverting. Nothing needs to be sent. | Automatic at 20:00 UTC |
| 2 | `seal()` — stores `blockhash(block.number - 1)` as the block-entropy half of the seed and opens the reveal window | Host on stage, but permissionless: any entrant can send it | Must land after 20:00 UTC and before the reveal window ends (see step 3). On stage: ~20:00–20:05 |
| 3 | `reveal(secret)` — contract checks `keccak256(secret, msg.sender)` matches the stored commitment | **Each entrant**, from their own wallet (phone in the room, or remotely) | Fixed by timestamp in the contract: 20:00–20:30 UTC. 30 min is comfortable on mainnet (~150 blocks) even with a congested block or two |
| 4 | `draw()` — computes `seed = keccak256(xor of all revealed secrets, sealed blockhash)`, winner = revealed entrants in entry order, index `seed % count`, and transfers the 5 ETH in the same transaction | Host on stage, but permissionless: anyone can send it | Any time after the reveal window closes (20:30 UTC). No expiry — the seed was stored at seal, so this works an hour later or a month later. On stage: ~20:30–20:35 |

Step 4 is the handover: the transaction is on the projector, everyone watches
it confirm, and the prize is already in the winner's wallet before they walk
up. Total stage time after 20:00: about 35 minutes, mostly waiting out the
reveal window.

Ordering detail that matters: seal (block entropy) lands *before* any reveal.
That way even a hypothetical cartel of every single entrant couldn't have
predetermined the winner at entry time — the seed contains a blockhash that
didn't exist yet. And because a secret is only useful to its owner, the last
person to reveal learns the outcome one step early but gains nothing by
withholding: withholding forfeits their entry, while revealing gives them
their true chance of winning. Rational entrants reveal.

## What if someone doesn't do their part

- **An entrant doesn't reveal by 20:30** (forgot, lost their secret, phone
  died, left early): their entry is excluded, full stop. The draw proceeds
  over whoever revealed. This is the entire incentive design — non-reveal
  hurts only the non-revealer, so nobody else has to care, and nobody has to
  chase anyone. Their unrevealed secret stays private and can never be used.
- **Nobody sends `seal()`**: it's permissionless, so any entrant can. If the
  reveal window closes with no seal, treat it like zero reveals (below) —
  the deadline timestamp, not the seal, is what gates reveals.
- **Nobody sends `draw()` on the night**: nothing breaks and nothing expires.
  The contract holds the outcome-ready state indefinitely; any entrant (or
  anyone at all) can trigger the draw and payout later. The prize cannot be
  redirected to anyone but the computed winner.
- **Exactly one person reveals**: they win. That's not a bug — they were the
  only entrant who didn't forfeit, and the rule was enforced identically for
  everyone, in code they can read.
- **Zero people reveal**: after a long grace period (e.g. 7 days), a
  permissionless `reclaim()` returns the 5 ETH to the treasury address and we
  rerun the giveaway at the next meetup. The contract never redraws from a
  fallback entropy source — a degraded draw is a worse outcome than a
  postponed one, because it's the degraded path that hands a loser their
  "rigged" narrative.
- **We (the organisers) vanish, lose keys, or don't show up**: after funding,
  we hold no role in the sequence at all. Seal, reveal, draw and reclaim are
  all permissionless, so the entrants in the room can run the whole evening
  without us — and can't be stopped by us, either.
