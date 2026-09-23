# The 5 ETH giveaway — from entries close to prize on stage

## The design in one paragraph

A commit–reveal raffle, fully self-contained. The contract holds the 5 ETH itself. Every entrant supplies their own random secret during entry week (committed as a hash); the secrets are revealed live in the room after entries close; the final unpredictable input is the hash of a block that doesn't exist until after the last reveal decision has already been made. No admin key, no upgradability, no third-party provider, nothing but the contract and the people in the room.

Why not the alternatives:

- **Chainlink VRF** is the provable standard, but it needs LINK plus a funded subscription account — exactly what the treasury constraint rules out.
- **`block.timestamp`, `Math.random`-style tricks** — deterministic, and validators can nudge timestamps; a losing entrant reads the contract and immediately has a rigging story.
- **A blockhash chosen at draw time** — whoever sends the draw can watch the chain and only send it at a block whose hash gives the outcome they want. That's influence by call timing, which is why the seed block below is pinned the way it is.

## The sequence: Friday, entries closed → prize in wallet

First, note what closing entries costs: **nothing, and no one sends anything.** The entry list freezes itself — `enter()` simply starts reverting once `block.timestamp ≥ 20:00:00 UTC`. There is no cron job and no "close" transaction; the timestamp gate is the transition. Everything after this, however, is a poke that must be sent by someone:

| # | Transaction | Who sends it | Window |
|---|---|---|---|
| 1 | `reveal(secret)` — contract checks it hashes to the commitment | **Each entrant**, from the address they entered with. Only they know the secret, so only they can send this. Their incentive is their own 5 ETH ticket. | Fri 20:00:00–20:30:00 UTC. Live in the room: "phones out, hit reveal." |
| 2 | `lock()` — records `B = block.number` (the block this tx lands in). This pins the seed block. | **Anyone** (permissionless). The MC from the stage laptop; any attendee if the MC's connection dies. | Any time after 20:30:00 UTC; on the night, ~20:31. One-time. |
| 3 | `draw()` — reads `blockhash(B)`, computes `seed = keccak256(all revealed secrets, in entry order ‖ blockhash(B))`, `winner = revealedEntrants[seed % count]`, records both onchain. | **Anyone** (permissionless). | **Within 256 blocks (~51 min) of B** — past that, `blockhash(B)` reads zero. On the night, ~20:32. |
| 4 | `claim()` — sends the 5 ETH to the **recorded** winner. | **Anyone** — the winner from on stage is the nice version, but the destination is fixed by the contract, so even the MC's tx lands the money in the winner's wallet and nowhere else. | No real deadline (pre-announced rollover aside). On the night, ~20:33. |

Why the seed block is pinned this way:

- `B` is the block containing the `lock()` tx, so **its hash was unknowable to the person who chose to send it**. Nobody can grind by picking a favorable block — you can't see the hash of the block you're landing in.
- `B` doesn't exist until after 20:30, so **every reveal decision was already final before anyone could compute any outcome**. An entrant withholding their reveal can't steer the draw toward a second account — they can't compare branches, they can only remove themselves.
- The organizers hold no secret, choose no timing with knowledge, and have no key. Their only possible move is not showing up — see below.
- One residual, disclosed: the anonymous producer of block B could in principle have withheld that block if they disliked the outcome. They're a random validator, unidentifiable more than ~13 minutes ahead, forfeiting their own rewards to do it, and it only pays if they or an associate is an entrant — for 5 ETH, that is as strong as ETH-only and provider-free gets. Put it on the rules page anyway; disclosure is what kills the rigging story.

## What must be in place beforehand

1. **Contract deployed and verified before entries open** — immutable, no owner, no pause, no upgrade path. The only ways funds can ever leave: `claim()` → recorded winner, and a pre-announced `rollover()` → treasury after a long grace period. A loser must be able to read exactly the code that ran.
2. **The contract itself funded with the full 5 ETH before entries open.** The prize must move contract → winner on the night, not from an organizer wallet. If the organizers hand-send the ETH, they've reinserted themselves as a discretion point; if the contract sends it, they couldn't have.
3. **Entries:** the dapp generates each entrant a random 32-byte secret client-side; only its `keccak256` goes onchain. The plaintext lives solely on the entrant's phone (screenshot / saved) until the reveal. Never stored centrally — a stored secret is a leaked seed.
4. **The rules published before entries open:** close 20:00, reveal deadline 20:30, the seed formula, `lock`/`draw`/`claim` permissionless, rollover terms. Fixed in code and public before anyone enters — nobody can claim the rules were changed on the night.
5. **At the venue:** a screen showing the contract in a block explorer, connectivity, and a wallet with gas. Name two backup senders from the community — but every step is permissionless, so any attendee's wallet substitutes.
6. **Gas sanity:** `draw()` iterates the reveals; cap entries (say a few hundred) so the tx fits comfortably in a block.

## When someone doesn't do their part in time

- **An entrant doesn't reveal by 20:30.** Their entry is excluded — nothing more. `reveal()` reverts after the deadline and `draw()` counts only revealed entries. They lose their own ticket and cannot affect anyone else: since no one can compute an outcome before 20:30, withholding is self-removal, not steering.
- **Nobody calls `lock()` promptly.** The draw can't happen until the seed block is pinned; anyone can lock at any point after 20:30, so the schedule simply slips until someone does. If it never happens, the pre-announced rollover returns the prize to the treasury.
- **`lock()` happened but nobody drew within 256 blocks.** `blockhash(B)` now reads zero, so `draw()` reverts rather than compute a degraded seed. The contract lets anyone record a fresh seed block — with identical guarantees, since a block's hash is never knowable before it exists — and the draw re-opens for another 51 minutes.
- **Nobody reveals at all.** `draw()` reverts: there is no fair way to pick among unrevealed commitments, and the contract must not pretend otherwise. After the grace period, rollover returns the 5 ETH. In practice near-impossible: the prize is the entrants' own, they're all in the room, and revealing is the only thing standing between them and 5 ETH — the incentives do the policing.
- **The winner can't or won't act.** `claim()` is permissionless with a contract-fixed destination — the MC, a friend, any attendee can send the tx, and the 5 ETH can only land in the recorded winner's wallet. The prize is not hostage to one person's phone battery.
- **The organizers no-show entirely.** Nothing breaks. Reveal, lock, draw, and claim are all permissionless or entrant-driven, the contract alone holds the funds, and no admin key exists to miss. The raffle finishes without you.

## Why a losing entrant can't build a credible case

Everything below is checkable from the verified contract and the chain, with no discretion anywhere:

1. Every commitment was onchain before 20:00 — the timestamp gate guarantees it.
2. Every reveal happened before 20:30 and matches its commitment hash.
3. The seed block was recorded after 20:30, so its hash was unknowable to every person who made a decision, including whoever recorded it.
4. The seed and winner come from the published formula; the winner is `revealed[seed % count]` — no shortlist, no wildcard, no override function exists to read.
5. The prize moved from the contract, to the recorded winner, and there is no function anywhere that could have redirected it.
6. Every step's sender, window, and result is a public transaction — including who poked what, and that any of a hundred other people could have poked it instead.
